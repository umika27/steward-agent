/**
 * State Transition Validator (Phase 9B Runtime)
 *
 * Defines the strict, deterministic Steward state transition graph.
 * Prevents arbitrary state jumps and enforces verified lifecycle progression.
 * Pure validation - zero business decision logic.
 */

import { CASE_STATUSES } from '../../case/caseTypes.js';

export const RUNTIME_CASE_STATES = {
  NEW_CASE: 'NEW_CASE',
  LOAD_MEMORY: 'LOAD_MEMORY',
  ASSESS: 'ASSESS',
  SELECT_RESOLUTION: 'SELECT_RESOLUTION',
  CONTACT_PROVIDER: 'CONTACT_PROVIDER',
  NEGOTIATING: 'NEGOTIATING',
  COMMITMENT_INCOMPLETE: 'COMMITMENT_INCOMPLETE',
  SCHEDULED: 'SCHEDULED',
  AWAITING_VISIT: 'AWAITING_VISIT',
  NO_SHOW: 'NO_SHOW',
  AWAITING_PART: 'AWAITING_PART',
  SERVICE_ATTEMPTED: 'SERVICE_ATTEMPTED',
  VERIFYING: 'VERIFYING',
  HUMAN_APPROVAL_REQUIRED: 'HUMAN_APPROVAL_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PROVIDER_UNREACHABLE: 'PROVIDER_UNREACHABLE',
  REPAIR_FAILED: 'REPAIR_FAILED',
  REASSESS_REPAIR_VS_REPLACE: 'REASSESS_REPAIR_VS_REPLACE',
  RESOLVED: 'RESOLVED',
  UPDATE_MEMORY: 'UPDATE_MEMORY',
  CLOSED: 'CLOSED',
  // Canonical Phase 1-6 Aliases
  INGEST: 'INGEST',
  DECIDE: 'DECIDE',
  ACT: 'ACT',
  VERIFY: 'VERIFY',
  MEMORY_UPDATE: 'MEMORY_UPDATE',
  RESTRAINED: 'RESTRAINED',
  RECOVERING: 'RECOVERING',
};

/**
 * Deterministic State Transition Graph: Current State -> Set of Allowed Next States
 */
export const ALLOWED_STATE_TRANSITIONS = {
  NEW_CASE: ['LOAD_MEMORY', 'ASSESS', 'INGEST'],
  INGEST: ['LOAD_MEMORY', 'ASSESS'],
  LOAD_MEMORY: ['ASSESS'],
  ASSESS: ['SELECT_RESOLUTION', 'DECIDE', 'HUMAN_APPROVAL_REQUIRED', 'RESTRAINED'],
  SELECT_RESOLUTION: ['CONTACT_PROVIDER', 'SCHEDULED', 'ACT', 'HUMAN_APPROVAL_REQUIRED', 'RESTRAINED'],
  DECIDE: ['CONTACT_PROVIDER', 'SCHEDULED', 'ACT', 'HUMAN_APPROVAL_REQUIRED', 'RESTRAINED'],
  CONTACT_PROVIDER: ['SCHEDULED', 'NEGOTIATING', 'PROVIDER_UNREACHABLE', 'COMMITMENT_INCOMPLETE'],
  NEGOTIATING: ['SCHEDULED', 'PROVIDER_UNREACHABLE', 'HUMAN_APPROVAL_REQUIRED'],
  COMMITMENT_INCOMPLETE: ['CONTACT_PROVIDER', 'PROVIDER_UNREACHABLE', 'REASSESS_REPAIR_VS_REPLACE'],
  SCHEDULED: ['AWAITING_VISIT', 'NO_SHOW', 'CANCELLED'],
  ACT: ['SCHEDULED', 'AWAITING_VISIT', 'SERVICE_ATTEMPTED'],
  AWAITING_VISIT: ['SERVICE_ATTEMPTED', 'NO_SHOW', 'PROVIDER_UNREACHABLE'],
  NO_SHOW: ['CONTACT_PROVIDER', 'SCHEDULED', 'REASSESS_REPAIR_VS_REPLACE'],
  AWAITING_PART: ['SCHEDULED', 'AWAITING_VISIT', 'REASSESS_REPAIR_VS_REPLACE'],
  SERVICE_ATTEMPTED: ['VERIFYING', 'VERIFY', 'REPAIR_FAILED'],
  VERIFYING: ['RESOLVED', 'REPAIR_FAILED', 'VERIFY'],
  VERIFY: ['RESOLVED', 'CLOSED', 'REPAIR_FAILED', 'RECOVERING'],
  HUMAN_APPROVAL_REQUIRED: ['CONTACT_PROVIDER', 'SCHEDULED', 'RESTRAINED', 'CLOSED'],
  RESTRAINED: ['CONTACT_PROVIDER', 'SCHEDULED', 'CLOSED'],
  PAYMENT_FAILED: ['HUMAN_APPROVAL_REQUIRED', 'REASSESS_REPAIR_VS_REPLACE'],
  PROVIDER_UNREACHABLE: ['CONTACT_PROVIDER', 'REASSESS_REPAIR_VS_REPLACE'],
  REPAIR_FAILED: ['REASSESS_REPAIR_VS_REPLACE', 'RECOVERING'],
  REASSESS_REPAIR_VS_REPLACE: ['ASSESS', 'SELECT_RESOLUTION', 'CONTACT_PROVIDER', 'RECOVERING'],
  RECOVERING: ['ASSESS', 'SELECT_RESOLUTION', 'CONTACT_PROVIDER', 'SCHEDULED'],
  RESOLVED: ['UPDATE_MEMORY', 'MEMORY_UPDATE', 'CLOSED'],
  UPDATE_MEMORY: ['CLOSED'],
  MEMORY_UPDATE: ['CLOSED'],
  CLOSED: [], // Terminal state
};

export class StateTransitionValidator {
  /**
   * Validate state transition
   * @param {string} currentState - Active state
   * @param {string} nextState - Target state
   * @returns {{ valid: boolean, error?: string }}
   */
  static validate(currentState, nextState) {
    if (!currentState || typeof currentState !== 'string') {
      return { valid: false, error: 'Current state is undefined or invalid' };
    }

    if (!nextState || typeof nextState !== 'string') {
      return { valid: false, error: 'Next state is undefined or invalid' };
    }

    if (currentState === nextState) {
      return { valid: true }; // No-op idempotent transition
    }

    const allowedNext = ALLOWED_STATE_TRANSITIONS[currentState];

    if (!allowedNext) {
      return {
        valid: false,
        error: `Current state "${currentState}" is not recognized in transition graph`,
      };
    }

    if (!allowedNext.includes(nextState)) {
      return {
        valid: false,
        error: `Illegal state transition: "${currentState}" -> "${nextState}". Allowed next states: [${allowedNext.join(', ')}]`,
      };
    }

    return { valid: true };
  }
}
