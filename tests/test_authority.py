import unittest

from steward.authority import AuthorityEngine
from steward.models import AuthorityDecision as D, AuthorityPolicy


class TestAuthority(unittest.TestCase):
    def setUp(self):
        self.engine = AuthorityEngine()

    def test_repair_at_or_below_limit(self):
        for amount in (0, 900, 1500):
            with self.subTest(amount=amount):
                self.assertEqual(self.engine.can_approve_repair(amount).decision, D.ALLOW)

    def test_repair_above_limit(self):
        for amount in (1501, 3800):
            with self.subTest(amount=amount):
                self.assertEqual(self.engine.can_approve_repair(amount).decision, D.ASK_HUMAN)

    def test_invalid_amount_is_denied(self):
        for amount in (-1, True, "900", 900.5, float("nan"), float("inf")):
            with self.subTest(amount=amount):
                self.assertTrue(self.engine.can_approve_repair(amount).denied)

    def test_replacement_always_requires_human(self):
        engine = AuthorityEngine(AuthorityPolicy(replacement_requires_human=False))
        for action in ("replacement", "replace_machine", "purchase_replacement"):
            self.assertTrue(engine.validate_action(action, {"amount_inr": 0}).requires_human)

    def test_sensitive_secrets_never_allowed(self):
        for secret in ("OTP", "PIN", "CVV", "password", "UPI PIN", "authentication secret", "passcode"):
            with self.subTest(secret=secret):
                self.assertTrue(self.engine.validate_action("contact_provider", {"secret_type": secret}).denied)
                self.assertTrue(self.engine.validate_action("share " + secret).denied)

    def test_safety_cannot_be_disabled_by_policy(self):
        engine = AuthorityEngine(AuthorityPolicy(forbidden_secret_types=()))
        self.assertTrue(engine.validate_action("share_otp").denied)

    def test_unknown_and_missing_amount_escalate(self):
        self.assertTrue(self.engine.validate_action("unknown").requires_human)
        self.assertTrue(self.engine.validate_action("repair").requires_human)

    def test_consent_fabrication_and_bypass_denied(self):
        for action in ("fabricate_consent", "bypass_authority", "spend_beyond_authority"):
            self.assertTrue(self.engine.validate_action(action).denied)

    def test_material_changes_and_exceptional_access_escalate(self):
        for key in ("material_diagnosis_change", "exceptional_home_access", "is_replacement"):
            self.assertTrue(self.engine.validate_action("contact_provider", {key: True}).requires_human)

    def test_scheduling_uses_actual_day_and_bounds(self):
        self.assertTrue(self.engine.can_schedule("2026-09-26", "12:00–14:00").allowed)
        for day, window in (("2026-09-27", "12:00–14:00"), ("2026-09-26", "08:00–12:00"),
                            ("2026-09-26", "12:00–18:00"), ("tomorrow", "12:00–14:00")):
            self.assertTrue(self.engine.can_schedule(day, window).requires_human)

    def test_custom_policy_limit(self):
        self.assertTrue(AuthorityEngine(AuthorityPolicy(500)).can_approve_repair(900).requires_human)
