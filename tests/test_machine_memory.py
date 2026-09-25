from unittest.mock import patch

from steward.machine_memory import (detect_repeated_fault, load_machine, record_failure,
                                    record_repair, save_machine)
from steward.models import AMCRecord, CaseState as S, Machine
from tests.support import CaseTest


class TestMachineMemory(CaseTest):
    def test_fixture_round_trip_preserves_typed_history(self):
        machine = load_machine("WM-001", self.directory)
        self.assertEqual(machine.warranty.status, "EXPIRED")
        self.assertEqual(machine.repair_history[0].cost_inr, 1200)
        machine.amc = AMCRecord("AMC-1", "local provider", "ACTIVE", "2027-01-01")
        save_machine(machine, self.directory)
        self.assertEqual(load_machine("WM-001", self.directory), machine)
        self.assertEqual(Machine.from_dict(machine.to_dict()), machine)

    def test_append_failure_idempotently_and_detect_recurrence(self):
        machine = load_machine("WM-001", self.directory)
        for _ in range(2):
            record_failure(machine, "C2", "not draining", incident_date="2026-09-25")
        self.assertEqual(len(machine.failure_history), 2)
        repeats = detect_repeated_fault(machine, "not draining", reference_date="2026-09-25", exclude_case_id="C2")
        self.assertEqual(repeats["prior_occurrences"], 1)
        self.assertEqual(repeats["recent_occurrences_within_window"], 1)

    def test_verified_repair_updates_spend_exactly_once(self):
        machine = load_machine("WM-001", self.directory)
        record_failure(machine, "C2", "not draining")
        for _ in range(2):
            record_repair(machine, "C2", "not draining", "Cleared pump", 900, "provider", verified_by_household=True)
        self.assertEqual(machine.cumulative_repair_spend, 2100)
        self.assertEqual(len(machine.repair_history), 2)
        self.assertTrue(machine.failure_history[-1].resolved)

    def test_unverified_repair_and_conflicting_replay_rejected(self):
        machine = load_machine("WM-001", self.directory)
        with self.assertRaises(ValueError):
            record_repair(machine, "C2", "broken", "Claim only", 900, "provider")
        record_repair(machine, "C2", "broken", "Fixed", 900, "provider", verified_by_household=True)
        with self.assertRaises(ValueError):
            record_repair(machine, "C2", "broken", "Fixed", 3800, "provider", verified_by_household=True)
        self.assertEqual(machine.cumulative_repair_spend, 2100)

    def test_unknown_machine_and_path_traversal_rejected(self):
        with self.assertRaises(FileNotFoundError):
            load_machine("UNKNOWN", self.directory)
        with self.assertRaises(ValueError):
            load_machine("../WM-001", self.directory)

    def test_corrupt_memory_has_clear_error(self):
        (self.directory / "WM-001.json").write_text("{")
        with self.assertRaisesRegex(ValueError, "Invalid machine memory"):
            load_machine("WM-001", self.directory)

    def test_atomic_write_failure_preserves_prior_file(self):
        machine = load_machine("WM-001", self.directory)
        before = (self.directory / "WM-001.json").read_bytes()
        machine.current_lifecycle_status = "UNDER_REPAIR"
        with patch("steward.machine_memory.os.replace", side_effect=OSError("Disk failure")):
            with self.assertRaises(OSError):
                save_machine(machine, self.directory)
        self.assertEqual((self.directory / "WM-001.json").read_bytes(), before)
        self.assertEqual(list(self.directory.glob(".machine-*.tmp")), [])

    def test_failed_save_cannot_mark_case_memory_updated(self):
        case = self.ready_for_memory()
        with patch("steward.machine_memory.save_machine", side_effect=OSError("Disk full")):
            with self.assertRaises(OSError):
                self.manager.update_machine_memory(case)
        self.assertFalse(case.memory_updated)
        self.assertEqual(case.current_state, S.RESOLVED)
        self.assertEqual(load_machine("WM-001", self.directory).cumulative_repair_spend, 1200)

    def test_dry_run_does_not_satisfy_memory_closure_requirement(self):
        case = self.ready_for_memory()
        preview = self.manager.update_machine_memory(case, persist=False)
        self.assertEqual(preview.cumulative_repair_spend, 2100)
        self.assertFalse(case.memory_updated)
        self.assertEqual(load_machine("WM-001", self.directory).cumulative_repair_spend, 1200)
