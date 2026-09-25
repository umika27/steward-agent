"""Application orchestrator; policy decisions live in the domain modules.

Cases are process-local in this prototype. Machine history is persisted to JSON.
The manager accepts structured local provider results, never invents a live rail.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

from rails import (LogisticsRail, MockLogisticsRail, MockPaymentsRail, MockVoiceRail,
                   PaymentRail, VoiceRail)
from steward.authority import AuthorityEngine
from steward.commitments import concrete_date, create_commitment, mark_cancelled, mark_fulfilled
from steward import machine_memory as memory
from steward.models import (AppointmentRecord, AuthorityEvaluation, AuthorityPolicy,
    CaseEvent, CaseState as S, Commitment, CommitmentStatus, Machine, PaymentStatus,
    QuoteRecord, RailResult, ServiceCase, VerificationStatus, utc_now_iso, validate_amount)
from steward.recovery import (handle_awaiting_part, handle_commitment_incomplete,
    handle_human_approval_required, handle_no_show, handle_payment_failed,
    handle_provider_unreachable, handle_repair_failed)
from steward.repair_policy import evaluate_repair_vs_replace
from steward.states import independently_verified, require_state, transition_state
from steward.verifier import record_household_verification, record_provider_completion_claim


class CaseManager:
    def __init__(self, data_dir: str | Path | None = None,
                 authority_policy: AuthorityPolicy | None = None,
                 voice_rail: VoiceRail | None = None, payments_rail: PaymentRail | None = None,
                 logistics_rail: LogisticsRail | None = None):
        self.data_dir = Path(data_dir or memory.DEFAULT_MACHINES_DIR)
        self.authority_policy = authority_policy
        self.voice = voice_rail or MockVoiceRail()
        self.payments = payments_rail or MockPaymentsRail()
        self.logistics = logistics_rail or MockLogisticsRail()
        self.cases: dict[str, ServiceCase] = {}
        self._machines: dict[str, Machine] = {}
        self._pending: dict[str, dict] = {}
        self._approved_terms: dict[str, tuple] = {}
        self._case_payments: dict[str, PaymentRail] = {}
        self._custom_payments = payments_rail is not None

    def _machine(self, case: ServiceCase) -> Machine:
        return self._machines[case.case_id]

    def _authority(self, case: ServiceCase) -> AuthorityEngine:
        machine = self._machine(case)
        policy = self.authority_policy or AuthorityPolicy(
            machine.autonomous_repair_limit_inr, [machine.preferred_availability])
        return AuthorityEngine(policy)

    def open_case(self, machine_id: str, problem: str, case_id: str | None = None) -> ServiceCase:
        if not problem.strip():
            raise ValueError("A machine problem is required")
        machine = memory.load_machine(machine_id, self.data_dir)
        case_id = case_id or f"CASE-{uuid4().hex[:12]}"
        if case_id in self.cases or any(f.case_id == case_id for f in machine.failure_history):
            raise ValueError("Case ID already exists")
        case = ServiceCase(case_id, machine_id, problem, memory.normalize_fault_type(problem))
        case.state_history.append(CaseEvent(None, S.NEW_CASE, utc_now_iso(), "Case created"))
        self.cases[case_id] = case
        self._machines[case_id] = machine
        return case

    def load_case_memory(self, case: ServiceCase, machine: Machine | None = None,
                         incident_date: str | None = None) -> Machine:
        require_state(case, S.NEW_CASE)
        # Reload authoritative memory, avoiding a stale caller snapshot.
        loaded = memory.load_machine(case.machine_id, self.data_dir)
        if machine and machine.machine_id != case.machine_id:
            raise ValueError("Machine does not belong to case")
        memory.record_failure(loaded, case.case_id, case.problem, case.fault_type, incident_date)
        memory.save_machine(loaded, self.data_dir)
        self._machines[case.case_id] = loaded
        self._case_payments[case.case_id] = (self.payments if self._custom_payments
            else MockPaymentsRail(self._authority(case)))
        transition_state(case, S.LOAD_MEMORY, "Machine history loaded; failure recorded")
        transition_state(case, S.ASSESS, "Assessing the machine problem")
        return loaded

    def assess_case(self, case: ServiceCase, machine: Machine | None = None,
                    current_quote_inr: int = 0, reference_date: str | None = None):
        require_state(case, S.ASSESS)
        result = evaluate_repair_vs_replace(self._machine(case), case.problem, current_quote_inr,
            reference_date=reference_date, exclude_case_id=case.case_id)
        if result.requires_human_approval:
            transition_state(case, S.REASSESS_REPAIR_VS_REPLACE, "; ".join(result.reasons))
            handle_human_approval_required(case, "Review repair versus replacement: " + "; ".join(result.reasons))
        else:
            case.resolution_path = "repair"
            transition_state(case, S.SELECT_RESOLUTION, "; ".join(result.reasons))
        return result

    def record_call_result(self, case: ServiceCase, structured_payload: dict) -> RailResult:
        """Accept our internal structured schema, not an invented Gnani response format.

        Unresolved material questions must have concrete follow-up ownership/action/date.
        Missing follow-up information rejects the result instead of silently dropping it.
        """
        require_state(case, S.NEGOTIATING)
        result = self.voice.receive_call_result(structured_payload)
        if not result.success:
            case.rail_results.append(result)
            return result
        questions = result.payload.get("unresolved_questions", [])
        if not isinstance(questions, list):
            raise ValueError("Unresolved questions must be a list of structured follow-up records")
        for question in questions:
            if (not isinstance(question, dict)
                    or not isinstance(question.get("question"), str) or not question["question"].strip()
                    or not isinstance(question.get("follow_up_action"), str) or not question["follow_up_action"].strip()
                    or not concrete_date(question.get("follow_up_deadline"))):
                raise ValueError("Every unresolved question needs text, a follow-up action and an ISO date")
        for question in questions:
            self.preserve_question(case, question["question"], question["follow_up_action"], question["follow_up_deadline"])
        case.rail_results.append(result)
        return result

    def contact_provider(self, case: ServiceCase, machine: Machine | None = None,
                         provider_name: str | None = None) -> RailResult:
        require_state(case, S.SELECT_RESOLUTION, S.NO_SHOW, S.COMMITMENT_INCOMPLETE,
                      S.PROVIDER_UNREACHABLE, S.AWAITING_PART)
        transition_state(case, S.CONTACT_PROVIDER, "Contacting service provider")
        try:
            result = self.voice.start_service_conversation({"case_id": case.case_id,
                "machine_id": case.machine_id, "problem": case.problem,
                "provider_name": provider_name})
        except (OSError, TimeoutError) as exc:
            result = RailResult("voice", "start_service_conversation", False, is_mock=self.voice.is_mock,
                                summary=str(exc), error_code="PROVIDER_UNREACHABLE")
        case.rail_results.append(result)
        if not result.success:
            attempts = sum(r.rail_name == "voice" and not r.success for r in case.rail_results)
            handle_provider_unreachable(case, provider_name or "provider", attempts)
        else:
            transition_state(case, S.NEGOTIATING, result.summary)
        return result

    @staticmethod
    def _terms(provider_name: str, quote_amount_inr: int, diagnosis: str,
               appointment_date: str | None, time_window: str | None) -> tuple:
        return provider_name, quote_amount_inr, diagnosis, appointment_date, time_window

    def negotiate_and_schedule(self, case: ServiceCase, provider_name: str, quote_amount_inr: int,
        diagnosis: str, appointment_date: str | None, time_window: str | None,
        reference_number: str | None = None, technician_name: str | None = None,
        raw_statement: str | None = None) -> tuple[AuthorityEvaluation, Commitment | None]:
        require_state(case, S.NEGOTIATING)
        validate_amount(quote_amount_inr)
        if not provider_name.strip() or not diagnosis.strip():
            raise ValueError("Provider and diagnosis are required")
        terms = self._terms(provider_name, quote_amount_inr, diagnosis, appointment_date, time_window)
        approved = self._approved_terms.get(case.case_id) == terms
        engine = self._authority(case)
        evaluation = engine.can_approve_repair(quote_amount_inr)
        case.authority_evaluations.append(evaluation)
        case.quote = QuoteRecord(f"QUOTE-{uuid4().hex[:12]}", quote_amount_inr, provider_name, diagnosis)
        proposal = dict(provider_name=provider_name, quote_amount_inr=quote_amount_inr,
            diagnosis=diagnosis, appointment_date=appointment_date, time_window=time_window,
            reference_number=reference_number, technician_name=technician_name, raw_statement=raw_statement)
        self._pending[case.case_id] = proposal
        if not evaluation.allowed and not approved:
            handle_human_approval_required(case, evaluation.reason)
            return evaluation, None
        commitment = create_commitment(case.case_id, provider_name, "technician_visit",
            appointment_date, time_window, reference_id=reference_number,
            raw_statement=raw_statement, amount_inr=quote_amount_inr,
            follow_up_deadline=appointment_date if concrete_date(appointment_date) else None,
            follow_up_action="Obtain concrete appointment details, then confirm visit and chase any no-show")
        if commitment.status == CommitmentStatus.INCOMPLETE:
            case.active_commitments.append(commitment)
            handle_commitment_incomplete(case, commitment, raw_statement)
            return evaluation, commitment
        scheduling = engine.can_schedule(appointment_date, time_window)
        case.authority_evaluations.append(scheduling)
        if not scheduling.allowed and not approved:
            handle_human_approval_required(case, scheduling.reason)
            return scheduling, None
        # Preserve old promises and their breach evidence when a new appointment supersedes them.
        for prior in case.active_commitments:
            if prior.action == "technician_visit" and prior.status in (
                    CommitmentStatus.PENDING, CommitmentStatus.BREACHED, CommitmentStatus.INCOMPLETE):
                mark_cancelled(prior, f"{prior.evidence or ''}; Superseded by {commitment.commitment_id}")
        case.active_commitments.append(commitment)
        case.quote.approved = True
        case.quote.approved_by = "household" if approved else "authority_engine"
        case.human_decision_required = False
        case.human_decision_reason = None
        case.appointment = AppointmentRecord(f"APT-{case.case_id}", appointment_date, time_window,
            provider_name, reference_number, technician_name, commitment_id=commitment.commitment_id)
        case.payment_status = PaymentStatus.PENDING if quote_amount_inr else PaymentStatus.NOT_DUE
        # A new service attempt must receive a fresh independent verification.
        case.verification_result = None
        case.verification_status = VerificationStatus.UNVERIFIED
        case.provider_reported_complete = False
        case.memory_updated = False
        transition_state(case, S.SCHEDULED, f"Appointment confirmed: {appointment_date} {time_window}; "
            f"₹{quote_amount_inr}; reference {reference_number or 'not supplied'}; "
            f"authorized by {case.quote.approved_by}")
        return evaluation, commitment

    def record_approval(self, case: ServiceCase, approved: bool, evidence: str) -> None:
        require_state(case, S.HUMAN_APPROVAL_REQUIRED)
        if type(approved) is not bool or not evidence.strip():
            raise ValueError("Approval needs an explicit boolean decision and household evidence")
        proposal = self._pending.get(case.case_id)
        if proposal is None:
            raise ValueError("No concrete quote/appointment proposal to approve; reassessment needs a new resolution plan")
        case.human_decision_required = False
        case.human_decision_reason = None
        if not approved:
            self._approved_terms.pop(case.case_id, None)
            self._pending.pop(case.case_id, None)
            if case.quote:
                case.quote.approved = False
            transition_state(case, S.SELECT_RESOLUTION, "Household declined proposal", evidence, "household")
            return
        self._approved_terms[case.case_id] = self._terms(**{key: proposal[key] for key in
            ("provider_name", "quote_amount_inr", "diagnosis", "appointment_date", "time_window")})
        transition_state(case, S.NEGOTIATING, "Household approved this exact proposal", evidence, "household")
        self.negotiate_and_schedule(case, **proposal)

    def await_visit(self, case: ServiceCase) -> None:
        transition_state(case, S.AWAITING_VISIT, "Waiting for technician")

    def record_service_attempt(self, case: ServiceCase, notes: str = "Service visit occurred") -> None:
        transition_state(case, S.SERVICE_ATTEMPTED, notes)

    def record_no_show(self, case: ServiceCase, evidence: str):
        return handle_no_show(case, evidence)

    def record_awaiting_part(self, case: ServiceCase, part_name: str, due_date: str,
                             tracking_reference: str):
        plan = handle_awaiting_part(case, part_name, due_date, tracking_reference=tracking_reference)
        case.rail_results.append(self.logistics.track_part(tracking_reference, part_name))
        return plan

    def record_provider_completion(self, case: ServiceCase, provider_notes: str | None = None):
        return record_provider_completion_claim(case, provider_notes)

    def verify_with_household(self, case: ServiceCase, working: bool, machine: Machine | None = None,
                              household_notes: str | None = None):
        result = record_household_verification(case, working, household_notes)
        if not result.verified:
            handle_repair_failed(case, self._machine(case), household_notes)
        return result

    def settle_payment(self, case: ServiceCase, simulate_failure: bool = False) -> RailResult:
        require_state(case, S.RESOLVED, S.PAYMENT_FAILED)
        if not independently_verified(case) or not case.quote or not case.quote.approved:
            raise ValueError("Payment requires a verified outcome and approved quote")
        evaluation = self._authority(case).can_approve_repair(case.quote.amount_inr)
        terms = self._approved_terms.get(case.case_id)
        human_approved = bool(terms and case.appointment and terms == self._terms(
            case.quote.provider_name, case.quote.amount_inr, case.quote.diagnosis,
            case.appointment.date, case.appointment.time_window))
        if evaluation.denied or (not evaluation.allowed and not human_approved):
            raise ValueError("Current quote has no household authority")
        # The rail is a primitive; approval provenance is checked above, never supplied by a UI flag.
        try:
            result = self._case_payments[case.case_id].request_payment(case.case_id, case.quote.amount_inr,
                case.quote.provider_name, human_approved=human_approved, simulate_failure=simulate_failure)
        except (OSError, TimeoutError) as exc:
            result = RailResult("payments", "request_payment", False, is_mock=self.payments.is_mock,
                               summary=str(exc), error_code="PAYMENT_FAILED")
        case.rail_results.append(result)
        if result.success:
            case.payment_status = PaymentStatus.SETTLED
            if case.current_state == S.PAYMENT_FAILED:
                transition_state(case, S.RESOLVED, "Payment retry settled", result.summary)
        else:
            handle_payment_failed(case, result.summary)
        return result

    def resolve_commitments(self, case: ServiceCase, evidence: str) -> None:
        require_state(case, S.RESOLVED)
        if not independently_verified(case):
            raise ValueError("Service fulfillment requires independent verification")
        # Never silently resolve coverage questions, part delivery, or unrelated material promises.
        for commitment in case.active_commitments:
            if (case.appointment and commitment.commitment_id == case.appointment.commitment_id
                    and commitment.status == CommitmentStatus.PENDING):
                mark_fulfilled(commitment, evidence)

    def preserve_question(self, case: ServiceCase, question: str, follow_up_action: str,
                          follow_up_deadline: str) -> Commitment:
        if case.current_state in (S.UPDATE_MEMORY, S.CLOSED):
            raise ValueError("Cannot add obligations after memory finalization")
        if not question.strip() or not follow_up_action.strip():
            raise ValueError("Unresolved question needs a follow-up action")
        day = date.fromisoformat(follow_up_deadline).isoformat()
        result = create_commitment(case.case_id, "provider", "answer_material_question", day,
            require_time_window=False, case=case, raw_statement=question,
            follow_up_action=follow_up_action, follow_up_deadline=day)
        case.state_history.append(CaseEvent(case.current_state, case.current_state, utc_now_iso(),
            f"Unresolved question preserved: {question}; follow up: {follow_up_action} by {day}"))
        return result

    def update_machine_memory(self, case: ServiceCase, machine: Machine | None = None,
        resolution_summary: str = "Verified repair", parts_replaced: list[str] | None = None,
        repair_date: str | None = None, persist: bool = True) -> Machine:
        require_state(case, S.RESOLVED)
        from steward.commitments import has_unresolved_commitments
        if (not independently_verified(case) or not case.quote or case.human_decision_required
                or has_unresolved_commitments(case) or case.unresolved_issues
                or case.payment_status not in (PaymentStatus.SETTLED, PaymentStatus.NOT_DUE)
                or (case.quote.amount_inr > 0 and case.payment_status != PaymentStatus.SETTLED)):
            raise ValueError("Memory finalization requires verification, settlement and resolved obligations")
        updated = memory.load_machine(case.machine_id, self.data_dir)
        repair = memory.record_repair(updated, case.case_id, case.problem, resolution_summary,
            case.quote.amount_inr, case.quote.provider_name, case.fault_type, repair_date, parts_replaced, True)
        provider = next((p for p in updated.previous_providers if p.name == case.quote.provider_name), None)
        memory.record_provider(updated, provider.provider_id if provider else f"PRV-{case.case_id}",
            case.quote.provider_name, last_used_date=repair.date, notes=f"Completed {case.case_id}: {resolution_summary}")
        if persist:
            memory.save_machine(updated, self.data_dir)
            self._machines[case.case_id] = updated
            case.memory_updated = True
            transition_state(case, S.UPDATE_MEMORY, "Verified repair saved to machine memory")
        return updated

    def close_case(self, case: ServiceCase, close_reason: str = "Verified outcome and obligations fulfilled") -> None:
        transition_state(case, S.CLOSED, close_reason)
        case.close_reason = close_reason
