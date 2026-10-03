"""Memory integrity and architecture boundaries for the independent MCP package."""
import ast
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from integrations.steward_mcp.config import Config, REPO_ROOT
from integrations.steward_mcp.memory import CANONICAL_FIXTURE
from integrations.steward_mcp.schemas import ToolFailure
from integrations.steward_mcp.server import Application, CATALOG

PROVIDER = "PRV-SAM-BLR-01"
SLOT = {"date": "2026-10-03", "start_time": "12:00", "end_time": "14:00", "timezone": "Asia/Kolkata"}


def evidence(source="PINE"):
    return {"source": source, "reference": "evaluation-evidence-1",
            "observed_at": "2026-10-03T12:00:00+05:30", "is_simulated": True}


class MCPFixture(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="steward-mcp-test-")
        self.addCleanup(temporary.cleanup)
        self.config = Config(database=Path(temporary.name) / "runtime.sqlite3")
        self.fixture_before = CANONICAL_FIXTURE.read_bytes()
        self.addCleanup(lambda: self.assertEqual(CANONICAL_FIXTURE.read_bytes(), self.fixture_before))
        self.app = Application(self.config)

    def invoke(self, name, **arguments):
        return self.app.invoke(name, arguments).model_dump(mode="json")

    def memory(self):
        return self.invoke("get_machine_memory", machine_id="WM-001")

    def update_arguments(self):
        return {"machine_id": "WM-001", "case_id": "CASE-MCP", "expected_revision": 1,
                "idempotency_key": "memory-1", "updates": [{"type": "append_failure", "record_id": "FAIL-MCP",
                    "date": "2026-10-03", "problem": "not draining", "fault_type": "drainage", "evidence": evidence()}]}

    def quote_arguments(self):
        return {"machine_id": "WM-001", "case_id": "CASE-MCP", "provider_id": PROVIDER,
                "issue_description": "Not draining", "idempotency_key": "quote-1"}

    def quote(self):
        return self.invoke("request_service_quote", **self.quote_arguments())

    def booking_arguments(self, quote):
        return {"machine_id": "WM-001", "case_id": "CASE-MCP", "provider_id": PROVIDER,
                "quote_id": quote["quote_id"], "requested_slot": SLOT, "idempotency_key": "booking-1"}

    def book(self, quote):
        return self.invoke("request_service_appointment", **self.booking_arguments(quote))

    def status(self, booking):
        reference = ({"type": "APPOINTMENT", "id": booking["appointment_id"]} if booking["appointment_id"]
                     else {"type": "APPOINTMENT_REQUEST", "id": booking["request_id"]})
        return self.invoke("get_service_status", reference=reference)

    def assertFailure(self, code, operation, arguments):
        with self.assertRaises(ToolFailure) as caught:
            self.app.invoke(operation, arguments)
        self.assertEqual(caught.exception.code, code)


