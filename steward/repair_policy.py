"""Interpretable prototype heuristic, reconstructed from cached thresholds. Not ML."""
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from steward.machine_memory import detect_repeated_fault
from steward.models import Machine, Record, RepairPolicyDecision, validate_amount


@dataclass
class RepairPolicyEvaluation(Record):
    decision: RepairPolicyDecision
    reasons: list[str] = field(default_factory=list)
    requires_human_approval: bool = False
    metrics: dict[str, Any] = field(default_factory=dict)


def evaluate_repair_vs_replace(machine: Machine | None = None, problem: str = "",
    current_quote_inr: int = 0, *, machine_age_years: int | None = None,
    cumulative_repair_spend_inr: int | None = None, repeated_same_fault_count: int | None = None,
    recent_repairs_count: int | None = None, warranty_expired: bool | None = None,
    estimated_replacement_cost_inr: int = 24000, repair_just_failed: bool = False,
    reference_date: str | None = None, exclude_case_id: str | None = None) -> RepairPolicyEvaluation:
    validate_amount(current_quote_inr)
    today = date.fromisoformat(reference_date) if reference_date else date.today()
    recent_same = 0
    if machine:
        machine_age_years = max(0, today.year - machine.purchase_year)
        cumulative_repair_spend_inr = machine.cumulative_repair_spend
        repeats = detect_repeated_fault(machine, problem, reference_date=today.isoformat(), exclude_case_id=exclude_case_id)
        repeated_same_fault_count = repeats["prior_occurrences"]
        recent_same = repeats["recent_occurrences_within_window"]
        recent_repairs_count = sum(0 <= (today - date.fromisoformat(r.date)).days <= 180
                                   for r in machine.repair_history)
        warranty_expired = machine.warranty.status.upper() == "EXPIRED" or bool(
            machine.warranty.expiry_date and date.fromisoformat(machine.warranty.expiry_date) < today)
        estimated_replacement_cost_inr = machine.estimated_replacement_cost_inr
    else:
        recent_same = repeated_same_fault_count or 0
    age, spend, repeats, frequency = (machine_age_years or 0, cumulative_repair_spend_inr or 0,
                                     repeated_same_fault_count or 0, recent_repairs_count or 0)
    validate_amount(spend)
    validate_amount(estimated_replacement_cost_inr)
    projected = spend + current_quote_inr
    ratio = projected / estimated_replacement_cost_inr if estimated_replacement_cost_inr else None
    reasons = []
    if repair_just_failed:
        reasons.append("repair attempt failed; reassess diagnosis and repair economics")
    if recent_same >= 2:
        reasons.append("same fault repeated within six months")
    if frequency >= 3:
        reasons.append("repair frequency increased")
    if spend >= 6000 or (ratio is not None and ratio >= 0.35):
        reasons.append(f"cumulative/projected repair spend (₹{projected}) approaches replacement threshold")
    if warranty_expired and current_quote_inr >= 4500:
        reasons.append(f"current repair quote (₹{current_quote_inr}) is high for an out-of-warranty machine")
    if age >= 6 and warranty_expired and repeats >= 1 and projected >= 3500:
        reasons.append(f"machine age ({age} yrs), expired warranty, recurring fault and spend justify reassessment")
    reassess = bool(reasons)
    if not reasons:
        reasons.append("repair remains economically reasonable relative to machine history")
        if repeats:
            reasons.append("one prior incident noted; monitor for recurrence")
    return RepairPolicyEvaluation(
        RepairPolicyDecision.REASSESS_REPAIR_VS_REPLACE if reassess else RepairPolicyDecision.CONTINUE_REPAIR,
        reasons, reassess, {"machine_age_years": age, "cumulative_repair_spend_inr": spend,
            "projected_cumulative_spend_inr": projected, "repeated_same_fault_count": repeats,
            "recent_same_fault_count": recent_same, "recent_repairs_count": frequency,
            "spend_to_replacement_ratio": ratio})
