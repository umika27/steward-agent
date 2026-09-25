import unittest

from steward.commitments import (create_commitment, has_unresolved_commitments, mark_breached,
                                 mark_cancelled, mark_fulfilled)
from steward.models import CommitmentStatus as C, ServiceCase


class TestCommitments(unittest.TestCase):
    def commitment(self, **kwargs):
        values = dict(case_id="C1", actor="provider", action="technician_visit",
                      due_date="2026-09-26", time_window="12:00–14:00", amount_inr=900,
                      reference_id="SAM-BLR-99201", follow_up_deadline="2026-09-26T14:00:00")
        values.update(kwargs)
        return create_commitment(**values)

    def test_concrete_appointment_records_terms(self):
        promise = self.commitment()
        self.assertEqual(promise.status, C.PENDING)
        self.assertEqual(promise.amount_inr, 900)
        self.assertEqual(promise.reference_id, "SAM-BLR-99201")
        self.assertEqual(promise.follow_up_deadline, "2026-09-26T14:00:00")

    def test_vague_promise_never_pending(self):
        promise = self.commitment(due_date="kal", time_window=None, raw_statement="kal technician bhej denge")
        self.assertEqual(promise.status, C.INCOMPLETE)
        self.assertEqual(promise.missing_fields, ["due_date", "time_window"])
        with self.assertRaises(ValueError):
            mark_fulfilled(promise, "Provider says done")

    def test_partial_and_invalid_time_windows(self):
        for window in ("twelve to...", "12:00-", "14:00–12:00", "12:70–14:00", "25:00–26:00"):
            with self.subTest(window=window):
                self.assertEqual(self.commitment(time_window=window).status, C.INCOMPLETE)

    def test_missing_actor_and_invalid_date(self):
        promise = self.commitment(actor="", due_date="2026-02-30")
        self.assertIn("actor", promise.missing_fields)
        self.assertIn("due_date", promise.missing_fields)

    def test_breach_blocks_until_recovered(self):
        promise = self.commitment()
        mark_breached(promise, "No technician arrived")
        self.assertTrue(has_unresolved_commitments([promise]))
        mark_cancelled(promise, "Replaced by confirmed appointment C2; old breach retained in case events")
        self.assertFalse(has_unresolved_commitments([promise]))

    def test_fulfillment_and_cancellation_need_evidence(self):
        for operation in (mark_fulfilled, mark_cancelled, mark_breached):
            with self.assertRaises(ValueError):
                operation(self.commitment(), " ")

    def test_commitment_cannot_attach_to_another_case(self):
        with self.assertRaises(ValueError):
            self.commitment(case=ServiceCase("C2", "WM-001", "broken"))

    def test_optional_reference_and_required_reference(self):
        self.assertEqual(self.commitment(reference_id=None).status, C.PENDING)
        self.assertEqual(self.commitment(reference_id=None, require_reference=True).status, C.INCOMPLETE)