class TestMCPMemory(MCPFixture):
    def test_seed_load_preferences_and_canonical_untouched(self):
        result = self.memory()
        self.assertEqual(result["revision"], 1)
        self.assertEqual(result["machine"]["brand"], "Samsung")
        self.assertEqual(result["machine"]["cumulative_repair_spend_inr"], 1200)
        self.assertEqual(result["machine"]["household_preferences"]["repair_limit_inr"], 1500)
        self.assertTrue(result["provenance"]["is_simulated"])

    def test_revision_and_replay_survive_restart(self):
        arguments = self.update_arguments()
        first = self.invoke("update_machine_memory", **arguments)
        self.assertEqual(first["revision"], 2)
        self.app = Application(self.config)
        replay = self.invoke("update_machine_memory", **arguments)
        self.assertTrue(replay["replayed"])
        self.assertEqual(replay["revision"], 2)
        self.assertEqual(len(self.memory()["machine"]["prior_failures"]), 2)

    def test_stale_revision_and_changed_idempotent_payload(self):
        arguments = self.update_arguments()
        self.invoke("update_machine_memory", **arguments)
        self.assertFailure("VERSION_CONFLICT", "update_machine_memory", {**arguments, "idempotency_key": "new-key"})
        changed = {**arguments, "case_id": "CASE-DIFFERENT"}
        self.assertFailure("IDEMPOTENCY_CONFLICT", "update_machine_memory", changed)
        self.assertEqual(self.memory()["revision"], 2)

    def test_provider_claim_and_household_observation_are_separate(self):
        arguments = self.update_arguments()
        arguments["updates"] = [
            {"type": "append_service_event", "record_id": "EVENT-1", "event": "PROVIDER_REPORTED_COMPLETE",
             "details": "Provider says pump cleared", "evidence": evidence("PROVIDER")},
            {"type": "append_household_observation", "record_id": "OBS-1", "working": False,
             "notes": "Machine still does not drain", "evidence": evidence("HOUSEHOLD")},
        ]
        self.invoke("update_machine_memory", **arguments)
        machine = self.memory()["machine"]
        self.assertEqual(machine["service_events"][0]["evidence"]["source"], "PROVIDER")
        self.assertFalse(machine["household_observations"][0]["working"])
        self.assertEqual(len(machine["prior_repairs"]), 1)
        self.assertEqual(machine["cumulative_repair_spend_inr"], 1200)

    def test_repair_appends_spend_only_without_resolving_failure(self):
        arguments = self.update_arguments()
        arguments["updates"].append({"type": "append_repair_record", "record_id": "REPAIR-1", "date": "2026-10-03",
            "problem": "not draining", "work_description": "Provider reports replacing pump", "amount_inr": 900,
            "provider_id": PROVIDER, "provider_name": "Simulated provider", "evidence": evidence("PROVIDER")})
        self.invoke("update_machine_memory", **arguments)
        machine = self.memory()["machine"]
        self.assertEqual(machine["cumulative_repair_spend_inr"], 2100)
        self.assertIsNone(machine["prior_repairs"][-1]["household_confirmation_reference"])
        self.assertEqual(machine["household_observations"], [])
        self.assertEqual(machine["prior_failures"][-1]["record_id"], "FAIL-MCP")
        self.assertNotIn("resolved", machine["prior_failures"][-1])

    def test_confirmation_reference_must_point_to_household_record(self):
        arguments = self.update_arguments()
        arguments["updates"] = [{"type": "append_repair_record", "record_id": "REP-NEW", "date": "2026-10-03",
            "problem": "not draining", "work_description": "Pump cleared", "amount_inr": 900,
            "provider_name": "provider", "household_confirmation_reference": "PROVIDER-CLAIM-1", "evidence": evidence()}]
        self.assertFailure("INVALID_ARGUMENT", "update_machine_memory", arguments)
        self.assertEqual(self.memory()["revision"], 1)

    def test_supplied_observation_reference_is_preserved_without_inference(self):
        arguments = self.update_arguments()
        arguments["updates"] = [
            {"type": "append_household_observation", "record_id": "OBS-1", "working": True,
             "notes": "Household reports successful test cycle", "evidence": evidence("HOUSEHOLD")},
            {"type": "append_repair_record", "record_id": "REP-NEW", "date": "2026-10-03",
             "problem": "not draining", "work_description": "Pump cleared", "amount_inr": 900,
             "provider_name": "provider", "household_confirmation_reference": "OBS-1", "evidence": evidence()},
        ]
        self.invoke("update_machine_memory", **arguments)
        machine = self.memory()["machine"]
        self.assertEqual(machine["prior_repairs"][-1]["household_confirmation_reference"], "OBS-1")
        self.assertNotIn("current_state", machine)
        self.assertEqual(len(machine["prior_failures"]), 1)

    def test_atomic_batch_rollback_on_duplicate_record(self):
        arguments = self.update_arguments()
        arguments["updates"] *= 2
        self.assertFailure("INVALID_ARGUMENT", "update_machine_memory", arguments)
        self.assertEqual(self.memory()["revision"], 1)
        self.assertEqual(len(self.memory()["machine"]["prior_failures"]), 1)

    def test_receipt_failure_rolls_back_fact_write(self):
        with patch.object(self.app.storage, "receipt", side_effect=RuntimeError("injected receipt failure")):
            with self.assertRaises(RuntimeError):
                self.app.invoke("update_machine_memory", self.update_arguments())
        self.assertEqual(self.memory()["revision"], 1)
        self.assertEqual(len(self.memory()["machine"]["prior_failures"]), 1)

    def test_concurrent_same_key_writes_once(self):
        arguments = self.update_arguments()
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: self.app.invoke("update_machine_memory", arguments), range(4)))
        self.assertEqual(sum(not result.replayed for result in results), 1)
        self.assertEqual(self.memory()["revision"], 2)

    def test_concurrent_different_keys_reject_lost_update(self):
        def apply(index):
            arguments = self.update_arguments()
            arguments["idempotency_key"] = f"concurrent-{index}"
            arguments["updates"][0]["record_id"] = f"FAIL-{index}"
            try:
                return self.app.invoke("update_machine_memory", arguments).revision
            except ToolFailure as error:
                return error.code
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(apply, range(2)))
        self.assertCountEqual(results, [2, "VERSION_CONFLICT"])

    def test_strict_schema_rejects_injection_and_bad_evidence(self):
        for addition in ({"state": "CLOSED"}, {"expected_revision": True}, {"machine_id": "../WM-001"}):
            with self.subTest(addition=addition), self.assertRaises(ValidationError):
                self.app.invoke("update_machine_memory", {**self.update_arguments(), **addition})
        arguments = self.update_arguments()
        arguments["updates"][0]["evidence"]["observed_at"] = "2026-10-03T12:00:00"
        with self.assertRaises(ValidationError):
            self.app.invoke("update_machine_memory", arguments)
        arguments["updates"] = [{"type": "append_household_observation", "record_id": "OBS-1", "working": True,
                                  "notes": "Provider says it works", "evidence": evidence("PROVIDER")}]
        with self.assertRaises(ValidationError):
            self.app.invoke("update_machine_memory", arguments)

    def test_unknown_machine_is_explicit(self):
        self.assertFailure("NOT_FOUND", "get_machine_memory", {"machine_id": "WM-UNKNOWN"})

    def test_config_rejects_protected_storage_and_unsecured_public_binding(self):
        for directory in ("data/machines", "tmp/ui_runtime", "src", "steward", "integrations"):
            with self.subTest(directory=directory), self.assertRaises(ValueError):
                Config(database=REPO_ROOT / directory / "runtime.sqlite3")
        with self.assertRaises(ValueError):
            Config(host="0.0.0.0")


