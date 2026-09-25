import unittest

from steward.machine_memory import load_machine
from steward.models import RepairPolicyDecision as D
from steward.repair_policy import evaluate_repair_vs_replace


class TestRepairPolicy(unittest.TestCase):
    def test_young_machine_cheap_first_repair(self):
        result = evaluate_repair_vs_replace(machine_age_years=2, current_quote_inr=900)
        self.assertEqual(result.decision, D.CONTINUE_REPAIR)
        self.assertFalse(result.requires_human_approval)
        self.assertTrue(result.reasons)

    def test_fixture_prior_repair_does_not_force_replacement(self):
        result = evaluate_repair_vs_replace(load_machine("WM-001"), "not draining", 900,
                                            reference_date="2026-09-25")
        self.assertEqual(result.decision, D.CONTINUE_REPAIR)
        self.assertEqual(result.metrics["recent_same_fault_count"], 1)
        self.assertEqual(result.metrics["projected_cumulative_spend_inr"], 2100)

    def test_repeated_recent_fault_reassesses(self):
        result = evaluate_repair_vs_replace(repeated_same_fault_count=2)
        self.assertTrue(result.requires_human_approval)
        self.assertIn("same fault repeated within six months", result.reasons)

    def test_high_spend_or_quote_or_frequency_reassesses(self):
        for args in (dict(cumulative_repair_spend_inr=7000),
                     dict(current_quote_inr=5000, warranty_expired=True),
                     dict(recent_repairs_count=3),
                     dict(current_quote_inr=9000, estimated_replacement_cost_inr=20000)):
            with self.subTest(args=args):
                result = evaluate_repair_vs_replace(**args)
                self.assertEqual(result.decision, D.REASSESS_REPAIR_VS_REPLACE)
                self.assertTrue(result.reasons)

    def test_age_warranty_recurrence_combination(self):
        result = evaluate_repair_vs_replace(machine_age_years=7, warranty_expired=True,
            repeated_same_fault_count=1, cumulative_repair_spend_inr=3000, current_quote_inr=900)
        self.assertTrue(result.requires_human_approval)
        self.assertTrue(any("machine age" in reason for reason in result.reasons))

    def test_failed_repair_always_reassesses(self):
        self.assertTrue(evaluate_repair_vs_replace(repair_just_failed=True).requires_human_approval)

    def test_unknown_replacement_cost_does_not_divide_by_zero(self):
        result = evaluate_repair_vs_replace(estimated_replacement_cost_inr=0)
        self.assertIsNone(result.metrics["spend_to_replacement_ratio"])
