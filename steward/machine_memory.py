"""JSON machine memory. Atomic writes; callers use isolated directories for demos/tests."""
from __future__ import annotations

from datetime import date
import json
import os
from pathlib import Path
import re
import tempfile

from steward.models import Machine, FailureRecord, RepairRecord, ProviderRecord, validate_amount

DEFAULT_MACHINES_DIR = Path(__file__).resolve().parents[1] / "data" / "machines"


def normalize_fault_type(problem_or_fault: str) -> str:
    text = problem_or_fault.lower()
    if "drain" in text:
        return "drainage"
    if "spin" in text:
        return "spin"
    if "leak" in text:
        return "leakage"
    return "general"


def _path(machine_id: str, data_dir: str | Path | None) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", machine_id):
        raise ValueError("Invalid machine ID")
    return Path(data_dir or DEFAULT_MACHINES_DIR) / f"{machine_id}.json"


def load_machine(machine_id: str, data_dir: str | Path | None = None) -> Machine:
    path = _path(machine_id, data_dir)
    try:
        machine = Machine.from_dict(json.loads(path.read_text(encoding="utf-8")))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Unknown machine: {machine_id}") from exc
    except (ValueError, TypeError, KeyError) as exc:
        raise ValueError(f"Invalid machine memory in {path}: {exc}") from exc
    if machine.machine_id != machine_id:
        raise ValueError("Machine ID does not match memory filename")
    validate_amount(machine.cumulative_repair_spend)
    validate_amount(machine.autonomous_repair_limit_inr)
    for repair in machine.repair_history:
        validate_amount(repair.cost_inr)
    return machine


def save_machine(machine: Machine, data_dir: str | Path | None = None) -> Path:
    path = _path(machine.machine_id, data_dir)
    validate_amount(machine.cumulative_repair_spend)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".machine-", suffix=".tmp", delete=False) as output:
            temporary = Path(output.name)
            json.dump(machine.to_dict(), output, indent=2, ensure_ascii=False, allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return path


def record_failure(machine: Machine, case_id: str, problem: str, fault_type: str | None = None,
                   incident_date: str | None = None, resolved: bool = False,
                   notes: str | None = None) -> FailureRecord:
    existing = next((f for f in machine.failure_history if f.case_id == case_id), None)
    if existing:
        return existing
    day = incident_date or date.today().isoformat()
    date.fromisoformat(day)
    failure = FailureRecord(f"FAIL-{case_id}", case_id, day, problem,
                            fault_type or normalize_fault_type(problem), resolved, notes)
    machine.failure_history.append(failure)
    return failure


def record_repair(machine: Machine, case_id: str, problem: str, resolution_summary: str,
                  cost_inr: int, provider_name: str, fault_type: str | None = None,
                  repair_date: str | None = None, parts_replaced: list[str] | None = None,
                  verified_by_household: bool = False) -> RepairRecord:
    validate_amount(cost_inr)
    if verified_by_household is not True:
        raise ValueError("Only independently verified repairs may enter successful repair history")
    if not resolution_summary.strip() or not provider_name.strip():
        raise ValueError("Repair needs a resolution summary and provider")
    day = repair_date or date.today().isoformat()
    date.fromisoformat(day)
    existing = next((r for r in machine.repair_history if r.case_id == case_id), None)
    if existing:
        if (existing.cost_inr, existing.provider_name, existing.resolution_summary) != (cost_inr, provider_name, resolution_summary):
            raise ValueError("Conflicting repair update for an already recorded case")
        return existing
    repair = RepairRecord(f"REP-{case_id}", case_id, day, problem,
        fault_type or normalize_fault_type(problem), resolution_summary, cost_inr, provider_name,
        list(parts_replaced or []), True)
    machine.repair_history.append(repair)
    machine.cumulative_repair_spend += cost_inr
    for failure in machine.failure_history:
        if failure.case_id == case_id:
            failure.resolved = True
    machine.current_lifecycle_status = "ACTIVE"
    return repair


def record_provider(machine: Machine, provider_id: str, name: str, phone: str = "",
                    authorised: bool = False, last_used_date: str | None = None,
                    notes: str | None = None) -> ProviderRecord:
    provider = next((p for p in machine.previous_providers if p.provider_id == provider_id), None)
    if provider:
        provider.last_used_date = last_used_date
        provider.notes = notes
    else:
        provider = ProviderRecord(provider_id, name, phone, authorised, last_used_date, notes)
        machine.previous_providers.append(provider)
    return provider


def get_recent_failures(machine: Machine, within_days: int = 180,
                        reference_date: str | None = None, exclude_case_id: str | None = None) -> list[FailureRecord]:
    today = date.fromisoformat(reference_date) if reference_date else date.today()
    return [f for f in machine.failure_history if f.case_id != exclude_case_id
            and 0 <= (today - date.fromisoformat(f.date)).days <= within_days]


def detect_repeated_fault(machine: Machine, problem_or_fault: str, within_days: int = 180,
                          reference_date: str | None = None, exclude_case_id: str | None = None) -> dict[str, int]:
    fault = normalize_fault_type(problem_or_fault)
    return {
        "prior_occurrences": sum(f.fault_type == fault for f in machine.failure_history if f.case_id != exclude_case_id),
        "recent_occurrences_within_window": sum(f.fault_type == fault for f in
            get_recent_failures(machine, within_days, reference_date, exclude_case_id)),
    }
