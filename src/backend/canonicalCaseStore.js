/**
 * Canonical Backend Case Store (Phase 9A Support Layer)
 *
 * Exposes authoritative case records for the Steward Agent runtime.
 * Preserves the exact semantics of ACT, RESTRAIN, and RECOVER scenarios.
 * Pure storage and representation layer - ZERO autonomous decision logic.
 */

import {
  CASE_STATUSES,
  EVENT_TYPES,
  VERIFICATION_STATUS,
  COMMITMENT_STATUS,
  SCENARIO_KEYS,
} from '../case/caseTypes.js';

export const CANONICAL_BACKEND_CASES = {
  // Scenario A: ACT (Autonomous Resolution)
  case_act_101: {
    caseId: 'case_act_101',
    scenarioKey: SCENARIO_KEYS.ACT,
    machine: {
      machineId: 'mac_wm_8801',
      manufacturer: 'Bosch',
      model: 'Series 6 Front Load Washing Machine',
      serialNumber: 'BSH-WM6-99214-IN',
      machineType: 'Washing Machine',
      location: 'Laundry Utility Suite',
    },
    machineMemory: {
      previousIncidents: [
        {
          repairId: 'rep_2025_041',
          date: '2025-11-12',
          description: 'Drain pump filter blockage cleared',
          cost: 1200,
          outcome: 'RESOLVED',
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
        },
      ],
      cumulativeRepairCost: 1200,
    },
    currentCase: {
      caseId: 'case_act_101',
      machineId: 'mac_wm_8801',
      issue: 'Water leak during spin cycle & unusual noise',
      currentState: CASE_STATUSES.CLOSED,
      createdAt: '2026-10-02T10:00:00Z',
      status: 'CLOSED',
    },
    quote: {
      provider: 'Bosch Authorized Express Care',
      amount: 900,
      currency: 'INR',
      status: 'ISSUED',
    },
    authority: {
      authorityLimit: 1500,
      withinAuthority: true,
      approvalRequired: false,
    },
    decision: {
      decision: 'PROCEED_AUTONOMOUSLY',
      evidence: 'Repair quote ₹900 is within autonomous threshold of ₹1,500',
      rule: 'Ordinary repair within autonomous limit',
      action: 'REQUEST_APPOINTMENT',
      timestamp: '2026-10-02T10:02:15Z',
    },
    commitment: {
      type: 'REPAIR_SERVICE',
      provider: 'Bosch Authorized Express Care',
      expectedAction: 'Technician Visit',
      appointment: '2026-10-02T14:30:00Z',
      expectedTime: '2026-10-02T14:30:00Z',
      status: COMMITMENT_STATUS.CONFIRMED,
      completionStatus: COMMITMENT_STATUS.COMPLETED,
    },
    verification: {
      providerClaim: 'Repair completed. Replacement seal fitted.',
      householdResponse: 'Working normally. No leak observed during test spin.',
      householdOutcome: 'Working normally. No leak observed during test spin.',
      verificationStatus: VERIFICATION_STATUS.VERIFIED,
      evidence: 'Working normally. No leak observed during test spin.',
    },
    failure: null,
    recovery: null,
    timeline: [
      {
        event: EVENT_TYPES.PROBLEM_DETECTED,
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        timestamp: '2026-10-02T10:00:00Z',
        description: 'Vibration sensor & water leak alarm triggered on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.MEMORY_LOADED,
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        timestamp: '2026-10-02T10:00:30Z',
        description: 'Retrieved history: 1 previous incident (₹1,200). Total history: ₹1,200.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.ASSESSMENT,
        type: EVENT_TYPES.ASSESSMENT,
        label: 'Assessment',
        timestamp: '2026-10-02T10:01:00Z',
        description: 'Diagnosed worn drum seal gasket requiring replacement.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.QUOTE_RECEIVED,
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        timestamp: '2026-10-02T10:02:00Z',
        description: 'Quote received from Bosch Authorized Express Care: ₹900.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.DECISION,
        type: EVENT_TYPES.DECISION,
        label: 'Autonomous Decision',
        timestamp: '2026-10-02T10:02:15Z',
        description: 'Quote ₹900 is ≤ autonomous limit ₹1,500. Proceeding without human approval.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.APPOINTMENT_REQUESTED,
        type: EVENT_TYPES.APPOINTMENT_REQUESTED,
        label: 'Appointment Requested',
        timestamp: '2026-10-02T10:05:00Z',
        description: 'Dispatched technician request for same-day service.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.APPOINTMENT_CONFIRMED,
        type: EVENT_TYPES.APPOINTMENT_CONFIRMED,
        label: 'Appointment Confirmed',
        timestamp: '2026-10-02T10:10:00Z',
        description: 'Technician assigned for 14:30 slot.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.SERVICE_ATTEMPTED,
        type: EVENT_TYPES.SERVICE_ATTEMPTED,
        label: 'Service Attempted',
        timestamp: '2026-10-02T14:30:00Z',
        description: 'Technician arrived and performed gasket replacement.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.PROVIDER_CLAIM,
        type: EVENT_TYPES.PROVIDER_CLAIM,
        label: 'Provider Claim',
        timestamp: '2026-10-02T15:15:00Z',
        description: 'Service provider reported repair completed.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        type: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        label: 'Household Verification',
        timestamp: '2026-10-02T15:45:00Z',
        description: 'Household confirmed: Working normally.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.MEMORY_UPDATED,
        type: EVENT_TYPES.MEMORY_UPDATED,
        label: 'Memory Updated',
        timestamp: '2026-10-02T16:00:00Z',
        description: 'Written back to persistent memory. Lifetime repair total: ₹2,100.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.CASE_CLOSED,
        type: EVENT_TYPES.CASE_CLOSED,
        label: 'Case Closed',
        timestamp: '2026-10-02T16:01:00Z',
        description: 'Case case_act_101 successfully resolved and closed.',
        status: 'COMPLETED',
      },
    ],
  },

  // Scenario B: RESTRAIN (Human Approval Required)
  case_restrain_202: {
    caseId: 'case_restrain_202',
    scenarioKey: SCENARIO_KEYS.RESTRAIN,
    machine: {
      machineId: 'mac_wm_8801',
      manufacturer: 'Bosch',
      model: 'Series 6 Front Load Washing Machine',
      serialNumber: 'BSH-WM6-99214-IN',
      machineType: 'Washing Machine',
      location: 'Laundry Utility Suite',
    },
    machineMemory: {
      previousIncidents: [
        {
          repairId: 'rep_2025_041',
          date: '2025-11-12',
          description: 'Drain pump filter blockage cleared',
          cost: 1200,
          outcome: 'RESOLVED',
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
        },
      ],
      cumulativeRepairCost: 1200,
    },
    currentCase: {
      caseId: 'case_restrain_202',
      machineId: 'mac_wm_8801',
      issue: 'Main drive motor control unit failure',
      currentState: CASE_STATUSES.RESTRAINED,
      createdAt: '2026-10-02T11:00:00Z',
      status: 'RESTRAINED',
    },
    quote: {
      provider: 'Bosch Premium Component Service',
      amount: 3800,
      currency: 'INR',
      status: 'PENDING_APPROVAL',
    },
    authority: {
      authorityLimit: 1500,
      withinAuthority: false,
      approvalRequired: true,
    },
    decision: {
      decision: 'HUMAN_APPROVAL_REQUIRED',
      evidence: 'Repair quote ₹3,800 exceeds autonomous threshold of ₹1,500',
      rule: 'Out-of-bounds expenditure requires explicit human authorization',
      action: 'AWAIT_HUMAN_DECISION',
      timestamp: '2026-10-02T11:02:15Z',
    },
    commitment: {
      type: 'REPAIR_SERVICE',
      provider: 'Bosch Premium Component Service',
      expectedAction: 'Technician Visit',
      appointment: null,
      expectedTime: null,
      status: COMMITMENT_STATUS.REQUESTED,
      completionStatus: COMMITMENT_STATUS.CANCELLED,
    },
    verification: {
      providerClaim: null,
      householdResponse: 'Declined spending ₹3,800. Opted to evaluate machine replacement.',
      householdOutcome: 'Declined spending ₹3,800. Opted to evaluate machine replacement.',
      verificationStatus: VERIFICATION_STATUS.PENDING,
      evidence: 'Declined spending ₹3,800. Opted to evaluate machine replacement.',
    },
    failure: null,
    recovery: null,
    timeline: [
      {
        event: EVENT_TYPES.PROBLEM_DETECTED,
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        timestamp: '2026-10-02T11:00:00Z',
        description: 'Motor rotation error code E-23 detected on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.MEMORY_LOADED,
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        timestamp: '2026-10-02T11:00:30Z',
        description: 'Retrieved history: 1 previous incident (₹1,200).',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.ASSESSMENT,
        type: EVENT_TYPES.ASSESSMENT,
        label: 'Assessment',
        timestamp: '2026-10-02T11:01:00Z',
        description: 'Diagnosed main drive motor control PCB breakdown.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.QUOTE_RECEIVED,
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        timestamp: '2026-10-02T11:02:00Z',
        description: 'Quote received from Bosch Premium Service: ₹3,800.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.DECISION,
        type: EVENT_TYPES.DECISION,
        label: 'Decision: Approval Required',
        timestamp: '2026-10-02T11:02:15Z',
        description: 'Quote ₹3,800 exceeds autonomous limit ₹1,500. Halting autonomous execution.',
        status: 'ATTENTION_REQUIRED',
      },
      {
        event: EVENT_TYPES.CASE_CLOSED,
        type: EVENT_TYPES.CASE_CLOSED,
        label: 'Human Decision: Declined',
        timestamp: '2026-10-02T11:30:00Z',
        description: 'Household declined ₹3,800 expenditure. Case restrained with zero unauthorized spend.',
        status: 'RESTRAINED',
      },
    ],
  },

  // Scenario C: RECOVER (Failed Verification & Re-assessment)
  case_recover_303: {
    caseId: 'case_recover_303',
    scenarioKey: SCENARIO_KEYS.RECOVER,
    machine: {
      machineId: 'mac_wm_8801',
      manufacturer: 'Bosch',
      model: 'Series 6 Front Load Washing Machine',
      serialNumber: 'BSH-WM6-99214-IN',
      machineType: 'Washing Machine',
      location: 'Laundry Utility Suite',
    },
    machineMemory: {
      previousIncidents: [
        {
          repairId: 'rep_2025_041',
          date: '2025-11-12',
          description: 'Drain pump filter blockage cleared',
          cost: 1200,
          outcome: 'RESOLVED',
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
        },
      ],
      cumulativeRepairCost: 1200,
    },
    currentCase: {
      caseId: 'case_recover_303',
      machineId: 'mac_wm_8801',
      issue: 'Water drain failure during spin cycle',
      currentState: CASE_STATUSES.RECOVERING,
      createdAt: '2026-10-02T12:00:00Z',
      status: 'REASSESSMENT_REQUIRED',
    },
    quote: {
      provider: 'QuickFix Appliance Service',
      amount: 900,
      currency: 'INR',
      status: 'EXPIRED',
    },
    authority: {
      authorityLimit: 1500,
      withinAuthority: true,
      approvalRequired: false,
    },
    decision: {
      decision: 'REASSESS_CASE',
      evidence: 'Provider claimed completion, but household verified machine remains defective.',
      rule: 'Failed verification triggers case ownership continuity & immediate recovery re-assessment.',
      action: 'REBOOK_TECHNICIAN_OR_REDIAGNOSE',
      timestamp: '2026-10-02T16:15:00Z',
    },
    commitment: {
      type: 'REPAIR_SERVICE',
      provider: 'QuickFix Appliance Service',
      expectedAction: 'Technician Visit',
      appointment: '2026-10-02T14:00:00Z',
      expectedTime: '2026-10-02T14:00:00Z',
      status: COMMITMENT_STATUS.COMPLETED,
      completionStatus: COMMITMENT_STATUS.NO_SHOW,
    },
    verification: {
      providerClaim: 'Drain line cleared. System fully operational.',
      householdResponse: 'Still leaking & drum fails to drain. Problem persists.',
      householdOutcome: 'Still leaking & drum fails to drain. Problem persists.',
      verificationStatus: VERIFICATION_STATUS.FAILED,
      evidence: 'Still leaking & drum fails to drain. Problem persists.',
    },
    failure: {
      type: 'SERVICE_EXCEPTION',
      affectedAction: 'Drain Line Service',
      source: 'HOUSEHOLD_VERIFICATION',
      timestamp: '2026-10-02T16:00:00Z',
      description: 'Physical outcome verification failed: machine still leaking.',
      status: 'FAILED',
      title: 'Physical Verification Failure',
    },
    recovery: {
      active: true,
      status: 'REASSESSING',
      reason: 'Household reports issue remains unresolved after provider claimed completion.',
      currentState: CASE_STATUSES.RECOVERING,
      nextState: 'REBOOK_TECHNICIAN_OR_REDIAGNOSE',
    },
    timeline: [
      {
        event: EVENT_TYPES.PROBLEM_DETECTED,
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        timestamp: '2026-10-02T12:00:00Z',
        description: 'Drain error detected on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.MEMORY_LOADED,
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        timestamp: '2026-10-02T12:00:30Z',
        description: 'Retrieved machine history.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.QUOTE_RECEIVED,
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        timestamp: '2026-10-02T12:01:00Z',
        description: 'Quote from QuickFix: ₹900.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.DECISION,
        type: EVENT_TYPES.DECISION,
        label: 'Autonomous Decision',
        timestamp: '2026-10-02T12:01:15Z',
        description: 'Quote ₹900 ≤ ₹1,500. Approved.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.SERVICE_ATTEMPTED,
        type: EVENT_TYPES.SERVICE_ATTEMPTED,
        label: 'Service Attempted',
        timestamp: '2026-10-02T14:00:00Z',
        description: 'Technician performed service call.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.PROVIDER_CLAIM,
        type: EVENT_TYPES.PROVIDER_CLAIM,
        label: 'Provider Claim',
        timestamp: '2026-10-02T15:30:00Z',
        description: 'QuickFix reported repair completed.',
        status: 'COMPLETED',
      },
      {
        event: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        type: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        label: 'Household Verification Failed',
        timestamp: '2026-10-02T16:00:00Z',
        description: 'Household reported machine still leaking. Verification: FAILED.',
        status: 'FAILED',
      },
      {
        event: EVENT_TYPES.RECOVERY,
        type: EVENT_TYPES.RECOVERY,
        label: 'Steward Case Recovery',
        timestamp: '2026-10-02T16:15:00Z',
        description: 'Steward maintains case ownership. Re-assessing diagnosis & scheduling escalation.',
        status: 'IN_PROGRESS',
      },
    ],
  },
};

