/**
 * Case Runtime Manager (Phase 9B)
 *
 * Coordinates mutable runtime state for active Steward cases.
 * Enforces transition validation, commitment tracking, independent verification gates,
 * and immutable timeline logging.
 */

import { canonicalCaseStore } from '../canonicalCaseStore.js';
import { StateTransitionValidator, RUNTIME_CASE_STATES } from './stateTransitionValidator.js';
import { TimelineRuntime } from './timelineRuntime.js';
import { CommitmentRuntime } from './commitmentRuntime.js';
import { VerificationRuntime } from './verificationRuntime.js';
import { FailureRuntime } from './failureRuntime.js';
import { RecoveryRuntime } from './recoveryRuntime.js';
import { EVENT_TYPES, VERIFICATION_STATUS } from '../../case/caseTypes.js';

export class CaseRuntime {
  constructor() {
    this.activeCases = new Map();
  }

  /**
   * Load canonical case into active runtime memory
   * @param {string} caseIdentifier - caseId or scenario key alias
   * @returns {Object} Active runtime case
   */
  loadCase(caseIdentifier) {
    if (!caseIdentifier || typeof caseIdentifier !== 'string') {
      throw new Error('Invalid caseIdentifier provided');
    }

    const canonicalCase = canonicalCaseStore.getCase(caseIdentifier);
    if (!canonicalCase) {
      throw new Error(`Case "${caseIdentifier}" not found in canonical store`);
    }

    const caseId = canonicalCase.caseId;

    const runtimeCase = {
      caseId,
      scenarioKey: canonicalCase.scenarioKey,
      machine: JSON.parse(JSON.stringify(canonicalCase.machine)),
      machineMemory: JSON.parse(JSON.stringify(canonicalCase.machineMemory)),
      currentCase: JSON.parse(JSON.stringify(canonicalCase.currentCase)),
      quote: JSON.parse(JSON.stringify(canonicalCase.quote)),
      authority: JSON.parse(JSON.stringify(canonicalCase.authority)),
      decision: JSON.parse(JSON.stringify(canonicalCase.decision)),
      commitmentManager: new CommitmentRuntime(canonicalCase.commitment),
      verificationManager: new VerificationRuntime(canonicalCase.verification),
      failureManager: new FailureRuntime(canonicalCase.failure),
      recoveryManager: new RecoveryRuntime(canonicalCase.recovery),
      timelineManager: new TimelineRuntime(canonicalCase.timeline),
    };

    this.activeCases.set(caseId, runtimeCase);
    return this.getCase(caseId);
  }

  /**
   * Ensure case is loaded or auto-load from canonical store
   */
  _ensureCase(caseIdentifier) {
    let runtimeCase = this.activeCases.get(caseIdentifier);
    if (!runtimeCase) {
      return this.loadCase(caseIdentifier);
    }
    return runtimeCase;
  }

  /**
   * Get formatted canonical snapshot of active runtime case
   * @param {string} caseIdentifier
   * @returns {Object}
   */
  getCase(caseIdentifier) {
    const raw = this._ensureCase(caseIdentifier);
    const caseId = raw.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    if (!runtimeCase) return null;

    return {
      caseId: runtimeCase.caseId,
      scenarioKey: runtimeCase.scenarioKey,
      machine: JSON.parse(JSON.stringify(runtimeCase.machine)),
      machineMemory: JSON.parse(JSON.stringify(runtimeCase.machineMemory)),
      currentCase: JSON.parse(JSON.stringify(runtimeCase.currentCase)),
      quote: JSON.parse(JSON.stringify(runtimeCase.quote)),
      authority: JSON.parse(JSON.stringify(runtimeCase.authority)),
      decision: JSON.parse(JSON.stringify(runtimeCase.decision)),
      commitment: runtimeCase.commitmentManager.get(),
      verification: runtimeCase.verificationManager.get(),
      failure: runtimeCase.failureManager.get(),
      recovery: runtimeCase.recoveryManager.get(),
      timeline: runtimeCase.timelineManager.getEvents(),
    };
  }

  /**
   * Get current state of a case
   */
  getCurrentState(caseIdentifier) {
    const c = this.getCase(caseIdentifier);
    return c?.currentCase?.currentState || null;
  }

  /**
   * Transition case state with validation
   * @param {string} caseIdentifier
   * @param {string} nextState
   * @param {Object} metadata
   */
  transitionState(caseIdentifier, nextState, metadata = {}) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    if (!runtimeCase) {
      throw new Error(`Case "${caseIdentifier}" is not active`);
    }

