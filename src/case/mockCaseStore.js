/**
 * Deterministic Mock Case Store & Scenario Driver (Phase 1 Foundation)
 *
 * Provides pure, deterministic scenario fixtures for Steward Case UI:
 * - Scenario A: ACT (₹900 quote -> Autonomous action -> Household Verified -> Closed)
 * - Scenario B: RESTRAIN (₹3,800 quote -> Outside authority -> Human Approval Required -> Declined)
 * - Scenario C: RECOVER (₹900 quote -> Service Attempted -> Provider claims repaired -> Household says still broken -> Verification failed -> Recovery)
 *
 * Zero random values, zero non-deterministic timestamps, zero backend coupling.
 */

import {
  CASE_STATUSES,
  EVENT_TYPES,
  VERIFICATION_STATUS,
  COMMITMENT_STATUS,
  SCENARIO_KEYS,
} from './caseTypes';

export const MOCK_SCENARIOS = {
  [SCENARIO_KEYS.ACT]: {
    id: SCENARIO_KEYS.ACT,
    name: 'Scenario A — ACT (Autonomous Resolution)',
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
      provider: 'Bosch Authorized Express Care',
      appointment: '2026-10-02T14:30:00Z',
      expectedTime: '2026-10-02T14:30:00Z',
      status: COMMITMENT_STATUS.CONFIRMED,
      completionStatus: COMMITMENT_STATUS.COMPLETED,
    },
    verification: {
      providerClaim: 'Repair completed. Replacement seal fitted.',
      householdResponse: 'Working normally. No leak observed during test spin.',
      verificationStatus: VERIFICATION_STATUS.VERIFIED,
    },
    updatedMemory: {
      cumulativeRepairCost: 2100,
      lastUpdated: '2026-10-02T16:00:00Z',
    },
    timeline: [
      {
        timestamp: '2026-10-02T10:00:00Z',
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        description: 'Vibration sensor & water leak alarm triggered on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:00:30Z',
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        description: 'Retrieved history: 1 previous incident (₹1,200). Total history: ₹1,200.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:01:00Z',
        type: EVENT_TYPES.ASSESSMENT,
        label: 'Assessment',
        description: 'Diagnosed worn drum seal gasket requiring replacement.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:02:00Z',
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        description: 'Quote received from Bosch Authorized Express Care: ₹900.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:02:15Z',
        type: EVENT_TYPES.DECISION,
        label: 'Autonomous Decision',
        description: 'Quote ₹900 is ≤ autonomous limit ₹1,500. Proceeding without human approval.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:05:00Z',
        type: EVENT_TYPES.APPOINTMENT_REQUESTED,
        label: 'Appointment Requested',
        description: 'Dispatched technician request for same-day service.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T10:10:00Z',
        type: EVENT_TYPES.APPOINTMENT_CONFIRMED,
        label: 'Appointment Confirmed',
        description: 'Technician assigned for 14:30 slot.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T14:30:00Z',
        type: EVENT_TYPES.SERVICE_ATTEMPTED,
        label: 'Service Attempted',
        description: 'Technician arrived and performed gasket replacement.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T15:15:00Z',
        type: EVENT_TYPES.PROVIDER_CLAIM,
        label: 'Provider Claim',
        description: 'Service provider reported repair completed.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T15:45:00Z',
        type: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        label: 'Household Verification',
        description: 'Household confirmed: Working normally.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T16:00:00Z',
        type: EVENT_TYPES.MEMORY_UPDATED,
        label: 'Memory Updated',
        description: 'Written back to persistent memory. Lifetime repair total: ₹2,100.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T16:01:00Z',
        type: EVENT_TYPES.CASE_CLOSED,
        label: 'Case Closed',
        description: 'Case case_act_101 successfully resolved and closed.',
        status: 'COMPLETED',
      },
    ],
  },

  [SCENARIO_KEYS.RESTRAIN]: {
    id: SCENARIO_KEYS.RESTRAIN,
    name: 'Scenario B — RESTRAIN (Human Approval Required)',
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
      provider: 'Bosch Premium Component Service',
      appointment: null,
      expectedTime: null,
      status: COMMITMENT_STATUS.REQUESTED,
      completionStatus: COMMITMENT_STATUS.CANCELLED,
    },
    verification: {
      providerClaim: null,
      householdResponse: 'Declined spending ₹3,800. Opted to evaluate machine replacement.',
      verificationStatus: VERIFICATION_STATUS.PENDING,
    },
    updatedMemory: {
      cumulativeRepairCost: 1200,
      lastUpdated: '2026-10-02T11:30:00Z',
    },
    timeline: [
      {
        timestamp: '2026-10-02T11:00:00Z',
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        description: 'Motor rotation error code E-23 detected on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T11:00:30Z',
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        description: 'Retrieved history: 1 previous incident (₹1,200).',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T11:01:00Z',
        type: EVENT_TYPES.ASSESSMENT,
        label: 'Assessment',
        description: 'Diagnosed main drive motor control PCB breakdown.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T11:02:00Z',
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        description: 'Quote received from Bosch Premium Service: ₹3,800.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T11:02:15Z',
        type: EVENT_TYPES.DECISION,
        label: 'Decision: Approval Required',
        description: 'Quote ₹3,800 exceeds autonomous limit ₹1,500. Halting autonomous execution.',
        status: 'ATTENTION_REQUIRED',
      },
      {
        timestamp: '2026-10-02T11:30:00Z',
        type: EVENT_TYPES.CASE_CLOSED,
        label: 'Human Decision: Declined',
        description: 'Household declined ₹3,800 expenditure. Case restrained with zero unauthorized spend.',
        status: 'RESTRAINED',
      },
    ],
  },

  [SCENARIO_KEYS.RECOVER]: {
    id: SCENARIO_KEYS.RECOVER,
    name: 'Scenario C — RECOVER (Failed Verification & Re-assessment)',
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
      provider: 'QuickFix Appliance Service',
      appointment: '2026-10-02T14:00:00Z',
      expectedTime: '2026-10-02T14:00:00Z',
      status: COMMITMENT_STATUS.COMPLETED,
      completionStatus: COMMITMENT_STATUS.NO_SHOW,
    },
    verification: {
      providerClaim: 'Drain line cleared. System fully operational.',
      householdResponse: 'Still leaking & drum fails to drain. Problem persists.',
      verificationStatus: VERIFICATION_STATUS.FAILED,
    },
    updatedMemory: {
      cumulativeRepairCost: 1200,
      lastUpdated: '2026-10-02T12:00:00Z',
    },
    timeline: [
      {
        timestamp: '2026-10-02T12:00:00Z',
        type: EVENT_TYPES.PROBLEM_DETECTED,
        label: 'Problem Detected',
        description: 'Drain error detected on Washing Machine.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T12:00:30Z',
        type: EVENT_TYPES.MEMORY_LOADED,
        label: 'Memory Loaded',
        description: 'Retrieved machine history.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T12:01:00Z',
        type: EVENT_TYPES.QUOTE_RECEIVED,
        label: 'Quote Received',
        description: 'Quote from QuickFix: ₹900.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T12:01:15Z',
        type: EVENT_TYPES.DECISION,
        label: 'Autonomous Decision',
        description: 'Quote ₹900 ≤ ₹1,500. Approved.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T14:00:00Z',
        type: EVENT_TYPES.SERVICE_ATTEMPTED,
        label: 'Service Attempted',
        description: 'Technician performed service call.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T15:30:00Z',
        type: EVENT_TYPES.PROVIDER_CLAIM,
        label: 'Provider Claim',
        description: 'QuickFix reported repair completed.',
        status: 'COMPLETED',
      },
      {
        timestamp: '2026-10-02T16:00:00Z',
        type: EVENT_TYPES.HOUSEHOLD_VERIFICATION,
        label: 'Household Verification Failed',
        description: 'Household reported machine still leaking. Verification: FAILED.',
        status: 'FAILED',
      },
      {
        timestamp: '2026-10-02T16:15:00Z',
        type: EVENT_TYPES.RECOVERY,
        label: 'Steward Case Recovery',
        description: 'Steward maintains case ownership. Re-assessing diagnosis & scheduling escalation.',
        status: 'IN_PROGRESS',
      },
    ],
  },
};

class MockCaseStore {
  constructor() {
    this.activeScenarioKey = SCENARIO_KEYS.ACT;
    this.listeners = new Set();
  }

  getScenario(key = this.activeScenarioKey) {
    const scenario = MOCK_SCENARIOS[key];
    if (!scenario) return JSON.parse(JSON.stringify(MOCK_SCENARIOS[SCENARIO_KEYS.ACT]));
    return JSON.parse(JSON.stringify(scenario));
  }

  getActiveScenarioKey() {
    return this.activeScenarioKey;
  }

  loadScenario(key) {
    if (!MOCK_SCENARIOS[key]) {
      console.warn(`[MockCaseStore] Unknown scenario key "${key}". Defaulting to ACT.`);
      key = SCENARIO_KEYS.ACT;
    }
    this.activeScenarioKey = key;
    this.notify();
    return this.getScenario(key);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getScenario());
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    const data = this.getScenario();
    this.listeners.forEach((fn) => fn(data));
  }
}

export const mockCaseStore = new MockCaseStore();