class TestMCPArchitecture(unittest.TestCase):
    def test_no_legacy_orchestration_imports_or_calls(self):
        forbidden_names = {"CaseManager", "AuthorityEngine", "DemoApplication", "record_repair",
                           "transition_state", "evaluate_repair_vs_replace", "verify_outcome"}
        root = REPO_ROOT / "integrations/steward_mcp"
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    modules = [item.name for item in node.names]
                elif isinstance(node, ast.ImportFrom):
                    modules = [node.module or ""]
                else:
                    modules = []
                for module in modules:
                    self.assertNotIn(module.split(".")[0], {"steward", "rails", "importlib"}, str(path))
                if isinstance(node, ast.Name):
                    self.assertNotIn(node.id, forbidden_names | {"__import__", "eval", "exec"}, str(path))
                if isinstance(node, ast.Attribute):
                    self.assertNotIn(node.attr, forbidden_names, str(path))

    def test_fresh_process_never_loads_legacy_modules(self):
        code = """
import sys, tempfile
from pathlib import Path
from integrations.steward_mcp.config import Config
from integrations.steward_mcp.server import Application
with tempfile.TemporaryDirectory() as directory:
    app = Application(Config(database=Path(directory)/'runtime.sqlite3'))
    app.invoke('get_machine_memory', {'machine_id':'WM-001'})
assert not any(name.split('.')[0] in ('steward', 'rails') for name in sys.modules)
"""
        result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True, cwd=REPO_ROOT)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_exact_catalog_has_no_vendor_payment_or_orchestration_tools(self):
        self.assertEqual(set(CATALOG), {"get_machine_memory", "update_machine_memory", "request_service_quote",
                                        "request_service_appointment", "get_service_status"})