/**
 * Key mapping for lookups by caseId or scenario key
 */
const SCENARIO_KEY_MAP = {
  [SCENARIO_KEYS.ACT]: 'case_act_101',
  [SCENARIO_KEYS.RESTRAIN]: 'case_restrain_202',
  [SCENARIO_KEYS.RECOVER]: 'case_recover_303',
  act: 'case_act_101',
  restrain: 'case_restrain_202',
  recover: 'case_recover_303',
};

export class CanonicalCaseStore {
  /**
   * Retrieve single canonical case by caseId or scenario alias
   */
  getCase(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const resolvedId = SCENARIO_KEY_MAP[identifier] || SCENARIO_KEY_MAP[identifier.toUpperCase()] || identifier;
    const caseData = CANONICAL_BACKEND_CASES[resolvedId];
    if (!caseData) return null;
    return JSON.parse(JSON.stringify(caseData));
  }

  /**
   * List all canonical cases with basic metadata
   */
  listCases() {
    return Object.values(CANONICAL_BACKEND_CASES).map((c) => ({
      caseId: c.caseId,
      scenarioKey: c.scenarioKey,
      issue: c.currentCase.issue,
      currentState: c.currentCase.currentState,
      machineModel: c.machine.model,
      updatedAt: c.currentCase.createdAt,
    }));
  }

  /**
   * Get case status summary
   */
  getCaseStatus(identifier) {
    const caseData = this.getCase(identifier);
    if (!caseData) return null;
    return {
      caseId: caseData.caseId,
      status: caseData.currentCase.status,
      currentState: caseData.currentCase.currentState,
      issue: caseData.currentCase.issue,
      authority: caseData.authority,
      decision: caseData.decision.decision,
    };
  }

  /**
   * Get persistent machine memory for a case
   */
  getCaseMemory(identifier) {
    const caseData = this.getCase(identifier);
    if (!caseData) return null;
    return {
      caseId: caseData.caseId,
      machine: caseData.machine,
      machineMemory: caseData.machineMemory,
    };
  }

  /**
   * Get chronological timeline for a case
   */
  getCaseTimeline(identifier) {
    const caseData = this.getCase(identifier);
    if (!caseData) return null;
    return {
      caseId: caseData.caseId,
      timeline: caseData.timeline,
      eventCount: caseData.timeline.length,
    };
  }
}

export const canonicalCaseStore = new CanonicalCaseStore();
