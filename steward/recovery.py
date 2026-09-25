"""Explicit recovery plans preserve the original service case and its evidence."""
from dataclasses import dataclass

from steward.commitments import create_commitment, mark_breached
from steward.models import CaseState as S, Commitment, CommitmentStatus, Machine, PaymentStatus, Record, ServiceCase
from steward.repair_policy import evaluate_repair_vs_replace
from steward.states import require_state, transition_state


@dataclass
class RecoveryPlan(Record):
    reason: str
    recommended_next_state: S
    follow_up_action: str
    requires_human: bool = False
    preserve_case_id: bool = True


def handle_no_show(case: ServiceCase, evidence: str) -> RecoveryPlan:
    require_state(case, S.AWAITING_VISIT)
    if not evidence.strip():
        raise ValueError("No-show needs evidence")
    transition_state(case, S.NO_SHOW, "Technician did not arrive", evidence)
    for commitment in case.active_commitments:
        if case.appointment and commitment.commitment_id == case.appointment.commitment_id:
            mark_breached(commitment, evidence)
    return RecoveryPlan("No-show", S.CONTACT_PROVIDER, "Follow up and obtain a replacement appointment")


def handle_commitment_incomplete(case: ServiceCase, commitment: Commitment | None = None,
                                  raw_statement: str | None = None) -> RecoveryPlan:
    require_state(case, S.NEGOTIATING)
    if commitment is None:
        commitment = create_commitment(case.case_id, "provider", "technician_visit", case=case,
            raw_statement=raw_statement, follow_up_action="Obtain concrete date and full time window")
    if commitment.status != CommitmentStatus.INCOMPLETE or commitment.case_id != case.case_id:
        raise ValueError("Expected an incomplete commitment for this case")
    transition_state(case, S.COMMITMENT_INCOMPLETE, "Provider promise lacks concrete details", raw_statement)
    return RecoveryPlan("Incomplete commitment", S.CONTACT_PROVIDER, "Ask for missing details: " + ", ".join(commitment.missing_fields))


def handle_awaiting_part(case: ServiceCase, part_name: str, due_date: str | None = None,
                         time_window: str | None = None, tracking_reference: str | None = None) -> RecoveryPlan:
    require_state(case, S.SERVICE_ATTEMPTED)
    if not part_name.strip():
        raise ValueError("A part name is required")
    create_commitment(case.case_id, "provider", "deliver_part", due_date, time_window,
        reference_id=tracking_reference, require_time_window=False, case=case,
        follow_up_action=f"Track delivery of {part_name}", follow_up_deadline=due_date)
    transition_state(case, S.AWAITING_PART, f"Awaiting part: {part_name}", tracking_reference)
    return RecoveryPlan("Awaiting part", S.CONTACT_PROVIDER, "Confirm part delivery and arrange return visit")


def handle_provider_unreachable(case: ServiceCase, provider_name: str,
                                attempt_number: int = 1, max_attempts: int = 3) -> RecoveryPlan:
    require_state(case, S.CONTACT_PROVIDER)
    transition_state(case, S.PROVIDER_UNREACHABLE, f"Provider unreachable: {provider_name}; attempt {attempt_number}")
    exhausted = attempt_number >= max_attempts
    return RecoveryPlan("Provider unreachable", S.SELECT_RESOLUTION if exhausted else S.CONTACT_PROVIDER,
                        "Select another provider" if exhausted else "Retry provider contact")


def handle_payment_failed(case: ServiceCase, failure_reason: str,
                          requires_user_secret: bool = False) -> RecoveryPlan:
    require_state(case, S.RESOLVED, S.PAYMENT_FAILED)
    if case.current_state == S.RESOLVED:
        transition_state(case, S.PAYMENT_FAILED, "Payment failed", failure_reason)
    case.payment_status = PaymentStatus.FAILED
    return RecoveryPlan(failure_reason, S.HUMAN_APPROVAL_REQUIRED if requires_user_secret else S.RESOLVED,
                        "Household must settle independently; never disclose secrets" if requires_user_secret
                        else "Retry settlement without duplicating payment", requires_user_secret)


def handle_repair_failed(case: ServiceCase, machine: Machine, notes: str | None = None) -> RecoveryPlan:
    require_state(case, S.REPAIR_FAILED)
    policy = evaluate_repair_vs_replace(machine, case.problem, case.quote.amount_inr if case.quote else 0,
                                       repair_just_failed=True, exclude_case_id=case.case_id)
    transition_state(case, S.REASSESS_REPAIR_VS_REPLACE, "; ".join(policy.reasons), notes)
    return RecoveryPlan("Repair failed verification", S.HUMAN_APPROVAL_REQUIRED,
                        "Review diagnosis and repair versus replacement with household", True)


def handle_human_approval_required(case: ServiceCase, reason: str) -> RecoveryPlan:
    transition_state(case, S.HUMAN_APPROVAL_REQUIRED, reason)
    case.human_decision_required = True
    case.human_decision_reason = reason
    return RecoveryPlan(reason, S.HUMAN_APPROVAL_REQUIRED, "Wait for an explicit household decision", True)
