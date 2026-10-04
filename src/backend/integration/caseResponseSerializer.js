/**
 * Case Response Serializer (Phase 9C Integration Layer)
 *
 * Formats internal CaseRuntime states into canonical API JSON responses.
 * Enforces strict field preservation, type safety, and zero secret leakage.
 * Pure serialization - zero business decision logic.
 */

import { CaseValidator } from '../caseValidator.js';

export class CaseResponseSerializer {
  /**
   * Serialize full runtime case to canonical API JSON object
   * @param {Object} runtimeCase
   * @returns {Object}
   */
  static serializeCase(runtimeCase) {
    if (!runtimeCase || typeof runtimeCase !== 'object') {
      return null;
    }

    const currentCase = runtimeCase.currentCase || {};
    const machine = runtimeCase.machine || {};
    const machineMemory = runtimeCase.machineMemory || {};
    const quote = runtimeCase.quote || {};
    const authority = runtimeCase.authority || {};
    const decision = runtimeCase.decision || {};
    const commitment = runtimeCase.commitment || {};
    const verification = runtimeCase.verification || {};
    const timeline = Array.isArray(runtimeCase.timeline) ? runtimeCase.timeline : [];

    const serialized = {
      caseId: runtimeCase.caseId || currentCase.caseId || 'UNKNOWN',
      scenarioKey: runtimeCase.scenarioKey || null,
      machine: {
        machineId: machine.machineId || 'N/A',
        manufacturer: machine.manufacturer || 'Unknown Manufacturer',
        model: machine.model || 'Unknown Model',
        serialNumber: machine.serialNumber || 'N/A',
        machineType: machine.machineType || 'Machine',
        location: machine.location || 'N/A',
      },
      machineMemory: {
        previousIncidents: Array.isArray(machineMemory.previousIncidents)
          ? machineMemory.previousIncidents.map((inc) => ({
              repairId: inc.repairId || 'N/A',
              date: inc.date || 'N/A',
              description: inc.description || '',
              cost: typeof inc.cost === 'number' ? inc.cost : 0,
              outcome: inc.outcome || 'UNKNOWN',
              verificationStatus: inc.verificationStatus || 'PENDING',
            }))
          : [],
        cumulativeRepairCost:
          typeof machineMemory.cumulativeRepairCost === 'number'
            ? machineMemory.cumulativeRepairCost
            : 0,
        lastUpdated: machineMemory.lastUpdated || null,
      },
      currentCase: {
        caseId: currentCase.caseId || runtimeCase.caseId || 'UNKNOWN',
        machineId: currentCase.machineId || machine.machineId || 'N/A',
        issue: currentCase.issue || 'No issue reported',
        currentState: currentCase.currentState || currentCase.status || 'UNKNOWN',
        status: currentCase.status || currentCase.currentState || 'UNKNOWN',
        createdAt: currentCase.createdAt || null,
      },
      quote: {
        provider: quote.provider || 'Service Provider',
        amount: typeof quote.amount === 'number' ? quote.amount : 0,
        currency: quote.currency || 'INR',
        status: quote.status || 'ISSUED',
      },
      authority: {
        authorityLimit: typeof authority.authorityLimit === 'number' ? authority.authorityLimit : 0,
        withinAuthority: Boolean(authority.withinAuthority),
        approvalRequired: Boolean(authority.approvalRequired),
      },
      decision: {
        decision: decision.decision || 'NONE',
        evidence: decision.evidence || 'No evidence recorded',
        rule: decision.rule || 'No rule specified',
        action: decision.action || 'NO_ACTION',
        timestamp: decision.timestamp || null,
      },
      commitment: {
        type: commitment.type || 'REPAIR_SERVICE',
        provider: commitment.provider || quote.provider || 'Service Provider',
        expectedAction: commitment.expectedAction || 'Service Visit',
        appointment: commitment.appointment || null,
        expectedTime: commitment.expectedTime || commitment.appointment || null,
        status: commitment.status || 'NONE',
        completionStatus: commitment.completionStatus || null,
      },
      verification: {
        providerClaim: verification.providerClaim || null,
        householdResponse: verification.householdResponse || null,
        householdOutcome: verification.householdOutcome || verification.householdResponse || null,
        verificationStatus: verification.verificationStatus || 'PENDING',
        evidence: verification.evidence || verification.householdResponse || null,
      },
      failure: runtimeCase.failure
        ? {
            type: runtimeCase.failure.type || 'SERVICE_EXCEPTION',
            title: runtimeCase.failure.title || 'Service Exception',
            affectedAction: runtimeCase.failure.affectedAction || 'Service Visit',
            source: runtimeCase.failure.source || 'PROVIDER',
            timestamp: runtimeCase.failure.timestamp || null,
            description: runtimeCase.failure.description || '',
            status: runtimeCase.failure.status || 'FAILED',
            recorded: runtimeCase.failure.recorded || null,
          }
        : null,
      recovery: runtimeCase.recovery
        ? {
            active: Boolean(runtimeCase.recovery.active ?? true),
            status: runtimeCase.recovery.status || 'REASSESSING',
            reason: runtimeCase.recovery.reason || 'Household verification failed',
            currentState: runtimeCase.recovery.currentState || currentCase.currentState,
            nextState: runtimeCase.recovery.nextState || 'REASSESS_CASE',
          }
        : null,
      timeline: timeline.map((evt, idx) => ({
        event: evt.event || evt.type || `EVENT_${idx}`,
        type: evt.type || evt.event || `EVENT_${idx}`,
        label: evt.label || evt.type || 'Event',
        timestamp: evt.timestamp || null,
        description: evt.description || '',
        status: evt.status || 'COMPLETED',
      })),
    };

    // Audit for secret leakage
    const secretAudit = CaseValidator.auditForSecrets(serialized);
    if (!secretAudit.clean) {
      throw new Error(`Security Violation: Case serialization leaked field "${secretAudit.detectedKey}"`);
    }

    return serialized;
  }

