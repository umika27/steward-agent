"""Deterministic, fail-closed household authority. No LLM decisions."""
import re
from datetime import date

from steward.models import AuthorityDecision as D, AuthorityEvaluation, AuthorityPolicy, validate_amount

FORBIDDEN_ACTIONS = frozenset({"fabricate_consent", "fabricated_consent", "bypass_authority",
                              "spend_beyond_authority", "share_secret", "disclose_credential"})
AUTONOMOUS_ROUTINE_ACTIONS = frozenset({"contact_provider", "obtain_quote", "routine_follow_up",
    "chase_no_show", "verify_outcome", "verification", "update_machine_memory", "machine_memory_update"})
HUMAN_ESCALATION_ACTIONS = frozenset({"replacement", "replace_machine", "purchase_replacement",
    "material_diagnosis_change", "materially_different_diagnosis", "exceptional_home_access",
    "schedule_outside_availability"})


class AuthorityEngine:
    def __init__(self, policy: AuthorityPolicy | None = None):
        self.policy = policy or AuthorityPolicy()

    def is_sensitive_secret(self, secret_type: str) -> bool:
        words = re.sub(r"[^A-Z0-9]+", "_", secret_type.upper()).strip("_")
        # Safety restrictions cannot be disabled by a configurable policy.
        return any(secret in words.split("_") or secret in words
                   for secret in set(AuthorityPolicy().forbidden_secret_types + self.policy.forbidden_secret_types))

    def can_approve_repair(self, amount_inr: int) -> AuthorityEvaluation:
        try:
            validate_amount(amount_inr)
        except ValueError:
            return AuthorityEvaluation(D.DENY, "approve_repair", "Invalid repair amount")
        allowed = amount_inr <= self.policy.repair_limit_inr
        return AuthorityEvaluation(D.ALLOW if allowed else D.ASK_HUMAN, "approve_repair",
            f"Quote ₹{amount_inr} {'is within' if allowed else 'exceeds'} automatic limit ₹{self.policy.repair_limit_inr}",
            amount_inr, self.policy.repair_limit_inr)

    def can_schedule(self, appointment_date: str, time_window: str) -> AuthorityEvaluation:
        from steward.commitments import concrete_date, concrete_time_window
        if concrete_date(appointment_date) and concrete_time_window(time_window):
            day = date.fromisoformat(appointment_date).strftime("%A")
            start, end = re.split(r"\s*[-–]\s*", time_window)
            for availability in self.policy.allowed_availability_windows:
                parts = availability.split(maxsplit=1)
                if len(parts) == 2 and parts[0] == day and concrete_time_window(parts[1]):
                    lower, upper = re.split(r"\s*[-–]\s*", parts[1])
                    if lower <= start < end <= upper:
                        return AuthorityEvaluation(D.ALLOW, "schedule_visit", "Appointment is within household availability")
        return AuthorityEvaluation(D.ASK_HUMAN, "schedule_visit", "Appointment needs household availability approval")

    def validate_action(self, action: str, context: dict | None = None) -> AuthorityEvaluation:
        action = re.sub(r"[\s-]+", "_", action.strip().lower())
        context = context or {}
        if (action in FORBIDDEN_ACTIONS or self.is_sensitive_secret(action)
                or self.is_sensitive_secret(str(context.get("secret_type", context.get("credential_type", ""))))
                or context.get("fabricate_consent")):
            return AuthorityEvaluation(D.DENY, action, "Secrets, fabricated consent and authority bypass are forbidden")
        if (action in HUMAN_ESCALATION_ACTIONS or context.get("is_replacement")
                or context.get("material_diagnosis_change") or context.get("exceptional_home_access")):
            return AuthorityEvaluation(D.ASK_HUMAN, action, "Explicit household approval is required")
        if action in ("repair", "approve_repair", "authorize_payment", "pay_repair"):
            amount = context.get("amount_inr", context.get("amount"))
            if amount is None:
                return AuthorityEvaluation(D.ASK_HUMAN, action, "A concrete quote is required")
            return self.can_approve_repair(amount)
        if action in ("schedule_visit", "reschedule_visit", "reschedule", "schedule_within_availability"):
            if context.get("outside_allowed_availability"):
                return AuthorityEvaluation(D.ASK_HUMAN, action, "Household availability needs confirmation")
            return self.can_schedule(context.get("appointment_date", ""), context.get("time_window", ""))
        if action in AUTONOMOUS_ROUTINE_ACTIONS:
            return AuthorityEvaluation(D.ALLOW, action, "Routine case management is pre-authorized")
        return AuthorityEvaluation(D.ASK_HUMAN, action, "Unknown action requires human review")

    def requires_human(self, action: str, context: dict | None = None) -> bool:
        return self.validate_action(action, context).requires_human


def can_approve_repair(amount_inr: int, policy: AuthorityPolicy | None = None) -> AuthorityEvaluation:
    return AuthorityEngine(policy).can_approve_repair(amount_inr)


def validate_action(action: str, context: dict | None = None, policy: AuthorityPolicy | None = None) -> AuthorityEvaluation:
    return AuthorityEngine(policy).validate_action(action, context)


def is_sensitive_secret(secret_type: str, policy: AuthorityPolicy | None = None) -> bool:
    return AuthorityEngine(policy).is_sensitive_secret(secret_type)
