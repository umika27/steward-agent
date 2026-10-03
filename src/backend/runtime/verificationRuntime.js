/**
 * Verification Runtime (Phase 9B)
 *
 * Enforces strict separation between Provider Claim and Household Physical Verification.
 * A provider claim of "Repair completed" NEVER automatically marks verification as VERIFIED.
 */

import { VERIFICATION_STATUS } from '../../case/caseTypes.js';

export class VerificationRuntime {
  /**
   * @param {Object} initialVerification
   */
  constructor(initialVerification = null) {
    this.verification = initialVerification
      ? JSON.parse(JSON.stringify(initialVerification))
      : {
          providerClaim: null,
          householdResponse: null,
          householdOutcome: null,
          verificationStatus: VERIFICATION_STATUS.PENDING,
          evidence: null,
        };
  }

  /**
   * Record external provider claim (does NOT alter household verification status)
   * @param {string} claimText
   */
  recordProviderClaim(claimText) {
    this.verification.providerClaim = claimText || 'Provider reported service completed';
    // VerificationStatus strictly remains pending until household reports
    if (this.verification.verificationStatus !== VERIFICATION_STATUS.VERIFIED &&
        this.verification.verificationStatus !== VERIFICATION_STATUS.FAILED) {
      this.verification.verificationStatus = VERIFICATION_STATUS.PENDING;
    }
    return this.get();
  }

  /**
   * Record household outcome / verification evidence
   * @param {Object} payload - { response, outcome, isVerified, evidence }
   */
  recordHouseholdVerification({
    response,
    outcome,
    isVerified,
    evidence,
  }) {
    const outcomeText = outcome || response || 'No outcome statement provided';
    this.verification.householdResponse = outcomeText;
    this.verification.householdOutcome = outcomeText;
    this.verification.evidence = evidence || outcomeText;
    this.verification.verificationStatus = isVerified ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.FAILED;

    return this.get();
  }

  /**
   * Get verification snapshot
   */
  get() {
    return JSON.parse(JSON.stringify(this.verification));
  }
}
