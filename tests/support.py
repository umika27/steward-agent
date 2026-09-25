from pathlib import Path
import shutil
import tempfile
import unittest

from steward.case_manager import CaseManager
from steward.machine_memory import DEFAULT_MACHINES_DIR

PROVIDER = "Samsung Authorised Service - Indiranagar"


class CaseTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="steward-test-")
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.fixture = DEFAULT_MACHINES_DIR / "WM-001.json"
        self.original = self.fixture.read_bytes()
        self.addCleanup(lambda: self.assertEqual(self.fixture.read_bytes(), self.original))
        shutil.copy2(self.fixture, self.directory / "WM-001.json")
        self.manager = CaseManager(self.directory)

    def negotiating(self, case_id="CASE-TEST"):
        case = self.manager.open_case("WM-001", "My washing machine isn't draining", case_id)
        self.manager.load_case_memory(case, incident_date="2026-09-25")
        self.manager.assess_case(case, reference_date="2026-09-25")
        self.manager.contact_provider(case)
        return case

    def schedule(self, case, amount=900, day="2026-09-26", window="12:00–14:00"):
        return self.manager.negotiate_and_schedule(case, PROVIDER, amount, "Drain pump blockage",
            day, window, "SAM-BLR-99201")

    def verifying(self):
        case = self.negotiating()
        self.schedule(case)
        self.manager.await_visit(case)
        self.manager.record_service_attempt(case)
        self.manager.record_provider_completion(case)
        return case

    def resolved(self):
        case = self.verifying()
        self.manager.verify_with_household(case, True)
        return case

    def ready_for_memory(self):
        case = self.resolved()
        self.manager.settle_payment(case)
        self.manager.resolve_commitments(case, "Household observed working drainage after technician visit")
        return case
