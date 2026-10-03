/**
 * Steward Case Integration Adapter (Phase 7)
 *
 * Provides a pure, single integration boundary between Steward Agent state
 * (live state stream or fallback store) and the frozen Case UI.
 *
 * Responsibilities:
 * - Receives raw backend case state
 * - Normalizes data shapes, property names, timestamps, and null/undefined values
 * - Dispatches normalized state to UI subscribers
 *
 * STRICT ARCHITECTURAL RULES:
 * - ZERO business decisions (no authority calculations, state transitions, approval logic)
 * - ZERO mutation of incoming case state
 * - Pure mapping & normalization layer only
 */

import { mockCaseStore } from '../case/mockCaseStore';

/**
 * Standardize and sanitize incoming Steward Case payload before passing to UI components.
 *
 * @param {Object} rawPayload - Raw case payload from backend or store
 * @returns {Object} Normalized UI-compatible case state
 */
export const normalizeCaseState = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return {
      machine: {
        machineId: 'N/A',
        manufacturer: 'Unknown',
        model: 'Unknown Model',
        serialNumber: 'N/A',
        location: 'N/A',
      },
      machineMemory: {
        previousIncidents: [],
        cumulativeRepairCost: 0,
      },
      currentCase: {
        caseId: 'N/A',
        issue: 'No active case data available',
        currentState: 'UNAVAILABLE',
        status: 'UNAVAILABLE',
      },
      quote: {
        provider: 'N/A',
        amount: 0,
        currency: 'INR',
        status: 'NONE',
      },
      authority: {
        authorityLimit: 0,
        withinAuthority: false,
        approvalRequired: false,
      },
      decision: {
        decision: 'NONE',
        evidence: 'No case data available',
        rule: 'N/A',
        action: 'NONE',
        timestamp: null,
      },
      commitment: {
        provider: 'N/A',
        appointment: null,
        expectedTime: null,
        status: 'NONE',
        completionStatus: null,
      },
      timeline: [],
      failure: null,
      recovery: null,
      verification: {
        providerClaim: null,
        householdResponse: null,
        verificationStatus: 'PENDING',
      },
    };
  }

  // 1. Machine Identity
  const rawMachine = rawPayload.machine || {};
  const machine = {
    machineId: rawMachine.machineId || rawMachine.machine_id || 'N/A',
    manufacturer: rawMachine.manufacturer || 'Unknown Manufacturer',
    model: rawMachine.model || 'Unknown Model',
    serialNumber: rawMachine.serialNumber || rawMachine.serial_number || 'N/A',
    machineType: rawMachine.machineType || rawMachine.machine_type || 'Machine',
    location: rawMachine.location || 'N/A',
  };

  // 2. Machine Memory
  const rawMemory = rawPayload.machineMemory || rawPayload.machine_memory || {};
  const previousIncidents = Array.isArray(rawMemory.previousIncidents || rawMemory.previous_incidents)
    ? (rawMemory.previousIncidents || rawMemory.previous_incidents).map((inc) => ({
        repairId: inc.repairId || inc.repair_id || 'N/A',
        date: inc.date || 'N/A',
        description: inc.description || '',
        cost: typeof inc.cost === 'number' ? inc.cost : 0,
        outcome: inc.outcome || 'UNKNOWN',
        verificationStatus: inc.verificationStatus || inc.verification_status || 'PENDING',
      }))
    : [];

  const machineMemory = {
    previousIncidents,
    cumulativeRepairCost:
      typeof rawMemory.cumulativeRepairCost === 'number'
        ? rawMemory.cumulativeRepairCost
        : typeof rawMemory.cumulative_repair_cost === 'number'
        ? rawMemory.cumulative_repair_cost
        : 0,
    lastUpdated: rawMemory.lastUpdated || rawMemory.last_updated || null,
  };

  // 3. Current Case Metadata
  const rawCase = rawPayload.currentCase || rawPayload.current_case || rawPayload.case || {};
  const currentCase = {
    caseId: rawCase.caseId || rawCase.case_id || 'N/A',
    machineId: rawCase.machineId || rawCase.machine_id || machine.machineId,
    issue: rawCase.issue || rawCase.description || 'No issue reported',
    currentState: rawCase.currentState || rawCase.current_state || rawCase.status || 'UNKNOWN',
    status: rawCase.status || rawCase.currentState || rawCase.current_state || 'UNKNOWN',
    createdAt: rawCase.createdAt || rawCase.created_at || null,
  };

  // 4. Spending Quote
  const rawQuote = rawPayload.quote || {};
  const quote = {
    provider: rawQuote.provider || rawQuote.provider_name || 'Service Provider',
    amount: typeof rawQuote.amount === 'number' ? rawQuote.amount : 0,
    currency: rawQuote.currency || 'INR',
    status: rawQuote.status || 'ISSUED',
  };

  // 5. Authority Bounds (Strictly consumed from payload, zero UI policy logic)
  const rawAuth = rawPayload.authority || {};
  const authority = {
    authorityLimit:
      typeof rawAuth.authorityLimit === 'number'
        ? rawAuth.authorityLimit
        : typeof rawAuth.authority_limit === 'number'
        ? rawAuth.authority_limit
        : 0,
    withinAuthority: Boolean(rawAuth.withinAuthority ?? rawAuth.within_authority),
    approvalRequired: Boolean(rawAuth.approvalRequired ?? rawAuth.approval_required),
  };

  // 6. Steward Decision Record
  const rawDecision = rawPayload.decision || {};
  const decision = {
    decision: rawDecision.decision || 'NONE',
    evidence: rawDecision.evidence || 'No evidence recorded',
    rule: rawDecision.rule || 'No rule specified',
    action: rawDecision.action || 'NO_ACTION',
    timestamp: rawDecision.timestamp || null,
  };

  // 7. Service Commitment
  const rawCommitment = rawPayload.commitment || {};
  const commitment = {
    type: rawCommitment.type || 'REPAIR_SERVICE',
    provider: rawCommitment.provider || rawCommitment.provider_name || quote.provider,
    expectedAction: rawCommitment.expectedAction || rawCommitment.expected_action || 'Technician Visit',
    appointment: rawCommitment.appointment || rawCommitment.scheduled_at || null,
    expectedTime: rawCommitment.expectedTime || rawCommitment.expected_time || rawCommitment.appointment || null,
    status: rawCommitment.status || 'NONE',
    completionStatus: rawCommitment.completionStatus || rawCommitment.completion_status || null,
  };

  // 8. Case Event Timeline
  const rawTimeline = Array.isArray(rawPayload.timeline) ? rawPayload.timeline : [];
  const timeline = rawTimeline.map((evt, idx) => ({
    event: evt.event || evt.type || `EVENT_${idx}`,
    type: evt.type || evt.event || `EVENT_${idx}`,
    label: evt.label || evt.type || 'Event',
    timestamp: evt.timestamp || null,
    description: evt.description || '',
    status: evt.status || 'COMPLETED',
  }));

  // 9. Failure / Exception Status
  const rawFailure = rawPayload.failure || null;
  const failure = rawFailure
    ? {
        type: rawFailure.type || 'SERVICE_EXCEPTION',
        affectedAction: rawFailure.affectedAction || rawFailure.affected_action || 'Service Visit',
        source: rawFailure.source || 'PROVIDER',
        timestamp: rawFailure.timestamp || null,
        description: rawFailure.description || '',
        status: rawFailure.status || 'FAILED',
        title: rawFailure.title || rawFailure.type || 'Service Exception',
        recorded: rawFailure.recorded || null,
      }
    : null;

  // 10. Case Recovery State
  const rawRecovery = rawPayload.recovery || null;
  const recovery = rawRecovery
    ? {
        active: Boolean(rawRecovery.active ?? true),
        status: rawRecovery.status || 'REASSESSING',
        reason: rawRecovery.reason || 'Household verification failed',
        currentState: rawRecovery.currentState || rawRecovery.current_state || currentCase.currentState,
        nextState: rawRecovery.nextState || rawRecovery.next_state || 'REASSESS_CASE',
      }
    : null;

  // 11. Household Verification & Provider Claim Separation
  const rawVerification = rawPayload.verification || {};
  const verification = {
    verificationStatus:
      rawVerification.verificationStatus || rawVerification.verification_status || rawVerification.status || 'PENDING',
    status: rawVerification.status || rawVerification.verificationStatus || 'PENDING',
    providerClaim: rawVerification.providerClaim || rawVerification.provider_claim || null,
    householdResponse:
      rawVerification.householdResponse || rawVerification.household_response || rawVerification.householdOutcome || null,
    householdOutcome:
      rawVerification.householdOutcome || rawVerification.household_response || rawVerification.householdResponse || null,
    evidence: rawVerification.evidence || rawVerification.householdResponse || null,
  };

  return {
    machine,
    machineMemory,
    currentCase,
    quote,
    authority,
    decision,
    commitment,
    timeline,
    failure,
    recovery,
    verification,
  };
};

