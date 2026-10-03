"""Strict public records: external facts and receipts, never case decisions."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, model_validator


class PublicModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


def nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("Must not be blank")
    return value


Text = Annotated[str, StringConstraints(min_length=1, max_length=2000), AfterValidator(nonblank)]
Identifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$")]
IdempotencyKey = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")]
Amount = Annotated[int, Field(ge=0, le=1_000_000_000)]
Revision = Annotated[int, Field(ge=1)]


def valid_date(value: str) -> str:
    if date.fromisoformat(value).isoformat() != value:
        raise ValueError("Use YYYY-MM-DD")
    return value


def valid_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("Timestamp requires a UTC offset")
    return value


def valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Use an IANA timezone") from exc
    return value


DateText = Annotated[str, AfterValidator(valid_date)]
Timestamp = Annotated[str, AfterValidator(valid_timestamp)]
TimezoneName = Annotated[str, StringConstraints(min_length=1, max_length=80), AfterValidator(valid_timezone)]
ClockTime = Annotated[str, StringConstraints(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]
ScenarioName = Literal[
    "normal", "over_limit", "incomplete_commitment", "provider_unavailable",
    "slot_unavailable", "ambiguous_timeout", "malformed", "no_show", "part_required",
    "provider_reported_complete", "technician_en_route", "service_attempted", "cancelled", "unknown",
    "appointment_provider_unavailable",
]
BookingStatus = Literal["REQUESTED", "CONFIRMED", "REJECTED", "UNKNOWN"]
ProviderStatus = Literal[
    "SCHEDULED", "TECHNICIAN_EN_ROUTE", "NO_SHOW", "SERVICE_ATTEMPTED",
    "PROVIDER_REPORTED_COMPLETE", "PART_REQUIRED", "CANCELLED", "UNKNOWN",
]
ErrorCode = Literal[
    "NOT_FOUND", "INVALID_ARGUMENT", "VERSION_CONFLICT", "IDEMPOTENCY_CONFLICT",
    "PROVIDER_UNAVAILABLE", "QUOTE_EXPIRED", "SLOT_UNAVAILABLE", "OUTCOME_UNKNOWN", "NOT_CONFIGURED",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


class Evidence(PublicModel):
    source: Literal["PROVIDER", "HOUSEHOLD", "PINE", "CANONICAL_FIXTURE"]
    reference: Text
    observed_at: Timestamp
    is_simulated: bool


class Provenance(PublicModel):
    source: Literal["canonical_fixture", "mcp_runtime", "pine_supplied", "simulated_provider"]
    reference: Text
    observed_at: Timestamp
    is_simulated: bool


class ErrorInfo(PublicModel):
    code: ErrorCode
    message: Text


class Failure(PublicModel):
    success: Literal[False] = False
    error: ErrorInfo
    provenance: Provenance
    provider_booking_status: BookingStatus | None = None


class ToolFailure(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code, self.message = code, message
        super().__init__(message)


class Warranty(PublicModel):
    status: Text
    expiry_date: DateText | None
    coverage_type: Text
    provider: Text
    terms_summary: Text | None


class HouseholdPreferences(PublicModel):
    availability: Text | None
    repair_limit_inr: Amount | None
    replacement_estimate_inr: Amount | None


class FailureFact(PublicModel):
    record_id: Identifier
    case_id: Identifier
    date: DateText
    problem: Text
    fault_type: Text
    notes: Text | None = None
    evidence: Evidence


class RepairFact(PublicModel):
    record_id: Identifier
    case_id: Identifier
    date: DateText
    problem: Text
    work_description: Text
    amount_inr: Amount
    provider_id: Identifier | None = None
    provider_name: Text
    parts_replaced: list[Text] = Field(default_factory=list, max_length=50)
    household_confirmation_reference: Text | None = None
    evidence: Evidence


class ProviderFact(PublicModel):
    provider_id: Identifier
    name: Text
    phone: str | None
    last_used_date: DateText | None
    notes: Text | None
    evidence: Evidence


class ServiceEventFact(PublicModel):
    record_id: Identifier
    case_id: Identifier
    event: Literal["PROVIDER_CONTACT", "VISIT_REPORTED", "PROVIDER_REPORTED_COMPLETE", "PART_REQUIRED", "NO_SHOW", "NOTE"]
    details: Text
    evidence: Evidence


class HouseholdObservationFact(PublicModel):
    record_id: Identifier
    case_id: Identifier
    working: bool
    notes: Text
    evidence: Evidence


class MachineFacts(PublicModel):
    machine_id: Identifier
    category: Text
    brand: Text
    model: Text | None
    purchase_year: Annotated[int, Field(ge=1900, le=2200)]
    purchase_date: DateText | None
    warranty: Warranty
    household_preferences: HouseholdPreferences
    prior_failures: list[FailureFact]
    prior_repairs: list[RepairFact]
    cumulative_repair_spend_inr: Amount
    provider_history: list[ProviderFact]
    service_events: list[ServiceEventFact]
    household_observations: list[HouseholdObservationFact]


class GetMemoryInput(PublicModel):
    machine_id: Identifier


class MemoryResult(PublicModel):
    success: Literal[True] = True
    machine: MachineFacts
    revision: Revision
    provenance: Provenance
    retrieved_at: Timestamp


class AppendFailure(PublicModel):
    type: Literal["append_failure"]
    record_id: Identifier
    date: DateText
    problem: Text
    fault_type: Text
    notes: Text | None = None
    evidence: Evidence


class AppendServiceEvent(PublicModel):
    type: Literal["append_service_event"]
    record_id: Identifier
    event: Literal["PROVIDER_CONTACT", "VISIT_REPORTED", "PROVIDER_REPORTED_COMPLETE", "PART_REQUIRED", "NO_SHOW", "NOTE"]
    details: Text
    evidence: Evidence

    @model_validator(mode="after")
    def provider_claim_source(self):
        if self.event == "PROVIDER_REPORTED_COMPLETE" and self.evidence.source != "PROVIDER":
            raise ValueError("Provider completion must retain PROVIDER evidence")
        return self


class AppendHouseholdObservation(PublicModel):
    type: Literal["append_household_observation"]
    record_id: Identifier
    working: bool
    notes: Text
    evidence: Evidence

    @model_validator(mode="after")
    def household_source(self):
        if self.evidence.source != "HOUSEHOLD":
            raise ValueError("A household observation requires HOUSEHOLD evidence")
        return self


class AppendRepair(PublicModel):
    type: Literal["append_repair_record"]
    record_id: Identifier
    date: DateText
    problem: Text
    work_description: Text
    amount_inr: Amount
    provider_id: Identifier | None = None
    provider_name: Text
    parts_replaced: list[Text] = Field(default_factory=list, max_length=50)
    household_confirmation_reference: Text | None = None
    evidence: Evidence


Update = Annotated[
    AppendFailure | AppendServiceEvent | AppendHouseholdObservation | AppendRepair,
    Field(discriminator="type"),
]


class UpdateMemoryInput(PublicModel):
    machine_id: Identifier
    case_id: Identifier
    expected_revision: Revision
    idempotency_key: IdempotencyKey
    updates: list[Update] = Field(min_length=1, max_length=20)


class UpdateMemoryResult(PublicModel):
    success: Literal[True] = True
    machine_id: Identifier
    case_id: Identifier
    revision: Revision
    applied_record_ids: list[Identifier]
    replayed: bool = False
    provenance: Provenance


class QuoteInput(PublicModel):
    machine_id: Identifier
    case_id: Identifier
    provider_id: Identifier
    issue_description: Text
    idempotency_key: IdempotencyKey


class QuoteResult(PublicModel):
    success: Literal[True] = True
    machine_id: Identifier
    case_id: Identifier
    provider_id: Identifier
    quote_id: Identifier
    amount_inr: Amount | None
    charge_scope: Literal["VISITING_CHARGE", "FULL_REPAIR", "DIAGNOSTIC", "UNKNOWN"]
    diagnosis_claim: Text | None
    exclusions: list[Text]
    expires_at: Timestamp | None
    outstanding_information: list[Text]
    scenario: ScenarioName
    replayed: bool = False
    provenance: Provenance


class RequestedSlot(PublicModel):
    date: DateText
    start_time: ClockTime
    end_time: ClockTime
    timezone: TimezoneName

    @model_validator(mode="after")
    def ordered(self):
        if self.start_time >= self.end_time:
            raise ValueError("Slot end must be after start on the same date")
        return self


class ProviderSlot(PublicModel):
    date: DateText | None
    start_time: ClockTime | None
    end_time: ClockTime | None
    timezone: TimezoneName | None


class AppointmentInput(PublicModel):
    machine_id: Identifier
    case_id: Identifier
    provider_id: Identifier
    quote_id: Identifier
    requested_slot: RequestedSlot
    idempotency_key: IdempotencyKey


class AppointmentResult(PublicModel):
    success: Literal[True] = True
    machine_id: Identifier
    case_id: Identifier
    provider_id: Identifier
    quote_id: Identifier
    request_id: Identifier
    appointment_id: Identifier | None
    booking_status: BookingStatus
    requested_slot: RequestedSlot
    provider_slot: ProviderSlot
    provider_reference: Identifier | None
    outstanding_information: list[Text]
    scenario: ScenarioName
    replayed: bool = False
    provenance: Provenance

    @model_validator(mode="after")
    def concrete_confirmation(self):
        if self.booking_status == "CONFIRMED":
            slot = self.provider_slot
            if not all((slot.date, slot.start_time, slot.end_time, slot.timezone, self.provider_reference, self.appointment_id)):
                raise ValueError("Provider confirmation requires a concrete slot and reference")
            if slot.start_time >= slot.end_time:
                raise ValueError("Provider slot end must be after start")
        return self


class ProviderReference(PublicModel):
    type: Literal["QUOTE", "APPOINTMENT", "APPOINTMENT_REQUEST"]
    id: Identifier


class StatusInput(PublicModel):
    reference: ProviderReference


class ProviderClaim(PublicModel):
    kind: Literal["PROVIDER_REPORTED_COMPLETE", "PART_REQUIRED", "VISIT_UPDATE"]
    statement: Text
    evidence: Evidence


class StatusResult(PublicModel):
    success: Literal[True] = True
    reference: ProviderReference
    provider_id: Identifier
    provider_status: ProviderStatus
    provider_claims: list[ProviderClaim]
    appointment: AppointmentResult | None
    quote: QuoteResult | None
    outstanding_information: list[Text]
    provenance: Provenance
    retrieved_at: Timestamp
