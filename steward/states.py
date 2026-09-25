"""Validated state transitions and the four-part closure invariant."""
from steward.commitments import concrete_date, concrete_time_window, has_unresolved_commitments
from steward.models import (CaseEvent, CaseState as S, CommitmentStatus, PaymentStatus,
                            ServiceCase, VerificationStatus, utc_now_iso)


class StewardStateError(ValueError):
    pass


class InvalidStateTransitionError(StewardStateError):
    pass


class ClosureInvariantError(StewardStateError):
    pass


VALID_TRANSITIONS = {
    S.NEW_CASE: frozenset({S.LOAD_MEMORY}),
    S.LOAD_MEMORY: frozenset({S.ASSESS}),
    S.ASSESS: frozenset({S.SELECT_RESOLUTION, S.REASSESS_REPAIR_VS_REPLACE}),
    S.SELECT_RESOLUTION: frozenset({S.CONTACT_PROVIDER, S.HUMAN_APPROVAL_REQUIRED}),
    S.CONTACT_PROVIDER: frozenset({S.NEGOTIATING, S.PROVIDER_UNREACHABLE}),
    S.NEGOTIATING: frozenset({S.SCHEDULED, S.COMMITMENT_INCOMPLETE, S.HUMAN_APPROVAL_REQUIRED}),
    S.COMMITMENT_INCOMPLETE: frozenset({S.CONTACT_PROVIDER, S.NEGOTIATING}),
    S.SCHEDULED: frozenset({S.AWAITING_VISIT}),
    S.AWAITING_VISIT: frozenset({S.SERVICE_ATTEMPTED, S.NO_SHOW}),
    S.NO_SHOW: frozenset({S.CONTACT_PROVIDER}),
    S.SERVICE_ATTEMPTED: frozenset({S.VERIFYING, S.AWAITING_PART}),
    S.AWAITING_PART: frozenset({S.CONTACT_PROVIDER}),
    S.VERIFYING: frozenset({S.RESOLVED, S.REPAIR_FAILED}),
    S.REPAIR_FAILED: frozenset({S.REASSESS_REPAIR_VS_REPLACE}),
    S.REASSESS_REPAIR_VS_REPLACE: frozenset({S.HUMAN_APPROVAL_REQUIRED, S.SELECT_RESOLUTION}),
    S.HUMAN_APPROVAL_REQUIRED: frozenset({S.NEGOTIATING, S.SELECT_RESOLUTION, S.RESOLVED}),
    S.PROVIDER_UNREACHABLE: frozenset({S.CONTACT_PROVIDER, S.SELECT_RESOLUTION}),
    S.RESOLVED: frozenset({S.UPDATE_MEMORY, S.PAYMENT_FAILED}),
    S.PAYMENT_FAILED: frozenset({S.RESOLVED, S.HUMAN_APPROVAL_REQUIRED}),
    S.UPDATE_MEMORY: frozenset({S.CLOSED}),
    S.CLOSED: frozenset(),
}


def get_valid_transitions(state: S) -> frozenset[S]:
    return VALID_TRANSITIONS[state]


def is_valid_transition(from_state: S, to_state: S) -> bool:
    return to_state in get_valid_transitions(from_state)


def independently_verified(case: ServiceCase) -> bool:
    result = case.verification_result
    return bool(result and result.verified is True and result.household_confirms_working is True
                and "household_confirmation" in result.evidence_sources
                and result.status == VerificationStatus.VERIFIED
                and case.verification_status == VerificationStatus.VERIFIED)


def evaluate_closure_invariant(case: ServiceCase) -> tuple[bool, list[str]]:
    errors = []
    if not independently_verified(case):
        errors.append("Physical outcome is not independently verified by the household")
    if case.payment_status not in (PaymentStatus.SETTLED, PaymentStatus.NOT_DUE):
        errors.append("Financial obligations are not settled")
    if case.quote and case.quote.amount_inr > 0 and case.payment_status != PaymentStatus.SETTLED:
        errors.append("Quoted service obligation remains unpaid")
    if not case.memory_updated:
        errors.append("Machine memory has not been updated")
    if has_unresolved_commitments(case) or case.unresolved_issues:
        errors.append("Material commitments or questions remain unresolved")
    if case.human_decision_required:
        errors.append("Human approval remains outstanding")
    return not errors, errors


def enforce_closure_invariant(case: ServiceCase) -> None:
    ok, errors = evaluate_closure_invariant(case)
    if not ok:
        raise ClosureInvariantError("Cannot close case: " + "; ".join(errors))


def require_state(case: ServiceCase, *states: S) -> None:
    if case.current_state not in states:
        raise InvalidStateTransitionError(f"Operation not permitted in {case.current_state.value}; "
                                          f"expected {', '.join(s.value for s in states)}")


def transition_state(case: ServiceCase, to_state: S, reason: str,
                     evidence: str | None = None, actor: str = "steward") -> CaseEvent:
    if to_state == S.CLOSED:
        if case.current_state != S.UPDATE_MEMORY:
            raise ClosureInvariantError("Closure requires VERIFYING -> RESOLVED -> UPDATE_MEMORY -> CLOSED")
        enforce_closure_invariant(case)
    if not is_valid_transition(case.current_state, to_state):
        raise InvalidStateTransitionError(f"Invalid transition {case.current_state.value} -> {to_state.value}")
    if to_state == S.SCHEDULED:
        appointment = case.appointment
        commitment = next((c for c in case.active_commitments
                           if appointment and c.commitment_id == appointment.commitment_id), None)
        if not (appointment and appointment.confirmed and concrete_date(appointment.date)
                and concrete_time_window(appointment.time_window) and commitment
                and commitment.status == CommitmentStatus.PENDING and case.quote and case.quote.approved
                and not case.human_decision_required):
            raise InvalidStateTransitionError("Scheduling requires an authorized quote and concrete appointment commitment")
    if to_state in (S.RESOLVED, S.UPDATE_MEMORY) and not independently_verified(case):
        raise InvalidStateTransitionError("Independent household verification is required")
    event = CaseEvent(case.current_state, to_state, utc_now_iso(), reason, evidence, actor)
    case.current_state = to_state
    case.state_history.append(event)
    return event