/**
 * Steward Case Adapter Boundary Class
 */
class StewardCaseAdapter {
  constructor() {
    this.liveBackendStream = null;
    this.useLiveBackend = false;
  }

  /**
   * Check whether live Steward agent backend stream is available
   */
  getLiveIntegrationStatus() {
    return {
      isLive: this.useLiveBackend && Boolean(this.liveBackendStream),
      boundaryType: this.useLiveBackend ? 'LIVE_STREAM' : 'DETERMINISTIC_MOCK_FALLBACK',
      reason: this.useLiveBackend
        ? 'Connected to Steward live case stream.'
        : 'No live Steward agent WebSocket/REST backend endpoint configured. Using deterministic scenario fallback store.',
    };
  }

  /**
   * Retrieve normalized case state for given scenario key or active store state
   */
  getCaseData(scenarioKey) {
    if (this.useLiveBackend && this.liveBackendStream) {
      try {
        const rawLiveState = this.liveBackendStream.getState();
        return normalizeCaseState(rawLiveState);
      } catch (err) {
        console.warn('[StewardCaseAdapter] Failed to fetch live state. Falling back to mock store.', err);
      }
    }
    const rawMockState = mockCaseStore.getScenario(scenarioKey);
    return normalizeCaseState(rawMockState);
  }

  /**
   * Subscribe UI component to state changes
   */
  subscribe(listener, scenarioKey) {
    if (scenarioKey) {
      mockCaseStore.loadScenario(scenarioKey);
    }

    if (this.useLiveBackend && this.liveBackendStream) {
      const unsub = this.liveBackendStream.subscribe((rawState) => {
        listener(normalizeCaseState(rawState));
      });
      return unsub;
    }

    const unsub = mockCaseStore.subscribe((rawState) => {
      listener(normalizeCaseState(rawState));
    });
    return unsub;
  }

  /**
   * Switch the active canonical scenario in the fallback store
   */
  loadScenario(scenarioKey) {
    return mockCaseStore.loadScenario(scenarioKey);
  }

  /**
   * Get the active canonical scenario key
   */
  getActiveScenarioKey() {
    return mockCaseStore.getActiveScenarioKey();
  }
}

export const stewardCaseAdapter = new StewardCaseAdapter();
