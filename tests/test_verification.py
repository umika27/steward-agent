import unittest

from steward.models import CaseState as S, VerificationStatus as V
from steward.states import ClosureInvariantError, InvalidStateTransitionError
from steward.verifier import verify_outcome
from tests.support import CaseTest


class TestVerification(unittest.TestCase):
    def test_provider_claim_is_not_verification(self):
        result = verify_outcome(provider_reports_complete=True)
        self.assertFalse(result.verified)
        self.assertEqual(result.status, V.PENDING_HOUSEHOLD)
        self.assertNotIn("household_confirmation", result.evidence_sources)

    def test_household_observation_succeeds(self):
        self.assertTrue(verify_outcome(household_confirms_working=True).verified)

    def test_failure_wins_over_contradictory_positive(self):
        result = verify_outcome(True, True, household_reports_broken=True)
        self.assertFalse(result.verified)
        self.assertEqual(result.status, V.REPAIR_FAILED)


class TestVerificationFlow(CaseTest):
    def test_provider_completion_cannot_close_or_pay(self):
        case = self.verifying()
        self.assertEqual(case.current_state, S.VERIFYING)
        with self.assertRaises(ClosureInvariantError):
            self.manager.close_case(case)
        with self.assertRaises(InvalidStateTransitionError):
            self.manager.settle_payment(case)

    def test_yes_enters_resolved_not_closed(self):
        case = self.verifying()
        self.manager.verify_with_household(case, True)
        self.assertEqual(case.current_state, S.RESOLVED)
        self.assertFalse(case.memory_updated)

    def test_no_records_failure_and_reassessment(self):
        case = self.verifying()
        self.manager.verify_with_household(case, False)
        self.assertEqual(case.current_state, S.REASSESS_REPAIR_VS_REPLACE)
        self.assertEqual(case.state_history[-2].to_state, S.REPAIR_FAILED)
        self.assertFalse(case.verification_result.verified)

    def test_non_boolean_observation_rejected_without_mutation(self):
        case = self.verifying()
        for value in ("false", 1, None):
            with self.assertRaises(ValueError):
                self.manager.verify_with_household(case, value)
        self.assertEqual(case.current_state, S.VERIFYING)
        self.assertEqual(case.verification_status, V.PENDING_HOUSEHOLD)

    def test_invalid_completion_does_not_mutate_case(self):
        case = self.negotiating()
        with self.assertRaises(InvalidStateTransitionError):
            self.manager.record_provider_completion(case)
        self.assertFalse(case.provider_reported_complete)