    const currentState = runtimeCase.currentCase.currentState;

    // Validate transition against allowed transition graph
    const validation = StateTransitionValidator.validate(currentState, nextState);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Apply state change
    runtimeCase.currentCase.currentState = nextState;
    runtimeCase.currentCase.status = nextState;

    // Record state transition timeline event
    runtimeCase.timelineManager.appendEvent({
      type: EVENT_TYPES.STATE_TRANSITION || 'STATE_TRANSITION',
      label: `State -> ${nextState}`,
      description: metadata.description || `Case transitioned from ${currentState} to ${nextState}`,
      status: 'COMPLETED',
      metadata: {
        previousState: currentState,
        nextState,
        ...metadata,
      },
    });

    return this.getCase(caseId);
  }

  /**
   * Record commitment update
   */
  recordCommitmentUpdate(caseIdentifier, update = {}) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    const updated = runtimeCase.commitmentManager.update(update);

    runtimeCase.timelineManager.appendEvent({
      type: EVENT_TYPES.APPOINTMENT_CONFIRMED || 'COMMITMENT_UPDATE',
      label: 'Commitment Update',
      description: `Commitment updated with provider ${updated.provider} (status: ${updated.status})`,
      status: 'COMPLETED',
      metadata: { update },
    });

    return this.getCase(caseId);
  }

  /**
   * Record provider claim (does NOT automatically verify case)
   */
  recordProviderOutcome(caseIdentifier, claimText) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    const updated = runtimeCase.verificationManager.recordProviderClaim(claimText);

    runtimeCase.timelineManager.appendEvent({
      type: EVENT_TYPES.PROVIDER_CLAIM,
      label: 'Provider Claim',
      description: claimText || 'Service provider reported repair completed.',
      status: 'COMPLETED',
      metadata: { claim: claimText },
    });

    return this.getCase(caseId);
  }

  /**
   * Record household verification evidence
   */
  recordHouseholdVerification(caseIdentifier, verificationData = {}) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    const updated = runtimeCase.verificationManager.recordHouseholdVerification(verificationData);

    const isVerified = updated.verificationStatus === VERIFICATION_STATUS.VERIFIED;

    runtimeCase.timelineManager.appendEvent({
      type: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
      label: isVerified ? 'Household Verification' : 'Household Verification Failed',
      description: updated.householdOutcome || (isVerified ? 'Outcome verified' : 'Verification failed'),
      status: isVerified ? 'COMPLETED' : 'FAILED',
      metadata: verificationData,
    });

    // If verification failed, auto-record failure & trigger recovery status
    if (!isVerified) {
      runtimeCase.failureManager.record({
        type: 'VERIFICATION_FAILURE',
        title: 'Household Verification Failed',
        description: updated.householdOutcome || 'Household reported issue persists',
        source: 'HOUSEHOLD',
        affectedAction: 'Repair Outcome Verification',
      });

      runtimeCase.recoveryManager.activate({
        reason: updated.householdOutcome || 'Household reports issue remains unresolved.',
        nextState: 'REASSESS_REPAIR_VS_REPLACE',
      });
    }

    return this.getCase(caseId);
  }

  /**
   * Record failure fact
   */
  recordFailure(caseIdentifier, failureData = {}) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    const failure = runtimeCase.failureManager.record(failureData);

    runtimeCase.timelineManager.appendEvent({
      type: 'FAILURE_RECORDED',
      label: failure.title || 'Failure Recorded',
      description: failure.description,
      status: 'FAILED',
      metadata: failureData,
    });

    return this.getCase(caseId);
  }

  /**
   * Record recovery status
   */
  recordRecovery(caseIdentifier, recoveryData = {}) {
    this._ensureCase(caseIdentifier);
    const caseId = canonicalCaseStore.getCase(caseIdentifier)?.caseId || caseIdentifier;
    const runtimeCase = this.activeCases.get(caseId);

    const recovery = runtimeCase.recoveryManager.activate(recoveryData);

    runtimeCase.timelineManager.appendEvent({
      type: EVENT_TYPES.RECOVERY,
      label: 'Steward Case Recovery',
      description: recovery.reason,
      status: 'IN_PROGRESS',
      metadata: recoveryData,
    });

    return this.getCase(caseId);
  }

  /**
   * Get chronological timeline for case
   */
  getTimeline(caseIdentifier) {
    const caseData = this.getCase(caseIdentifier);
    return caseData ? caseData.timeline : [];
  }
}

export const caseRuntime = new CaseRuntime();
