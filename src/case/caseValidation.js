/**
 * Case Data Model & Scenario Validation Suite (Phase 1)
 */

import { SCENARIO_KEYS } from './caseTypes';
import { mockCaseStore, MOCK_SCENARIOS } from './mockCaseStore';

export function runCaseDataValidation() {
  const results = [];

  // Test 6: CASE SCHEMA TEST
  const keys = [SCENARIO_KEYS.ACT, SCENARIO_KEYS.RESTRAIN, SCENARIO_KEYS.RECOVER];
  let schemaValid = true;
  for (const k of keys) {
    const sc = MOCK_SCENARIOS[k];
    if (
      !sc ||
      !sc.machine ||
      !sc.machineMemory ||
      !sc.currentCase ||
      !sc.quote ||
      !sc.authority ||
      !sc.decision ||
      !sc.commitment ||
      !sc.verification ||
      !sc.timeline
    ) {
      schemaValid = false;
    }
  }
  results.push({ test: 'TEST 6 — CASE SCHEMA TEST', pass: schemaValid });

  // Test 7: ACT DATA TEST
  const act = MOCK_SCENARIOS.ACT;
  const actPass =
    act.quote.amount === 900 &&
    act.authority.withinAuthority === true &&
    act.authority.approvalRequired === false &&
    act.decision.decision === 'PROCEED_AUTONOMOUSLY' &&
    act.verification.verificationStatus === 'VERIFIED' &&
    act.currentCase.status === 'CLOSED';
  results.push({ test: 'TEST 7 — ACT DATA TEST', pass: actPass });

  // Test 8: RESTRAIN DATA TEST
  const restrain = MOCK_SCENARIOS.RESTRAIN;
  const restrainPass =
    restrain.quote.amount === 3800 &&
    restrain.authority.withinAuthority === false &&
    restrain.authority.approvalRequired === true &&
    restrain.decision.decision === 'HUMAN_APPROVAL_REQUIRED' &&
    restrain.currentCase.status === 'RESTRAINED';
  results.push({ test: 'TEST 8 — RESTRAIN DATA TEST', pass: restrainPass });

  // Test 9: RECOVER DATA TEST
  const recover = MOCK_SCENARIOS.RECOVER;
  const recoverPass =
    recover.quote.amount === 900 &&
    recover.authority.withinAuthority === true &&
    recover.verification.verificationStatus === 'FAILED' &&
    recover.currentCase.status !== 'CLOSED';
  results.push({ test: 'TEST 9 — RECOVER DATA TEST', pass: recoverPass });

  // Test 10: DETERMINISM TEST
  let deterministic = true;
  for (const k of keys) {
    const json1 = JSON.stringify(mockCaseStore.loadScenario(k));
    for (let i = 0; i < 5; i++) {
      const jsonN = JSON.stringify(mockCaseStore.loadScenario(k));
      if (json1 !== jsonN) deterministic = false;
    }
  }
  results.push({ test: 'TEST 10 — DETERMINISM TEST', pass: deterministic });

  return results;
}
