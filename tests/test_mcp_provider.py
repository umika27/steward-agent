"""Provider results remain external facts across failure, replay and restart."""
from dataclasses import replace
import json

from pydantic import ValidationError

from integrations.steward_mcp.server import Application
from tests.test_mcp_memory import MCPFixture, SLOT


class TestMCPProvider(MCPFixture):
    def scenario(self, name):
        self.config = replace(self.config, scenario=name)
        self.app = Application(self.config)

    def test_normal_quote_is_visiting_charge(self):
        quote = self.quote()
        self.assertEqual(quote["amount_inr"], 900)
        self.assertEqual(quote["charge_scope"], "VISITING_CHARGE")
        self.assertTrue(quote["exclusions"])
        self.assertTrue(quote["provenance"]["is_simulated"])

    def test_over_limit_quote_and_booking_do_not_make_authority_decision(self):
        self.scenario("over_limit")
        quote = self.quote()
        self.assertEqual(quote["amount_inr"], 3800)
        self.assertEqual(quote["charge_scope"], "FULL_REPAIR")
        booking = self.book(quote)
        self.assertEqual(booking["booking_status"], "CONFIRMED")
        for result in (quote, booking):
            for key in ("approved", "requires_human", "recommended_action", "next_state", "decision"):
                self.assertNotIn(key, result)

    def test_unavailable_provider_error_persists_without_quote_id(self):
        self.scenario("provider_unavailable")
        arguments = self.quote_arguments()
        self.assertFailure("PROVIDER_UNAVAILABLE", "request_service_quote", arguments)
        self.scenario("normal")
        self.assertFailure("PROVIDER_UNAVAILABLE", "request_service_quote", arguments)
        with self.app.storage.read() as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM provider_records").fetchone()[0], 0)

    def test_malformed_quote_preserves_missing_information(self):
        self.scenario("malformed")
        quote = self.quote()
        self.assertIsNone(quote["amount_inr"])
        self.assertIsNone(quote["diagnosis_claim"])
        self.assertEqual(quote["charge_scope"], "UNKNOWN")
        self.assertIn("amount_inr", quote["outstanding_information"])
        self.assertFailure("OUTCOME_UNKNOWN", "request_service_appointment", self.booking_arguments(quote))

    def test_confirmed_slot_and_reference(self):
        booking = self.book(self.quote())
        self.assertEqual(booking["provider_slot"], SLOT)
        self.assertEqual(booking["provider_reference"], "SAM-BLR-99201")
        self.assertEqual(booking["booking_status"], "CONFIRMED")

    def test_incomplete_commitment_has_no_confirmed_appointment_id(self):
        self.scenario("incomplete_commitment")
        booking = self.book(self.quote())
        self.assertEqual(booking["booking_status"], "REQUESTED")
        self.assertIsNone(booking["provider_slot"]["end_time"])
        self.assertIsNone(booking["provider_reference"])
        self.assertIsNone(booking["appointment_id"])
        self.assertEqual(self.status(booking)["provider_status"], "UNKNOWN")

    def test_booking_failures_do_not_fabricate_appointments(self):
        for scenario, code in (("slot_unavailable", "SLOT_UNAVAILABLE"),
                               ("appointment_provider_unavailable", "PROVIDER_UNAVAILABLE"),
                               ("ambiguous_timeout", "OUTCOME_UNKNOWN")):
            with self.subTest(scenario=scenario):
                self.scenario(scenario)
                arguments = self.quote_arguments()
                arguments["idempotency_key"] = scenario + "-quote"
                quote = self.invoke("request_service_quote", **arguments)
                booking = self.booking_arguments(quote)
                booking["idempotency_key"] = scenario + "-booking"
                self.assertFailure(code, "request_service_appointment", booking)
                self.scenario("normal")
                self.assertFailure(code, "request_service_appointment", booking)
        with self.app.storage.read() as connection:
            count = connection.execute("SELECT count(*) FROM provider_records WHERE kind != 'QUOTE'").fetchone()[0]
            self.assertEqual(count, 0)

    def test_quote_and_booking_replay_and_conflicts(self):
        quote = self.quote()
        self.assertEqual(self.quote()["quote_id"], quote["quote_id"])
        self.assertTrue(self.quote()["replayed"])
        self.assertFailure("IDEMPOTENCY_CONFLICT", "request_service_quote",
                           {**self.quote_arguments(), "issue_description": "Different fault"})
        booking = self.book(quote)
        self.app = Application(self.config)
        self.assertEqual(self.book(quote)["appointment_id"], booking["appointment_id"])
        self.assertTrue(self.book(quote)["replayed"])
        self.assertFailure("IDEMPOTENCY_CONFLICT", "request_service_appointment",
                           {**self.booking_arguments(quote), "requested_slot": {**SLOT, "date": "2026-10-10"}})

    def test_new_key_does_not_duplicate_booking_for_quote(self):
        quote = self.quote()
        first = self.book(quote)
        second = self.invoke("request_service_appointment", **{**self.booking_arguments(quote), "idempotency_key": "another-key"})
        self.assertEqual(first["appointment_id"], second["appointment_id"])
        self.assertTrue(second["replayed"])

    def test_provider_machine_and_case_association_checked(self):
        arguments = self.booking_arguments(self.quote())
        self.assertFailure("INVALID_ARGUMENT", "request_service_appointment", {**arguments, "case_id": "CASE-OTHER"})
        self.assertFailure("NOT_CONFIGURED", "request_service_appointment", {**arguments, "provider_id": "PRV-OTHER"})
        self.assertFailure("NOT_FOUND", "request_service_appointment", {**arguments, "machine_id": "WM-OTHER"})
        self.assertFailure("NOT_FOUND", "request_service_appointment", {**arguments, "quote_id": "QUOTE-UNKNOWN"})

    def test_quote_expiry_prevents_new_booking(self):
        quote = self.quote()
        with self.app.storage.transaction() as connection:
            quote["expires_at"] = "2020-01-01T00:00:00+00:00"
            connection.execute("UPDATE provider_records SET document=? WHERE kind='QUOTE' AND reference_id=?",
                               (json.dumps(quote), quote["quote_id"]))
        self.assertFailure("QUOTE_EXPIRED", "request_service_appointment", self.booking_arguments(quote))

    def test_all_statuses_are_fixed_under_repeated_polling_and_restart(self):
        expected = {"normal": "SCHEDULED", "technician_en_route": "TECHNICIAN_EN_ROUTE", "no_show": "NO_SHOW",
                    "service_attempted": "SERVICE_ATTEMPTED", "provider_reported_complete": "PROVIDER_REPORTED_COMPLETE",
                    "part_required": "PART_REQUIRED", "cancelled": "CANCELLED", "unknown": "UNKNOWN"}
        for scenario, status in expected.items():
            with self.subTest(scenario=scenario):
                self.scenario(scenario)
                quote = self.invoke("request_service_quote", **{**self.quote_arguments(), "idempotency_key": scenario})
                booking = self.invoke("request_service_appointment", **{**self.booking_arguments(quote), "idempotency_key": scenario})
                first = self.status(booking)
                self.scenario("normal")
                second = self.status(booking)
                self.assertEqual(first["provider_status"], status)
                self.assertEqual(second["provider_status"], status)
                first.pop("retrieved_at")
                second.pop("retrieved_at")
                self.assertEqual(first, second)

    def test_provider_completion_remains_claim_without_household_result(self):
        self.scenario("provider_reported_complete")
        result = self.status(self.book(self.quote()))
        self.assertEqual(result["provider_claims"][0]["evidence"]["source"], "PROVIDER")
        encoded = json.dumps(result)
        for prohibited in ('"verified"', '"resolved"', '"closed"', '"next_state"', '"decision"'):
            self.assertNotIn(prohibited, encoded)
        self.assertEqual(self.memory()["machine"]["household_observations"], [])

    def test_unknown_status_reference_and_unknown_provider(self):
        self.assertFailure("NOT_FOUND", "get_service_status", {"reference": {"type": "APPOINTMENT", "id": "APT-UNKNOWN"}})
        self.assertFailure("NOT_CONFIGURED", "request_service_quote", {**self.quote_arguments(), "provider_id": "PRV-NONE"})

    def test_strict_booking_slot_timezone_and_unexpected_fields(self):
        arguments = self.booking_arguments(self.quote())
        for slot in ({**SLOT, "timezone": "not/a-zone"}, {**SLOT, "end_time": "11:00"},
                     {**SLOT, "date": "Saturday"}, {**SLOT, "end_time": None}):
            with self.subTest(slot=slot), self.assertRaises(ValidationError):
                self.app.invoke("request_service_appointment", {**arguments, "requested_slot": slot})
        with self.assertRaises(ValidationError):
            self.app.invoke("request_service_appointment", {**arguments, "approved": True})
