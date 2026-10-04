"""Browser demo use cases. Compose CaseManager; never assign domain states.

Only provider inputs are scripted. Every decision and transition is made by the
existing domain. The fixed dates deliberately match the retained demo fixture.
"""
from pathlib import Path
from threading import RLock

from steward.case_manager import CaseManager
from steward.machine_memory import DEFAULT_MACHINES_DIR, load_machine, save_machine
from steward.models import CaseState as S
from steward.states import InvalidStateTransitionError, require_state

SCENARIOS = ("happy", "over-limit", "no-show", "failed-repair")
LABELS = {
    S.NEW_CASE: "Issue reported", S.LOAD_MEMORY: "Reviewing machine history",
    S.ASSESS: "Assessing the problem", S.SELECT_RESOLUTION: "Choosing a resolution",
    S.CONTACT_PROVIDER: "Contacting service provider", S.NEGOTIATING: "Arranging service",
    S.COMMITMENT_INCOMPLETE: "Waiting for concrete appointment details",
    S.SCHEDULED: "Technician scheduled", S.AWAITING_VISIT: "Waiting for technician",
    S.NO_SHOW: "Technician did not arrive", S.AWAITING_PART: "Waiting for a part",
    S.SERVICE_ATTEMPTED: "Service visit completed", S.VERIFYING: "Waiting for household verification",
    S.HUMAN_APPROVAL_REQUIRED: "Your approval is needed", S.PAYMENT_FAILED: "Payment needs attention",
    S.PROVIDER_UNREACHABLE: "Provider could not be reached", S.REPAIR_FAILED: "Repair did not resolve the issue",
    S.REASSESS_REPAIR_VS_REPLACE: "Reassessing repair vs replacement",
    S.RESOLVED: "Problem verified as resolved", S.UPDATE_MEMORY: "Updating machine history",
    S.CLOSED: "Case closed",
}


