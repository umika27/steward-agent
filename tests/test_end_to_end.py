from steward.commitments import mark_fulfilled
from steward.demo import SCENARIOS, run_scenario
from steward.machine_memory import load_machine
from steward.models import CaseState as S, AuthorityPolicy
from steward.states import InvalidStateTransitionError
from tests.support import CaseTest


class TestEndToEnd(CaseTest):
    def test_happy_case_closes_with_persisted_history(self):
        case = self.ready_for_memory()
        self.manager.update_machine_memory(case, resolution_summary="Cleared pump", repair_date="2026-09-26")
        self.manager.close_case(case)
        self.assertEqual(case.current_state, S.CLOSED)
        machine = load_machine("WM-001", self.directory)
        self.assertEqual(machine.cumulative_repair_spend, 2100)
        self.assertEqual(machine.repair_history[-1].case_id, case.case_id)
        self.assertTrue(machine.failure_history[-1].resolved)
        self.assertEqual(machine.previous_providers[0].last_used_date, "2026-09-26")
        second = self.manager.open_case("WM-001", "not draining", "NEXT-CASE")
        remembered = self.manager.load_case_memory(second, incident_date="2026-10-01")
        self.assertEqual(remembered.cumulative_repair_spend, 2100)
        self.assertTrue(self.manager.assess_case(second, reference_date="2026-10-01").requires_human_approval)

    def test_over_limit_never_schedules_or_pays_automatically(self):
        case = self.negotiating()
        evaluation, commitment = self.schedule(case, amount=3800)
        self.assertTrue(evaluation.requires_human)
        self.assertIsNone(commitment)
        self.assertEqual(case.current_state, S.HUMAN_APPROVAL_REQUIRED)
        self.assertFalse(case.quote.approved)
        self.assertIsNone(case.appointment)
        with self.assertRaises(InvalidStateTransitionError):
            self.manager.settle_payment(case)
        self.assertFalse(any(r.rail_name == "payments" for r in case.rail_results))

    def test_approved_over_limit_completes(self):
        case = self.negotiating()
        self.schedule(case, amount=3800)
        self.manager.record_approval(case, True, "Household approves quoted ₹3,800 and appointment")
        self.assertEqual(case.current_state, S.SCHEDULED)
        self.assertEqual(case.quote.approved_by, "household")
        self.manager.await_visit(case)
        self.manager.record_service_attempt(case)
        self.manager.record_provider_completion(case)
        self.manager.verify_with_household(case, True)
        self.assertTrue(self.manager.settle_payment(case).success)
        self.manager.resolve_commitments(case, "Household confirms working machine")
        self.manager.update_machine_memory(case)
        self.manager.close_case(case)
        self.assertEqual(load_machine("WM-001", self.directory).cumulative_repair_spend, 5000)

    def test_decline_returns_to_resolution_without_payment(self):
        case = self.negotiating()
        self.schedule(case, amount=3800)
        self.manager.record_approval(case, False, "Too expensive")
        self.assertEqual(case.current_state, S.SELECT_RESOLUTION)
        self.assertFalse(case.quote.approved)
        self.assertFalse(case.human_decision_required)

    def test_approval_not_reused_for_changed_quote(self):
        case = self.negotiating()
        self.schedule(case, amount=3800)
        self.manager.record_approval(case, True, "Approve exactly ₹3,800")
        self.manager.await_visit(case)
        self.manager.record_no_show(case, "Provider absent")
        self.manager.contact_provider(case)
        self.schedule(case, amount=4000, day="2026-10-03")
        self.assertEqual(case.current_state, S.HUMAN_APPROVAL_REQUIRED)
        self.assertFalse(case.quote.approved)

    def test_outside_availability_requires_approval(self):
        case = self.negotiating()
        self.schedule(case, day="2026-09-27")
        self.assertEqual(case.current_state, S.HUMAN_APPROVAL_REQUIRED)
        self.manager.record_approval(case, True, "Sunday appointment accepted")
        self.assertEqual(case.current_state, S.SCHEDULED)

    def test_custom_limit_is_respected_by_orchestrator_and_payment_mock(self):
        self.manager.authority_policy = AuthorityPolicy(repair_limit_inr=2500)
        case = self.negotiating()
        self.schedule(case, amount=2000)
        self.assertEqual(case.quote.approved_by, "authority_engine")
        self.manager.await_visit(case)
        self.manager.record_service_attempt(case)
        self.manager.record_provider_completion(case)
        self.manager.verify_with_household(case, True)
        self.assertTrue(self.manager.settle_payment(case).success)

    def test_call_result_requires_follow_up_for_every_material_question(self):
        case = self.negotiating()
        before = len(case.active_commitments)
        with self.assertRaises(ValueError):
            self.manager.record_call_result(case, {"unresolved_questions": ["Prior repair coverage?"]})
        self.assertEqual(len(case.active_commitments), before)
        result = self.manager.record_call_result(case, {"unresolved_questions": [{
            "question": "Prior repair coverage?", "follow_up_action": "Ask provider for written terms",
            "follow_up_deadline": "2026-09-26"}]})
        self.assertTrue(result.is_mock)
        self.assertEqual(case.active_commitments[-1].raw_statement, "Prior repair coverage?")

    def test_zero_charge_still_requires_verification_and_memory(self):
        case = self.negotiating()
        self.schedule(case, amount=0)
        self.manager.await_visit(case)
        self.manager.record_service_attempt(case)
        self.manager.record_provider_completion(case)
        self.manager.verify_with_household(case, True)
        self.manager.resolve_commitments(case, "Household confirms working machine; no charge")
        self.manager.update_machine_memory(case)
        self.manager.close_case(case)
        self.assertEqual(load_machine("WM-001", self.directory).cumulative_repair_spend, 1200)

    def test_unresolved_coverage_question_survives_service(self):
        case = self.ready_for_memory()
        question = self.manager.preserve_question(case, "Did the previous repair have service coverage?",
            "Ask provider for coverage terms", "2026-09-28")
        self.manager.resolve_commitments(case, "Service worked")
        with self.assertRaises(ValueError):
            self.manager.update_machine_memory(case)
        self.assertEqual(question.follow_up_action, "Ask provider for coverage terms")
        mark_fulfilled(question, "LOCAL TEST evidence: provider supplied written terms; coverage expired")
        self.manager.update_machine_memory(case)
        self.manager.close_case(case)
        self.assertEqual(case.current_state, S.CLOSED)

    def test_failed_repair_does_not_add_successful_repair(self):
        case = self.verifying()
        self.manager.verify_with_household(case, False)
        machine = load_machine("WM-001", self.directory)
        self.assertEqual(len(machine.repair_history), 1)
        self.assertEqual(machine.cumulative_repair_spend, 1200)
        self.assertFalse(machine.failure_history[-1].resolved)

    def test_missing_problem_and_unknown_machine(self):
        with self.assertRaises(ValueError):
            self.manager.open_case("WM-001", " ")
        with self.assertRaises(FileNotFoundError):
            self.manager.open_case("UNKNOWN", "broken")

    def test_duplicate_case_rejected(self):
        self.negotiating()
        with self.assertRaises(ValueError):
            self.manager.open_case("WM-001", "broken", "CASE-TEST")

    def test_all_demos_have_expected_outcomes(self):
        expected = {"happy": ("CLOSED", 2100), "over-limit": ("HUMAN_APPROVAL_REQUIRED", 1200),
                    "no-show": ("CLOSED", 2100), "failed-repair": ("REASSESS_REPAIR_VS_REPLACE", 1200)}
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario):
                result = run_scenario(scenario)
                self.assertEqual((result["state"], result["repair_spend_inr"]), expected[scenario])
                self.assertTrue(result["is_mock"])
