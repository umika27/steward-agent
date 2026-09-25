"""Lightweight domain records reconstructed from cached signatures and fixture data."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class CaseState(str, Enum):
    NEW_CASE = "NEW_CASE"
    LOAD_MEMORY = "LOAD_MEMORY"
    ASSESS = "ASSESS"
    SELECT_RESOLUTION = "SELECT_RESOLUTION"
    CHOOSE_RESOLUTION = "SELECT_RESOLUTION"  # Recovered historical spelling.
    CONTACT_PROVIDER = "CONTACT_PROVIDER"
    NEGOTIATING = "NEGOTIATING"
    COMMITMENT_INCOMPLETE = "COMMITMENT_INCOMPLETE"
    SCHEDULED = "SCHEDULED"
    AWAITING_VISIT = "AWAITING_VISIT"
    NO_SHOW = "NO_SHOW"
    AWAITING_PART = "AWAITING_PART"
    SERVICE_ATTEMPTED = "SERVICE_ATTEMPTED"
    VERIFYING = "VERIFYING"
    VERIFY_OUTCOME = "VERIFYING"  # Recovered historical spelling.
    HUMAN_APPROVAL_REQUIRED = "HUMAN_APPROVAL_REQUIRED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PROVIDER_UNREACHABLE = "PROVIDER_UNREACHABLE"
    REPAIR_FAILED = "REPAIR_FAILED"
    REASSESS_REPAIR_VS_REPLACE = "REASSESS_REPAIR_VS_REPLACE"
    RESOLVED = "RESOLVED"
    UPDATE_MEMORY = "UPDATE_MEMORY"
    CLOSED = "CLOSED"


class CommitmentStatus(str, Enum):
    PENDING = "PENDING"
    FULFILLED = "FULFILLED"
    BREACHED = "BREACHED"
    CANCELLED = "CANCELLED"
    INCOMPLETE = "INCOMPLETE"


class PaymentStatus(str, Enum):
    NOT_DUE = "NOT_DUE"
    PENDING = "PENDING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"


class VerificationStatus(str, Enum):
    UNVERIFIED = "UNVERIFIED"
    PENDING_HOUSEHOLD = "PENDING_HOUSEHOLD"
    VERIFIED = "VERIFIED"
    REPAIR_FAILED = "REPAIR_FAILED"


class AuthorityDecision(str, Enum):
    ALLOW = "ALLOW"
    ASK_HUMAN = "ASK_HUMAN"
    DENY = "DENY"


class RepairPolicyDecision(str, Enum):
    CONTINUE_REPAIR = "CONTINUE_REPAIR"
    REASSESS_REPAIR_VS_REPLACE = "REASSESS_REPAIR_VS_REPLACE"


class Record:
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]):
        return cls(**data)


def validate_amount(amount: int) -> None:
    """This prototype accounts in whole INR; reject bools and non-finite floats."""
    if type(amount) is not int or amount < 0:
        raise ValueError("Amount must be a non-negative integer in INR")


@dataclass
class Warranty(Record):
    status: str
    expiry_date: str | None = None
    coverage_type: str = "manufacturer_standard"
    provider: str = ""
    terms_summary: str | None = None


@dataclass
class AMCRecord(Record):
    amc_id: str
    provider: str
    status: str
    expiry_date: str | None = None
    covers_parts: bool = False
    covers_labour: bool = True


@dataclass
class RepairRecord(Record):
    repair_id: str
    case_id: str
    date: str
    problem: str
    fault_type: str
    resolution_summary: str
    cost_inr: int
    provider_name: str
    parts_replaced: list[str] = field(default_factory=list)
    verified_by_household: bool = False


@dataclass
class FailureRecord(Record):
    failure_id: str
    case_id: str
    date: str
    problem: str
    fault_type: str
    resolved: bool = False
    notes: str | None = None


@dataclass
class ProviderRecord(Record):
    provider_id: str
    name: str
    phone: str = ""
    authorised: bool = False
    last_used_date: str | None = None
    notes: str | None = None


@dataclass
class Machine(Record):
    machine_id: str
    category: str
    brand: str
    model: str
    purchase_year: int
    warranty: Warranty
    purchase_date: str | None = None
    serial_number: str | None = None
    amc: AMCRecord | None = None
    repair_history: list[RepairRecord] = field(default_factory=list)
    failure_history: list[FailureRecord] = field(default_factory=list)
    cumulative_repair_spend: int = 0
    previous_providers: list[ProviderRecord] = field(default_factory=list)
    current_lifecycle_status: str = "ACTIVE"
    preferred_availability: str = "Saturday 10:00–16:00"
    autonomous_repair_limit_inr: int = 1500
    estimated_replacement_cost_inr: int = 24000

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Machine:
        values = dict(data)
        values["warranty"] = Warranty.from_dict(values["warranty"])
        values["amc"] = AMCRecord.from_dict(values["amc"]) if values.get("amc") else None
        for key, model in (("repair_history", RepairRecord), ("failure_history", FailureRecord),
                           ("previous_providers", ProviderRecord)):
            values[key] = [model.from_dict(item) for item in values.get(key, [])]
        return cls(**values)


@dataclass
class Commitment(Record):
    commitment_id: str
    case_id: str
    actor: str
    action: str
    due_date: str | None
    time_window: str | None
    status: CommitmentStatus
    source: str = "local_mock"
    created_at: str = field(default_factory=utc_now_iso)
    reference_id: str | None = None
    evidence: str | None = None
    raw_statement: str | None = None
    missing_fields: list[str] = field(default_factory=list)
    amount_inr: int | None = None
    follow_up_deadline: str | None = None
    follow_up_action: str | None = None
    material: bool = True


@dataclass
class AuthorityPolicy(Record):
    repair_limit_inr: int = 1500
    allowed_availability_windows: list[str] = field(default_factory=lambda: ["Saturday 10:00–16:00"])
    replacement_requires_human: bool = True
    forbidden_secret_types: tuple[str, ...] = (
        "OTP", "PIN", "CVV", "PASSWORD", "UPI_PIN", "AUTHENTICATION_SECRET", "AUTH_SECRET", "PASSCODE"
    )

    def __post_init__(self) -> None:
        validate_amount(self.repair_limit_inr)


@dataclass(frozen=True)
class AuthorityEvaluation(Record):
    decision: AuthorityDecision
    action: str
    reason: str
    amount_inr: int | None = None
    policy_limit_inr: int | None = None

    @property
    def allowed(self) -> bool:
        return self.decision == AuthorityDecision.ALLOW

    @property
    def requires_human(self) -> bool:
        return self.decision == AuthorityDecision.ASK_HUMAN

    @property
    def denied(self) -> bool:
        return self.decision == AuthorityDecision.DENY


@dataclass
class VerificationResult(Record):
    verified: bool
    status: VerificationStatus
    provider_reports_complete: bool = False
    household_confirms_working: bool | None = None
    evidence_sources: list[str] = field(default_factory=list)
    reason: str = ""
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class RailResult(Record):
    rail_name: str
    operation: str
    success: bool
    is_mock: bool = True
    summary: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    error_code: str | None = None
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class CaseEvent(Record):
    from_state: CaseState | None
    to_state: CaseState
    timestamp: str
    reason: str
    evidence: str | None = None
    actor: str = "steward"


@dataclass
class QuoteRecord(Record):
    quote_id: str
    amount_inr: int
    provider_name: str
    diagnosis: str
    approved: bool = False
    approved_by: str | None = None


@dataclass
class AppointmentRecord(Record):
    appointment_id: str
    date: str
    time_window: str
    provider_name: str
    reference_number: str | None = None
    technician_name: str | None = None
    confirmed: bool = True
    commitment_id: str | None = None


@dataclass
class ServiceCase(Record):
    case_id: str
    machine_id: str
    problem: str
    fault_type: str = "general"
    created_at: str = field(default_factory=utc_now_iso)
    current_state: CaseState = CaseState.NEW_CASE
    state_history: list[CaseEvent] = field(default_factory=list)
    active_commitments: list[Commitment] = field(default_factory=list)
    quote: QuoteRecord | None = None
    appointment: AppointmentRecord | None = None
    payment_status: PaymentStatus = PaymentStatus.NOT_DUE
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    verification_result: VerificationResult | None = None
    unresolved_issues: list[str] = field(default_factory=list)
    human_decision_required: bool = False
    human_decision_reason: str | None = None
    resolution_path: str | None = None
    memory_updated: bool = False
    close_reason: str | None = None
    provider_reported_complete: bool = False
    authority_evaluations: list[AuthorityEvaluation] = field(default_factory=list)
    rail_results: list[RailResult] = field(default_factory=list)