class DemoApplication:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        if self.data_dir.resolve() == DEFAULT_MACHINES_DIR.resolve():
            raise ValueError("The browser demo must use a separate runtime memory directory")
        self.lock = RLock()
        self.scenarios: dict[str, str] = {}
        self.declined: set[str] = set()
        self.manager = CaseManager(self.data_dir)
        if not (self.data_dir / "WM-001.json").exists():
            save_machine(load_machine("WM-001"), self.data_dir)

    def machine(self, machine_id: str) -> dict:
        return load_machine(machine_id, self.data_dir).to_dict()

    def case(self, case_id: str):
        try:
            return self.manager.cases[case_id]
        except KeyError as exc:
            raise LookupError("Case not found. Cases are in memory; the API may have restarted.") from exc

    def create(self, machine_id: str, issue: str, scenario: str = "happy") -> dict:
        if scenario not in SCENARIOS:
            raise ValueError("Unknown local demo scenario")
        case = self.manager.open_case(machine_id, issue)
        self.scenarios[case.case_id] = scenario
        self.manager.load_case_memory(case, incident_date="2026-09-25")
        self.manager.assess_case(case, reference_date="2026-09-25")
        return self.snapshot(case.case_id)

    def _schedule(self, case, reschedule: bool = False) -> None:
        contact = self.manager.contact_provider(case)
        if not contact.success:
            return
        # Internal LOCAL MOCK data, not a Gnani response or vendor API schema.
        result = self.manager.record_call_result(case, {"proposal": {
            "provider_name": "Samsung Authorised Service - Indiranagar",
            "quote_amount_inr": 3800 if self.scenarios[case.case_id] == "over-limit" else 900,
            "diagnosis": "[MOCK] Drainage blockage",
            "appointment_date": "2026-10-03" if reschedule else "2026-09-26",
            "time_window": "12:00–14:00",
            "reference_number": "MOCK-RESCHEDULE-001" if reschedule else "SAM-BLR-99201",
        }, "unresolved_questions": []})
        if not result.success:
            raise ValueError("Mock provider result failed; no appointment confirmed")
        self.manager.negotiate_and_schedule(case, **result.payload["proposal"])
        if case.current_state == S.SCHEDULED:
            self.manager.await_visit(case)

    def advance(self, case_id: str, expected_state: str | None = None) -> dict:
        case = self.case(case_id)
        self._check_expected(case, expected_state)
        if case_id in self.declined:
            raise InvalidStateTransitionError("Proposal was declined; no further provider action is authorized")
        if case.current_state == S.SELECT_RESOLUTION:
            self._schedule(case)
        elif case.current_state in (S.NO_SHOW, S.PROVIDER_UNREACHABLE):
            self._schedule(case, reschedule=case.current_state == S.NO_SHOW)
        elif case.current_state == S.AWAITING_VISIT:
            had_no_show = any(event.to_state == S.NO_SHOW for event in case.state_history)
            if self.scenarios[case_id] == "no-show" and not had_no_show:
                self.manager.record_no_show(case, "[MOCK] Household waited; technician did not arrive")
            else:
                result = self.manager.voice.receive_call_result({
                    "provider_reports_complete": True, "notes": "[MOCK] Drain pump and hose cleared"})
                case.rail_results.append(result)
                if not result.success:
                    raise ValueError("Mock provider completion failed")
                self.manager.record_service_attempt(case, "[MOCK] Technician visit completed")
                self.manager.record_provider_completion(case, result.payload["notes"])
        elif case.current_state in (S.RESOLVED, S.PAYMENT_FAILED, S.UPDATE_MEMORY):
            self._finalize(case)
        else:
            raise InvalidStateTransitionError("Demo cannot advance here. Respond to the household decision if requested.")
        return self.snapshot(case_id)

    def approve(self, case_id: str, approved: bool, expected_state: str | None = None) -> dict:
        case = self.case(case_id)
        self._check_expected(case, expected_state)
        self.manager.record_approval(case, approved, "Household browser decision: " + ("approve" if approved else "reject"))
        if approved and case.current_state == S.SCHEDULED:
            self.manager.await_visit(case)
        if not approved:
            self.declined.add(case_id)
        return self.snapshot(case_id)

    def verify(self, case_id: str, working: bool, expected_state: str | None = None) -> dict:
        case = self.case(case_id)
        self._check_expected(case, expected_state)
        require_state(case, S.SERVICE_ATTEMPTED, S.VERIFYING)
        if case.current_state == S.SERVICE_ATTEMPTED:
            self.manager.record_provider_completion(case, "[MOCK] Provider reported completed visit")
        self.manager.verify_with_household(case, working, household_notes=(
            "Household browser observation: draining normally" if working else "Household browser observation: problem remains"))
        if working:
            self._finalize(case)
        return self.snapshot(case_id)

    def _finalize(self, case) -> None:
        # A retry resumes after failed I/O; it does not re-verify or duplicate a payment.
        if case.current_state in (S.RESOLVED, S.PAYMENT_FAILED):
            result = self.manager.settle_payment(case)
            if not result.success:
                return
            self.manager.resolve_commitments(case, "Household verified working drainage after the mock visit")
            self.manager.update_machine_memory(case, resolution_summary="[MOCK] Cleared drain pump and hose",
                repair_date=case.appointment.date)
        if case.current_state == S.UPDATE_MEMORY:
            self.manager.close_case(case)

    @staticmethod
    def _check_expected(case, expected_state: str | None) -> None:
        if expected_state is not None and case.current_state.value != expected_state:
            raise InvalidStateTransitionError("Case changed since this screen loaded. Refresh before trying again.")

    def reset(self) -> dict:
        """Explicit user demo reset; only the isolated WM-001 runtime copy is replaced."""
        save_machine(load_machine("WM-001"), self.data_dir)
        self.manager = CaseManager(self.data_dir)
        self.scenarios.clear()
        self.declined.clear()
        return self.machine("WM-001")

    def snapshot(self, case_id: str) -> dict:
        case = self.case(case_id)
        state = case.current_state
        actions = {"advance_demo": False, "approval": False, "verification": False}
        next_action = "Review case history"
        if case_id in self.declined:
            next_action = "Proposal rejected; no booking or payment was authorized"
        elif state in (S.SELECT_RESOLUTION, S.NO_SHOW, S.PROVIDER_UNREACHABLE):
            actions["advance_demo"] = True
            next_action = "Reschedule mock visit" if state == S.NO_SHOW else "Arrange mock service"
        elif state == S.AWAITING_VISIT:
            actions["advance_demo"] = True
            next_action = ("Simulate provider no-show" if self.scenarios[case_id] == "no-show"
                and not any(e.to_state == S.NO_SHOW for e in case.state_history) else "Simulate service completion")
        elif state == S.HUMAN_APPROVAL_REQUIRED:
            actions["approval"] = bool(case.quote and not case.quote.approved)
            next_action = case.human_decision_reason or "Household review is required"
        elif state in (S.SERVICE_ATTEMPTED, S.VERIFYING):
            actions["verification"] = True
            next_action = "Is the washing machine draining normally now?"
        elif state in (S.RESOLVED, S.PAYMENT_FAILED, S.UPDATE_MEMORY):
            actions["advance_demo"] = True
            next_action = "Retry finalization"
        elif state == S.REASSESS_REPAIR_VS_REPLACE:
            next_action = "Repair did not resolve the issue. Review repair vs replacement; replacement needs household approval."
        elif state == S.CLOSED:
            next_action = "Household verified resolution. Machine history has been updated."
        result = case.to_dict()
        result.update({"state": state.value, "state_label": LABELS[state], "issue": case.problem,
            "requires_human": case.human_decision_required, "next_action": next_action,
            "actions": actions, "is_demo": True, "scenario": self.scenarios[case_id],
            "timeline": [dict(event.to_dict(), state_label=LABELS[event.to_state]) for event in case.state_history]})
        return result
