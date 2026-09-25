"""Track concrete promises and unresolved questions; never infer fulfillment."""
from __future__ import annotations

from datetime import date, datetime
import re
from uuid import uuid4

from steward.models import Commitment, CommitmentStatus, ServiceCase, validate_amount


def concrete_date(value: str | None) -> bool:
    try:
        date.fromisoformat(value or "")
        return True
    except (ValueError, TypeError):
        return False


def concrete_time_window(value: str | None) -> bool:
    """Accept an explicit 24-hour range, never partial speech such as 'twelve to'."""
    match = re.fullmatch(r"(\d{2}):(\d{2})\s*[-–]\s*(\d{2}):(\d{2})", value or "")
    if not match:
        return False
    h1, m1, h2, m2 = map(int, match.groups())
    return h1 < 24 and h2 < 24 and m1 < 60 and m2 < 60 and (h1, m1) < (h2, m2)


def evaluate_commitment_completeness(action: str, due_date: str | None,
                                    time_window: str | None, reference_id: str | None = None,
                                    require_time_window: bool = True,
                                    require_reference: bool = False) -> tuple[bool, list[str]]:
    missing = []
    if not action.strip():
        missing.append("action")
    if not concrete_date(due_date):
        missing.append("due_date")
    if require_time_window and not concrete_time_window(time_window):
        missing.append("time_window")
    if require_reference and not (reference_id or "").strip():
        missing.append("reference_id")
    return not missing, missing


def create_commitment(case_id: str, actor: str, action: str,
                      due_date: str | None = None, time_window: str | None = None,
                      source: str = "local_mock", reference_id: str | None = None,
                      evidence: str | None = None, raw_statement: str | None = None,
                      require_time_window: bool = True, require_reference: bool = False,
                      commitment_id: str | None = None, case: ServiceCase | None = None,
                      amount_inr: int | None = None, follow_up_deadline: str | None = None,
                      follow_up_action: str | None = None, material: bool = True) -> Commitment:
    if case is not None and case.case_id != case_id:
        raise ValueError("Commitment belongs to a different case")
    if amount_inr is not None:
        validate_amount(amount_inr)
    if follow_up_deadline:
        datetime.fromisoformat(follow_up_deadline)
    _, missing = evaluate_commitment_completeness(
        action, due_date, time_window, reference_id, require_time_window, require_reference)
    if not actor.strip():
        missing.append("actor")
    commitment = Commitment(
        commitment_id or f"CMT-{uuid4().hex[:12]}", case_id, actor, action, due_date,
        time_window, CommitmentStatus.INCOMPLETE if missing else CommitmentStatus.PENDING,
        source=source, reference_id=reference_id, evidence=evidence,
        raw_statement=raw_statement, missing_fields=missing, amount_inr=amount_inr,
        follow_up_deadline=follow_up_deadline, follow_up_action=follow_up_action, material=material)
    if case is not None:
        case.active_commitments.append(commitment)
    return commitment


def mark_fulfilled(commitment: Commitment, evidence: str) -> Commitment:
    if not evidence.strip() or commitment.status in (CommitmentStatus.INCOMPLETE, CommitmentStatus.CANCELLED):
        raise ValueError("Fulfillment needs evidence and a concrete, active commitment")
    commitment.status = CommitmentStatus.FULFILLED
    commitment.evidence = evidence
    return commitment


def mark_breached(commitment: Commitment, reason: str) -> Commitment:
    if not reason.strip() or commitment.status != CommitmentStatus.PENDING:
        raise ValueError("Only a pending commitment can be breached, with evidence")
    commitment.status = CommitmentStatus.BREACHED
    commitment.evidence = reason
    return commitment


def mark_cancelled(commitment: Commitment, reason: str) -> Commitment:
    if not reason.strip() or commitment.status == CommitmentStatus.FULFILLED:
        raise ValueError("Cancellation needs a reason and an unresolved commitment")
    commitment.status = CommitmentStatus.CANCELLED
    commitment.evidence = reason
    return commitment


def _items(value: ServiceCase | list[Commitment]) -> list[Commitment]:
    return value.active_commitments if isinstance(value, ServiceCase) else value


def get_pending_commitments(value: ServiceCase | list[Commitment]) -> list[Commitment]:
    return [c for c in _items(value) if c.status == CommitmentStatus.PENDING]


def get_incomplete_commitments(value: ServiceCase | list[Commitment]) -> list[Commitment]:
    return [c for c in _items(value) if c.status == CommitmentStatus.INCOMPLETE]


def has_unresolved_commitments(value: ServiceCase | list[Commitment]) -> bool:
    return any(c.material and c.status not in (CommitmentStatus.FULFILLED, CommitmentStatus.CANCELLED)
               for c in _items(value))
