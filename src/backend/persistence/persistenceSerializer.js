/**
 * Persistence Serializer & Consistency Validator (Phase 9D)
 *
 * Validates state consistency before persisting and upon restoring.
 * Rejects contradictory states and prevents credential leakage.
 */

import { CaseValidator } from '../caseValidator.js';
import { VERIFICATION_STATUS, CASE_STATUSES } from '../../case/caseTypes.js';

export class PersistenceSerializer {
  /**
   * Validate state consistency
   * @param {Object} caseSnapshot
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateConsistency(caseSnapshot) {
    const errors = [];

    if (!caseSnapshot || typeof caseSnapshot !== 'object') {
      return { valid: false, errors: ['Case snapshot must be a non-null object'] };
    }

    const currentCase = caseSnapshot.currentCase || {};
    const verification = caseSnapshot.verification || {};
    const currentState = currentCase.currentState || currentCase.status;
    const verificationStatus = verification.verificationStatus;

    // Rule 1: Contradictory State Check: CLOSED cannot coexist with FAILED verification
    if (currentState === 'CLOSED' && verificationStatus === VERIFICATION_STATUS.FAILED) {
      errors.push('Consistency Violation: Case cannot be CLOSED while verification is FAILED');
    }

    // Rule 2: Timeline must not be empty
    if (!Array.isArray(caseSnapshot.timeline) || caseSnapshot.timeline.length === 0) {
      errors.push('Consistency Violation: Timeline must contain chronological event records');
    }

    // Rule 3: Machine identity required
    if (!caseSnapshot.machine || !caseSnapshot.machine.machineId) {
      errors.push('Consistency Violation: Machine identity is required');
    }

    // Rule 4: Security check (Zero secrets)
    const secretAudit = CaseValidator.auditForSecrets(caseSnapshot);
    if (!secretAudit.clean) {
      errors.push(`Security Violation: Persisted payload contains forbidden field "${secretAudit.detectedKey}"`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize case for durable storage
   * @param {Object} caseSnapshot
   * @returns {Object} Clean validated persistent record
   */
  static serialize(caseSnapshot) {
    const consistency = this.validateConsistency(caseSnapshot);
    if (!consistency.valid) {
      throw new Error(`Persistence Serialization Error: ${consistency.errors.join('; ')}`);
    }

    return {
      caseId: caseSnapshot.caseId,
      scenarioKey: caseSnapshot.scenarioKey || null,
      machine: JSON.parse(JSON.stringify(caseSnapshot.machine || {})),
      machineMemory: JSON.parse(JSON.stringify(caseSnapshot.machineMemory || {})),
      currentCase: JSON.parse(JSON.stringify(caseSnapshot.currentCase || {})),
      quote: JSON.parse(JSON.stringify(caseSnapshot.quote || {})),
      authority: JSON.parse(JSON.stringify(caseSnapshot.authority || {})),
      decision: JSON.parse(JSON.stringify(caseSnapshot.decision || {})),
      commitment: JSON.parse(JSON.stringify(caseSnapshot.commitment || {})),
      verification: JSON.parse(JSON.stringify(caseSnapshot.verification || {})),
      failure: caseSnapshot.failure ? JSON.parse(JSON.stringify(caseSnapshot.failure)) : null,
      recovery: caseSnapshot.recovery ? JSON.parse(JSON.stringify(caseSnapshot.recovery)) : null,
      timeline: Array.isArray(caseSnapshot.timeline) ? JSON.parse(JSON.stringify(caseSnapshot.timeline)) : [],
      persistedAt: new Date().toISOString(),
    };
  }

  /**
   * Validate and deserialize loaded record
   * @param {Object} record
   * @returns {Object} Deserialized case snapshot
   */
  static deserialize(record) {
    const consistency = this.validateConsistency(record);
    if (!consistency.valid) {
      throw new Error(`Persistence Deserialization Error: ${consistency.errors.join('; ')}`);
    }

    return JSON.parse(JSON.stringify(record));
  }
}
