"""Provider completion is a claim; only the household verifies physical outcome."""
from steward.models import CaseState as S, ServiceCase, VerificationResult, VerificationStatus as V
from steward.states import require_state, transition_state


def verify_outcome(provider_reports_complete: bool = False,
                   household_confirms_working: bool | None = None,
                   household_reports_broken: bool = False,
                   household_notes: str | None = None) -> VerificationResult:
    if household_confirms_working is not None and type(household_confirms_working) is not bool:
        raise ValueError("Household verification must be a boolean observation")
    sources = ["provider_claim"] if provider_reports_complete else []
    if household_reports_broken or household_confirms_working is False:
        return VerificationResult(False, V.REPAIR_FAILED, provider_reports_complete, False,
            sources + ["household_inspection_failed"], household_notes or "Household reports machine still broken")
    if household_confirms_working is True:
        return VerificationResult(True, V.VERIFIED, provider_reports_complete, True,
            sources + ["household_confirmation"], household_notes or "Household confirmed physical outcome")
    return VerificationResult(False, V.PENDING_HOUSEHOLD if provider_reports_complete else V.UNVERIFIED,
        provider_reports_complete, None, sources, "Independent household verification is required")


def record_provider_completion_claim(case: ServiceCase, provider_notes: str | None = None) -> VerificationResult:
    require_state(case, S.SERVICE_ATTEMPTED)
    result = verify_outcome(provider_reports_complete=True)
    case.provider_reported_complete = True
    case.verification_result = result
    case.verification_status = result.status
    transition_state(case, S.VERIFYING, "Provider claims completion; awaiting household verification",
                     provider_notes, "provider")
    return result


def record_household_verification(case: ServiceCase, working: bool,
                                  household_notes: str | None = None) -> VerificationResult:
    require_state(case, S.VERIFYING)
    if type(working) is not bool:
        raise ValueError("Household verification must be true or false")
    result = verify_outcome(case.provider_reported_complete, working, household_notes=household_notes)
    case.verification_result = result
    case.verification_status = result.status
    transition_state(case, S.RESOLVED if result.verified else S.REPAIR_FAILED,
                     result.reason, household_notes, "household")
    return result