  /**
   * Serialize case status summary
   */
  static serializeStatus(runtimeCase) {
    if (!runtimeCase) return null;
    const c = runtimeCase.currentCase || {};
    const auth = runtimeCase.authority || {};
    const dec = runtimeCase.decision || {};

    return {
      caseId: runtimeCase.caseId || c.caseId,
      status: c.status || c.currentState || 'UNKNOWN',
      currentState: c.currentState || c.status || 'UNKNOWN',
      issue: c.issue || '',
      authority: {
        authorityLimit: typeof auth.authorityLimit === 'number' ? auth.authorityLimit : 0,
        withinAuthority: Boolean(auth.withinAuthority),
        approvalRequired: Boolean(auth.approvalRequired),
      },
      decision: dec.decision || 'NONE',
    };
  }

  /**
   * Serialize machine memory
   */
  static serializeMemory(runtimeCase) {
    if (!runtimeCase) return null;
    return {
      caseId: runtimeCase.caseId,
      machine: runtimeCase.machine || {},
      machineMemory: runtimeCase.machineMemory || {},
    };
  }

  /**
   * Serialize timeline
   */
  static serializeTimeline(runtimeCase) {
    if (!runtimeCase) return null;
    const rawTimeline = Array.isArray(runtimeCase.timeline) ? runtimeCase.timeline : [];
    return {
      caseId: runtimeCase.caseId,
      timeline: rawTimeline.map((evt, idx) => ({
        event: evt.event || evt.type || `EVENT_${idx}`,
        type: evt.type || evt.event || `EVENT_${idx}`,
        label: evt.label || evt.type || 'Event',
        timestamp: evt.timestamp || null,
        description: evt.description || '',
        status: evt.status || 'COMPLETED',
      })),
      eventCount: rawTimeline.length,
    };
  }
}
