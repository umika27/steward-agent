"""Deterministic LOCAL MOCK demos; all writes go to temporary machine memory."""
import argparse
from pathlib import Path
import shutil
import tempfile

from steward.case_manager import CaseManager
from steward.machine_memory import DEFAULT_MACHINES_DIR, load_machine
from steward.models import CaseState
from steward.states import ClosureInvariantError

PROVIDER = "Samsung Authorised Service - Indiranagar"
SCENARIOS = ("happy", "over-limit", "no-show", "failed-repair")


def run_scenario(name: str) -> dict:
    if name not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {name}")
    with tempfile.TemporaryDirectory(prefix="steward-demo-") as directory:
        shutil.copy2(DEFAULT_MACHINES_DIR / "WM-001.json", Path(directory) / "WM-001.json")
        manager = CaseManager(directory)
        case = manager.open_case("WM-001", "My washing machine isn't draining.", f"DEMO-{name}")
        manager.load_case_memory(case, incident_date="2026-09-25")
        manager.assess_case(case, reference_date="2026-09-25")
        manager.contact_provider(case)
        manager.negotiate_and_schedule(case, PROVIDER, 3800 if name == "over-limit" else 900,
            "Drainage blockage", "2026-09-26", "12:00–14:00", "SAM-BLR-99201")
        if name != "over-limit":
            manager.await_visit(case)
            if name == "no-show":
                original_id = case.case_id
                manager.record_no_show(case, "[MOCK] Household waited; technician did not arrive")
                manager.contact_provider(case)
                manager.negotiate_and_schedule(case, PROVIDER, 900, "Drainage blockage",
                    "2026-10-03", "12:00–14:00", "MOCK-RESCHEDULE-001")
                assert case.case_id == original_id
                manager.await_visit(case)
            manager.record_service_attempt(case)
            manager.record_provider_completion(case, "[MOCK] Drain pump cleared")
            assert case.current_state == CaseState.VERIFYING
            try:
                manager.close_case(case)
            except ClosureInvariantError:
                pass
            else:
                raise AssertionError("Provider claim incorrectly permitted closure")
            manager.verify_with_household(case, name != "failed-repair",
                household_notes="Still not draining" if name == "failed-repair" else "Test cycle drains normally")
            if name != "failed-repair":
                manager.settle_payment(case)
                manager.resolve_commitments(case, "Household confirmed completed visit and successful test cycle")
                manager.update_machine_memory(case, resolution_summary="Cleared drain pump and hose",
                                              repair_date="2026-10-03" if name == "no-show" else "2026-09-26")
                manager.close_case(case)
            else:
                try:
                    manager.close_case(case)
                except ClosureInvariantError:
                    pass
                else:
                    raise AssertionError("Failed repair incorrectly permitted closure")
        machine = load_machine("WM-001", directory)
        return {"scenario": name, "state": case.current_state.value,
                "repair_spend_inr": machine.cumulative_repair_spend,
                "states": [event.to_state.value for event in case.state_history],
                "is_mock": True}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scenario", choices=(*SCENARIOS, "all"), nargs="?", default="all")
    args = parser.parse_args()
    for name in SCENARIOS if args.scenario == "all" else (args.scenario,):
        result = run_scenario(name)
        print(f"[LOCAL MOCK] {name}: {result['state']}; cumulative repair spend ₹{result['repair_spend_inr']}")
        print("  " + " -> ".join(result["states"]))


if __name__ == "__main__":
    main()
