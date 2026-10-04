"""Real HTTP tests against the localhost adapter, with isolated machine memory."""
import json
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from steward.api import make_server
from steward.demo_application import DemoApplication
from steward.machine_memory import DEFAULT_MACHINES_DIR


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="steward-api-test-")
        self.application = DemoApplication(Path(self.temp.name) / "machines")
        self.fixture = (DEFAULT_MACHINES_DIR / "WM-001.json").read_bytes()
        self.server = make_server(self.application, 0)
        self.thread = Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()
        self.assertEqual((DEFAULT_MACHINES_DIR / "WM-001.json").read_bytes(), self.fixture)

    def request(self, path, body=None, headers=None):
        request = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                          headers={"Content-Type": "application/json", **(headers or {})})
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def create(self, scenario="happy"):
        status, case = self.request("/api/cases", {"machine_id": "WM-001",
            "issue": "My washing machine isn't draining.", "scenario": scenario})
        self.assertEqual(status, 201, case)
        return case

    def advance(self, case):
        status, result = self.request(f"/api/cases/{case['case_id']}/advance-demo", {"expected_state": case["state"]})
        self.assertEqual(status, 200, result)
        return result

    def verifying(self):
        return self.advance(self.advance(self.create()))

    def test_health_is_explicit_local_mock(self):
        status, result = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(result["external_rails"], "mock")

    def test_machine_is_actual_persisted_memory(self):
        status, result = self.request("/api/machines/WM-001")
        self.assertEqual(status, 200)
        self.assertEqual(result["repair_history"][0]["cost_inr"], 1200)
        self.assertEqual(result["autonomous_repair_limit_inr"], 1500)

    def test_create_and_retrieve_real_case(self):
        case = self.create()
        self.assertIn(case["case_id"], self.application.manager.cases)
        self.assertEqual(case["state"], "SELECT_RESOLUTION")
        status, loaded = self.request(f"/api/cases/{case['case_id']}")
        self.assertEqual(status, 200)
        self.assertEqual(loaded, case)
        self.assertEqual(case["timeline"][0]["to_state"], "NEW_CASE")
        self.assertTrue(any(event["to_state"] == "LOAD_MEMORY" for event in case["timeline"]))

    def test_happy_provider_result_and_authority(self):
        case = self.advance(self.create())
        self.assertEqual(case["state"], "AWAITING_VISIT")
        self.assertEqual(case["quote"]["amount_inr"], 900)
        self.assertEqual(case["quote"]["approved_by"], "authority_engine")
        self.assertEqual(case["appointment"]["time_window"], "12:00–14:00")
        self.assertEqual(case["appointment"]["reference_number"], "SAM-BLR-99201")
        self.assertTrue(any(r["operation"] == "receive_call_result" and r["is_mock"] for r in case["rail_results"]))

    def test_provider_completion_does_not_close(self):
        case = self.verifying()
        self.assertEqual(case["state"], "VERIFYING")
        self.assertTrue(case["actions"]["verification"])
        self.assertFalse(case["memory_updated"])
        self.assertNotIn("CLOSED", [e["to_state"] for e in case["timeline"]])
        status, _ = self.request(f"/api/cases/{case['case_id']}/advance-demo", {})
        self.assertEqual(status, 409)

    def test_yes_closes_and_refreshes_memory(self):
        case = self.verifying()
        status, closed = self.request(f"/api/cases/{case['case_id']}/verification", {"working": True})
        self.assertEqual(status, 200, closed)
        self.assertEqual(closed["state"], "CLOSED")
        self.assertEqual([e["to_state"] for e in closed["timeline"]][-3:], ["RESOLVED", "UPDATE_MEMORY", "CLOSED"])
        self.assertEqual(closed["payment_status"], "SETTLED")
        _, memory = self.request("/api/machines/WM-001")
        self.assertEqual(memory["cumulative_repair_spend"], 2100)
        self.assertEqual(memory["repair_history"][-1]["case_id"], case["case_id"])

    def test_no_reassesses_without_successful_repair(self):
        case = self.verifying()
        status, failed = self.request(f"/api/cases/{case['case_id']}/verification", {"working": False})
        self.assertEqual(status, 200)
        self.assertEqual(failed["state"], "REASSESS_REPAIR_VS_REPLACE")
        self.assertEqual(failed["timeline"][-2]["to_state"], "REPAIR_FAILED")
        self.assertEqual(self.request("/api/machines/WM-001")[1]["cumulative_repair_spend"], 1200)

    def test_over_limit_stops_then_explicit_approval(self):
        case = self.advance(self.create("over-limit"))
        self.assertEqual(case["state"], "HUMAN_APPROVAL_REQUIRED")
        self.assertTrue(case["actions"]["approval"])
        self.assertIsNone(case["appointment"])
        self.assertFalse(any(r["rail_name"] == "payments" for r in case["rail_results"]))
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}/advance-demo", {})[0], 409)
        status, approved = self.request(f"/api/cases/{case['case_id']}/approval", {"approved": True})
        self.assertEqual(status, 200)
        self.assertEqual(approved["state"], "AWAITING_VISIT")
        self.assertEqual(approved["quote"]["approved_by"], "household")
        completed = self.advance(approved)
        status, closed = self.request(f"/api/cases/{completed['case_id']}/verification", {"working": True})
        self.assertEqual(status, 200)
        self.assertEqual(closed["state"], "CLOSED")
        self.assertEqual(self.request("/api/machines/WM-001")[1]["cumulative_repair_spend"], 5000)

    def test_reject_does_not_authorize_booking(self):
        case = self.advance(self.create("over-limit"))
        status, rejected = self.request(f"/api/cases/{case['case_id']}/approval", {"approved": False})
        self.assertEqual(status, 200)
        self.assertFalse(rejected["quote"]["approved"])
        self.assertIsNone(rejected["appointment"])
        self.assertFalse(rejected["actions"]["advance_demo"])
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}/advance-demo", {})[0], 409)

    def test_no_show_preserves_case_through_reschedule_and_closure(self):
        case = self.advance(self.create("no-show"))
        original_id = case["case_id"]
        case = self.advance(case)
        self.assertEqual(case["state"], "NO_SHOW")
        case = self.advance(case)
        self.assertEqual(case["state"], "AWAITING_VISIT")
        self.assertEqual(case["case_id"], original_id)
        self.assertEqual(case["appointment"]["reference_number"], "MOCK-RESCHEDULE-001")
        case = self.advance(case)
        status, closed = self.request(f"/api/cases/{original_id}/verification", {"working": True})
        self.assertEqual(status, 200)
        self.assertEqual(closed["state"], "CLOSED")
        self.assertTrue(any(e["to_state"] == "NO_SHOW" for e in closed["timeline"]))

    def test_premature_verification_and_approval_rejected(self):
        case = self.create()
        for action, body in (("verification", {"working": True}), ("approval", {"approved": True})):
            with self.subTest(action=action):
                self.assertEqual(self.request(f"/api/cases/{case['case_id']}/{action}", body)[0], 409)
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}")[1]["state"], "SELECT_RESOLUTION")

    def test_missing_case_machine_and_route(self):
        for path in ("/api/cases/missing", "/api/machines/missing", "/api/not-a-route"):
            self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.request("/api/cases", {"machine_id": "missing", "issue": "Broken"})[0], 404)

    def test_rejects_non_boolean_and_state_injection(self):
        case = self.verifying()
        for body in ({"working": "false"}, {"working": 1}, {"working": True, "state": "CLOSED"}):
            self.assertEqual(self.request(f"/api/cases/{case['case_id']}/verification", body)[0], 422)
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}")[1]["state"], "VERIFYING")

    def test_missing_fields_and_unknown_scenario(self):
        for body in ({}, {"machine_id": "WM-001", "issue": " "},
                     {"machine_id": "WM-001", "issue": "broken", "scenario": "real-gnani"}):
            self.assertEqual(self.request("/api/cases", body)[0], 422)

    def test_stale_double_action_is_rejected(self):
        case = self.create()
        self.advance(case)
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}/advance-demo", {"expected_state": case["state"]})[0], 409)
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}")[1]["state"], "AWAITING_VISIT")

    def test_finalization_io_error_does_not_fake_closure_and_can_retry(self):
        case = self.verifying()
        with patch("steward.machine_memory.save_machine", side_effect=OSError("Disk full")):
            self.assertEqual(self.request(f"/api/cases/{case['case_id']}/verification", {"working": True})[0], 500)
        _, current = self.request(f"/api/cases/{case['case_id']}")
        self.assertEqual(current["state"], "RESOLVED")
        self.assertFalse(current["memory_updated"])
        closed = self.advance(current)
        self.assertEqual(closed["state"], "CLOSED")
        self.assertEqual(self.request("/api/machines/WM-001")[1]["cumulative_repair_spend"], 2100)

    def test_memory_survives_application_restart(self):
        case = self.verifying()
        self.request(f"/api/cases/{case['case_id']}/verification", {"working": True})
        restarted = DemoApplication(self.application.data_dir)
        self.assertEqual(restarted.machine("WM-001")["cumulative_repair_spend"], 2100)
        with self.assertRaises(LookupError):
            restarted.snapshot(case["case_id"])

    def test_reset_requires_confirmation_and_only_resets_runtime(self):
        case = self.verifying()
        self.request(f"/api/cases/{case['case_id']}/verification", {"working": True})
        self.assertEqual(self.request("/api/demo/reset", {"confirm": False})[0], 422)
        status, memory = self.request("/api/demo/reset", {"confirm": True})
        self.assertEqual(status, 200)
        self.assertEqual(memory["cumulative_repair_spend"], 1200)
        self.assertEqual(self.request(f"/api/cases/{case['case_id']}")[0], 404)

    def test_cross_origin_mutation_rejected(self):
        status, _ = self.request("/api/cases", {"machine_id": "WM-001", "issue": "Broken"},
                                 {"Origin": "https://untrusted.example"})
        self.assertEqual(status, 403)

    def test_canonical_directory_cannot_be_used_as_demo_runtime(self):
        with self.assertRaises(ValueError):
            DemoApplication(DEFAULT_MACHINES_DIR)
