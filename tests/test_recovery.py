from steward.commitments import mark_fulfilled
from steward.models import CaseState as S, CommitmentStatus as C, PaymentStatus
from steward.recovery import handle_payment_failed, handle_provider_unreachable
from steward.states import ClosureInvariantError
from rails import MockVoiceRail
from tests.support import CaseTest


class TestRecovery(CaseTest):
    def test_no_show_preserves_case_and_breach_history(self):
        case = self.negotiating()
        _, original = self.schedule(case)
        case_id = case.case_id
        self.manager.await_visit(case)
        plan = self.manager.record_no_show(case, "Technician absent after appointment window")
        self.assertEqual(case.current_state, S.NO_SHOW)
        self.assertEqual(original.status, C.BREACHED)
        self.assertTrue(plan.preserve_case_id)
        self.assertEqual(plan.recommended_next_state, S.CONTACT_PROVIDER)
        self.manager.contact_provider(case)
        self.schedule(case, day="2026-10-03")
        self.assertEqual(case.case_id, case_id)
        self.assertEqual(original.status, C.CANCELLED)
        self.assertIn("Technician absent", original.evidence)
        self.assertTrue(any(event.to_state == S.NO_SHOW for event in case.state_history))

    def test_vague_commitment_recovers_to_concrete_schedule(self):
        case = self.negotiating()
        self.schedule(case, day="kal", window="twelve to...")
        self.assertEqual(case.current_state, S.COMMITMENT_INCOMPLETE)
        self.assertIsNone(case.appointment)
        self.manager.contact_provider(case)
        self.schedule(case)
        self.assertEqual(case.current_state, S.SCHEDULED)
        self.assertEqual(case.active_commitments[0].status, C.CANCELLED)

    def test_provider_unreachable_and_retry(self):
        self.manager.voice = MockVoiceRail(reachable=False)
        case = self.negotiating()
        self.assertEqual(case.current_state, S.PROVIDER_UNREACHABLE)
        self.assertFalse(case.rail_results[-1].success)
        self.manager.voice.reachable = True
        self.manager.contact_provider(case)
        self.assertEqual(case.current_state, S.NEGOTIATING)

    def test_exhausted_contact_plan_selects_another_provider(self):
        case = self.negotiating()
        # Direct recovery unit scenario with provider contact already initiated.
        case.current_state = S.CONTACT_PROVIDER
        plan = handle_provider_unreachable(case, "provider", attempt_number=3)
        self.assertEqual(plan.recommended_next_state, S.SELECT_RESOLUTION)

    def test_awaiting_part_preserves_obligation(self):
        case = self.negotiating()
        self.schedule(case)
        self.manager.await_visit(case)
        self.manager.record_service_attempt(case)
        self.manager.record_awaiting_part(case, "pump", "2026-10-02", "MOCK-PART-1")
        self.assertEqual(case.current_state, S.AWAITING_PART)
        self.assertEqual(case.active_commitments[-1].action, "deliver_part")
        self.assertTrue(case.rail_results[-1].is_mock)
        self.manager.logistics.mark_part_delivered("MOCK-PART-1")
        mark_fulfilled(case.active_commitments[-1], "Household received pump")
        self.manager.contact_provider(case)
        self.schedule(case, day="2026-10-03")
        self.assertEqual(case.current_state, S.SCHEDULED)

    def test_payment_failure_blocks_closure_and_retries(self):
        case = self.resolved()
        self.manager.settle_payment(case, simulate_failure=True)
        self.assertEqual(case.current_state, S.PAYMENT_FAILED)
        self.assertEqual(case.payment_status, PaymentStatus.FAILED)
        with self.assertRaises(ClosureInvariantError):
            self.manager.close_case(case)
        self.manager.settle_payment(case)
        self.assertEqual(case.current_state, S.RESOLVED)
        self.assertEqual(case.payment_status, PaymentStatus.SETTLED)

    def test_secret_needed_for_payment_only_escalates(self):
        case = self.resolved()
        plan = handle_payment_failed(case, "Requires household authentication", requires_user_secret=True)
        self.assertTrue(plan.requires_human)
        self.assertEqual(plan.recommended_next_state, S.HUMAN_APPROVAL_REQUIRED)
        self.assertIn("never disclose", plan.follow_up_action)
