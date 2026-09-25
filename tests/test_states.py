from copy import deepcopy
import unittest

from steward.commitments import create_commitment
from steward.models import CaseState as S, PaymentStatus, ServiceCase, VerificationStatus
from steward.states import (ClosureInvariantError, InvalidStateTransitionError, VALID_TRANSITIONS,
                            transition_state)
from tests.support import CaseTest


class TestStateGraph(unittest.TestCase):
    def test_every_required_state_has_explicit_edges(self):
        self.assertEqual(set(VALID_TRANSITIONS), set(S))
        self.assertEqual(VALID_TRANSITIONS[S.CLOSED], frozenset())
        self.assertEqual([state for state, targets in VALID_TRANSITIONS.items() if S.CLOSED in targets], [S.UPDATE_MEMORY])

    def test_invalid_transition_does_not_mutate_case(self):
        case = ServiceCase("C1", "WM-001", "broken")
        with self.assertRaises(InvalidStateTransitionError):
            transition_state(case, S.RESOLVED, "Skip service")
        self.assertEqual(case.current_state, S.NEW_CASE)
        self.assertEqual(case.state_history, [])

    def test_schedule_requires_appointment_and_authority(self):
        case = ServiceCase("C1", "WM-001", "broken", current_state=S.NEGOTIATING)
        with self.assertRaises(InvalidStateTransitionError):
            transition_state(case, S.SCHEDULED, "Vague promise")


class TestClosureInvariant(CaseTest):
    def ready(self):
        case = self.ready_for_memory()
        self.manager.update_machine_memory(case, repair_date="2026-09-26")
        return case

    def test_all_prerequisites_allow_closure(self):
        case = self.ready()
        self.manager.close_case(case)
        self.assertEqual(case.current_state, S.CLOSED)
        self.assertEqual(case.state_history[-1].from_state, S.UPDATE_MEMORY)

    def test_every_non_final_state_rejects_direct_closure(self):
        ready = self.ready()
        for state in S:
            if state == S.UPDATE_MEMORY:
                continue
            case = deepcopy(ready)
            case.current_state = state
            with self.subTest(state=state), self.assertRaises(ClosureInvariantError):
                transition_state(case, S.CLOSED, "Premature closure")

    def test_each_missing_invariant_blocks_closure(self):
        ready = self.ready()
        variants = {
            "verification": lambda c: setattr(c, "verification_result", None),
            "verification_status": lambda c: setattr(c, "verification_status", VerificationStatus.UNVERIFIED),
            "payment": lambda c: setattr(c, "payment_status", PaymentStatus.PENDING),
            "unpaid_quote": lambda c: setattr(c, "payment_status", PaymentStatus.NOT_DUE),
            "memory": lambda c: setattr(c, "memory_updated", False),
            "issue": lambda c: c.unresolved_issues.append("Coverage not clarified"),
            "approval": lambda c: setattr(c, "human_decision_required", True),
            "commitment": lambda c: create_commitment(c.case_id, "provider", "callback", case=c),
        }
        for name, mutate in variants.items():
            case = deepcopy(ready)
            mutate(case)
            with self.subTest(invariant=name), self.assertRaises(ClosureInvariantError):
                self.manager.close_case(case)
            self.assertEqual(case.current_state, S.UPDATE_MEMORY)

    def test_provider_evidence_cannot_impersonate_household(self):
        case = self.ready()
        case.verification_result.evidence_sources = ["provider_claim"]
        with self.assertRaises(ClosureInvariantError):
            self.manager.close_case(case)
