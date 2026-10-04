import { stewardApi } from './steward.js';

// Display mapping only. Supplied decisions and evidence are never recomputed from prices/state.
export function mapPythonCase(serviceCase, machine = {}) {
  if (!serviceCase?.case_id) throw new TypeError('A Python case snapshot is required');
  const evaluations = serviceCase.authority_evaluations || [];
  const evaluation = evaluations.findLast((item) => item.action === 'approve_repair') || {};
  const quote = serviceCase.quote || {};
  const appointment = serviceCase.appointment || {};
  const verification = serviceCase.verification_result || {};
  return {
    machine: { machineId: machine.machine_id || serviceCase.machine_id, manufacturer: machine.brand,
      model: machine.model, serialNumber: machine.serial_number, machineType: machine.category, location: machine.location },
    machineMemory: { cumulativeRepairCost: machine.cumulative_repair_spend,
      previousIncidents: (machine.repair_history || []).map(item => ({ repairId: item.repair_id,
        date: item.date, description: item.problem, cost: item.cost_inr, outcome: item.resolution_summary,
        verificationStatus: item.verified_by_household === true ? 'VERIFIED' : 'UNVERIFIED' })) },
    currentCase: { caseId: serviceCase.case_id, machineId: serviceCase.machine_id, issue: serviceCase.issue,
      currentState: serviceCase.state, status: serviceCase.state, createdAt: serviceCase.created_at },
    quote: { provider: quote.provider_name, amount: quote.amount_inr, currency: 'INR', status: quote.quote_id ? 'ISSUED' : 'NONE' },
    authority: { authorityLimit: evaluation.policy_limit_inr ?? machine.autonomous_repair_limit_inr,
      withinAuthority: evaluation.decision === 'ALLOW', approvalRequired: serviceCase.requires_human },
    decision: { decision: evaluation.decision, evidence: evaluation.reason,
      rule: evaluation.action, action: serviceCase.next_action },
    commitment: { provider: appointment.provider_name, appointment: appointment.date,
      expectedTime: appointment.time_window, status: appointment.confirmed === true ? 'CONFIRMED' : 'NONE',
      completionStatus: serviceCase.provider_reported_complete === true ? 'PROVIDER_REPORTED_COMPLETE' : null },
    timeline: (serviceCase.timeline || []).map(event => ({ type: event.to_state,
      label: event.state_label, timestamp: event.timestamp, description: event.reason })),
    failure: serviceCase.failure ?? null,
    recovery: serviceCase.recovery ?? null,
    verification: { verificationStatus: serviceCase.verification_status,
      providerClaim: serviceCase.provider_reported_complete === true ? 'Provider reports completion' : null,
      householdResponse: verification.household_confirms_working ?? null, evidence: verification.reason },
  };
}

// Explicit opt-in, read-only source for an already-created local demo case. No case creation,
// progression, approval, verification or Pine/MCP calls occur here. Refresh errors propagate.
export async function createLocalCaseSource(caseId, api = stewardApi) {
  let snapshot;
  const listeners = new Set();
  async function refresh() {
    const [serviceCase, machine] = await Promise.all([api.case(caseId), api.machine()]);
    snapshot = mapPythonCase(serviceCase, machine);
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }
  await refresh();
  return { sourceKind: 'local_backend', getState: () => snapshot, refresh,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
