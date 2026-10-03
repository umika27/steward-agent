"""Deterministic external-provider simulation, with no household decision logic."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from .schemas import (
    AppointmentInput, AppointmentResult, Evidence, Provenance, ProviderClaim, ProviderSlot,
    QuoteInput, QuoteResult, StatusInput, StatusResult, ToolFailure, now_iso,
)
from .storage import Storage, fingerprint

FIXTURES = Path(__file__).with_name("fixtures") / "provider_scenarios.json"


class SimulatedProvider:
    def __init__(self, storage: Storage, scenario: str = "normal"):
        self.storage = storage
        self.fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
        if scenario not in self.fixtures["scenarios"]:
            raise ValueError("Unknown provider scenario")
        self.scenario = scenario

    def _provider(self, provider_id):
        if provider_id != self.fixtures["provider_id"]:
            raise ToolFailure("NOT_CONFIGURED", "No simulated adapter configured for this provider")

    @staticmethod
    def _provenance(reference):
        return Provenance(source="simulated_provider", reference=reference, observed_at=now_iso(), is_simulated=True)

    def quote(self, request: QuoteInput) -> QuoteResult:
        arguments = request.model_dump(mode="json")
        failure = None
        result = None
        with self.storage.transaction() as connection:
            replay = self.storage.replay(connection, "request_service_quote", arguments)
            if replay is not None:
                if "error" in replay:
                    raise ToolFailure(replay["error"]["code"], replay["error"]["message"])
                return QuoteResult.model_validate(replay)
            self.storage.machine(connection, request.machine_id)
            self._provider(request.provider_id)
            scenario = self.fixtures["scenarios"][self.scenario]
            if scenario.get("quote_error"):
                failure = ToolFailure(scenario["quote_error"], "Simulated provider could not return a quotation")
                self.storage.receipt(connection, "request_service_quote", arguments,
                                     {"error": {"code": failure.code, "message": failure.message}})
            else:
                quote_id = "QUOTE-" + fingerprint(arguments)[:24]
                incomplete = scenario["amount_inr"] is None
                result = QuoteResult(machine_id=request.machine_id, case_id=request.case_id,
                    provider_id=request.provider_id, quote_id=quote_id, amount_inr=scenario["amount_inr"],
                    charge_scope=scenario["charge_scope"],
                    diagnosis_claim=None if incomplete else "[SIMULATED] Drainage blockage; subject to inspection",
                    exclusions=(["Repair labour and parts are not included"] if scenario["charge_scope"] == "VISITING_CHARGE" else []),
                    expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat() if not incomplete else None,
                    outstanding_information=(["amount_inr", "charge_scope", "diagnosis_claim", "expires_at"] if incomplete else []),
                    scenario=self.scenario, provenance=self._provenance("quote:" + quote_id))
                self.storage.put_provider_record(connection, "QUOTE", quote_id, result.model_dump(mode="json"))
                self.storage.receipt(connection, "request_service_quote", arguments, result.model_dump(mode="json"))
        if failure:
            raise failure
        return result

    def appointment(self, request: AppointmentInput) -> AppointmentResult:
        arguments = request.model_dump(mode="json")
        # Failures/unknown outcomes receive a durable error receipt too. Replaying
        # a timed-out request cannot become a fresh simulated confirmation.
        failure = None
        result = None
        with self.storage.transaction() as connection:
            replay = self.storage.replay(connection, "request_service_appointment", arguments)
            if replay is not None:
                if "error" in replay:
                    raise ToolFailure(replay["error"]["code"], replay["error"]["message"])
                return AppointmentResult.model_validate(replay)
            self.storage.machine(connection, request.machine_id)
            self._provider(request.provider_id)
            quote = self.storage.provider_record(connection, "QUOTE", request.quote_id)
            for key in ("machine_id", "case_id", "provider_id"):
                if quote[key] != arguments[key]:
                    raise ToolFailure("INVALID_ARGUMENT", "Quote association does not match this booking request")
            if quote["expires_at"] and datetime.fromisoformat(quote["expires_at"]) <= datetime.now(timezone.utc):
                raise ToolFailure("QUOTE_EXPIRED", "Provider quotation expired")
            # The booking uses the scenario captured with its quote, even after a restart.
            scenario = self.fixtures["scenarios"][quote["scenario"]]
            booking_error = scenario.get("booking_error")
            if scenario.get("booking") == "UNKNOWN":
                booking_error = "OUTCOME_UNKNOWN"
            if booking_error:
                failure = ToolFailure(booking_error, "Simulated booking: " + booking_error)
                self.storage.receipt(connection, "request_service_appointment", arguments,
                                     {"error": {"code": failure.code, "message": failure.message}})
            else:
                # One provider appointment per quote avoids duplicates under new retry keys.
                request_id = "BOOKREQ-" + fingerprint({"quote_id": request.quote_id})[:24]
                existing = connection.execute("SELECT document FROM provider_records WHERE kind='APPOINTMENT_REQUEST' AND reference_id=?",
                                              (request_id,)).fetchone()
                if existing:
                    result = AppointmentResult.model_validate(json.loads(existing["document"]))
                    if result.requested_slot != request.requested_slot:
                        raise ToolFailure("INVALID_ARGUMENT", "Quote already has a booking request for a different slot")
                    result.replayed = True
                else:
                    booking = scenario["booking"]
                    appointment_id = "APT-" + fingerprint({"quote_id": request.quote_id})[:24] if booking == "CONFIRMED" else None
                    slot = request.requested_slot.model_dump(mode="json")
                    missing = []
                    reference = "SAM-BLR-99201" if booking == "CONFIRMED" else None
                    if quote["scenario"] == "incomplete_commitment":
                        slot["end_time"] = None
                        missing = ["provider_slot.end_time", "provider_reference"]
                    result = AppointmentResult(machine_id=request.machine_id, case_id=request.case_id,
                        provider_id=request.provider_id, quote_id=request.quote_id, request_id=request_id, appointment_id=appointment_id,
                        booking_status=booking, requested_slot=request.requested_slot,
                        provider_slot=ProviderSlot.model_validate(slot), provider_reference=reference,
                        outstanding_information=missing, scenario=quote["scenario"],
                        provenance=self._provenance("booking-request:" + request_id))
                    self.storage.put_provider_record(connection, "APPOINTMENT_REQUEST", request_id, result.model_dump(mode="json"))
                    if appointment_id:
                        self.storage.put_provider_record(connection, "APPOINTMENT", appointment_id, result.model_dump(mode="json"))
                self.storage.receipt(connection, "request_service_appointment", arguments, result.model_dump(mode="json"))
        if failure:
            raise failure
        return result

    def status(self, request: StatusInput) -> StatusResult:
        with self.storage.read() as connection:
            document = self.storage.provider_record(connection, request.reference.type, request.reference.id)
        appointment = AppointmentResult.model_validate(document) if request.reference.type != "QUOTE" else None
        quote = QuoteResult.model_validate(document) if request.reference.type == "QUOTE" else None
        status = self.fixtures["scenarios"][document["scenario"]]["status"] if appointment else "UNKNOWN"
        claims = []
        if status in ("PROVIDER_REPORTED_COMPLETE", "PART_REQUIRED"):
            claims.append(ProviderClaim(kind=status,
                statement=("[SIMULATED] Provider says the service is complete" if status == "PROVIDER_REPORTED_COMPLETE"
                           else "[SIMULATED] Provider says a drain pump part is required"),
                evidence=Evidence(source="PROVIDER", reference=document["provenance"]["reference"],
                                  observed_at=document["provenance"]["observed_at"], is_simulated=True)))
        return StatusResult(reference=request.reference, provider_id=document["provider_id"],
            provider_status=status, provider_claims=claims, appointment=appointment, quote=quote,
            outstanding_information=document["outstanding_information"],
            provenance=Provenance.model_validate(document["provenance"]), retrieved_at=now_iso())
