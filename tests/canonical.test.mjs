import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapPythonCase, createLocalCaseSource } from '../src/api/caseSource.js';

test('canonical teammate suites and explicit case-source boundary', async () => {
  const root = process.cwd();
  const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-ui-tests-'));
  const server = await createServer({ root, configFile: false, cacheDir: path.join(runtime, 'vite-cache'),
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  process.chdir(runtime);
  try {
    const { runPhase9eTests } = await server.ssrLoadModule('/src/backend/tests/phase9eEndToEnd.test.js');
    const { testResults } = await runPhase9eTests();
    for (const result of testResults) assert.equal(result.pass, true, `${result.test}: ${result.details}`);
    console.log(`Canonical 9E: ${testResults.length} checks including 9A–9D and phase 1/7 regressions`);
    const { stewardCaseAdapter, normalizeCaseState } = await server.ssrLoadModule('/src/integration/stewardCaseAdapter.js');
    assert.equal(stewardCaseAdapter.getLiveIntegrationStatus().sourceKind, 'fixture');
    assert.equal(normalizeCaseState({ verification: { householdResponse: false } }).verification.householdResponse, false);
    const { VerificationStatus } = await server.ssrLoadModule('/src/components/Case/VerificationStatus.jsx');
    const negative = renderToStaticMarkup(React.createElement(VerificationStatus, { verification: { householdResponse: false } }));
    assert.match(negative, />false</);
    assert.doesNotMatch(negative, /Awaiting physical outcome verification/);
    const detach = stewardCaseAdapter.connectCaseSource({ getState: () => ({ currentCase: { currentState: 'VERIFYING' } }), subscribe: () => () => {} }, 'local_backend');
    assert.equal(stewardCaseAdapter.getLiveIntegrationStatus().sourceKind, 'local_backend');
    assert.equal(stewardCaseAdapter.getCaseData().currentCase.currentState, 'VERIFYING');
    detach(); assert.equal(stewardCaseAdapter.getLiveIntegrationStatus().sourceKind, 'fixture');
    assert.throws(() => stewardCaseAdapter.connectCaseSource({}, 'pine_events'), TypeError);
  } finally { process.chdir(root); await server.close(); await fs.rm(runtime, { recursive: true, force: true }); }
});

test('Python mapping preserves supplied authority and negative verification without closing', () => {
  const raw = { case_id: 'CASE-1', state: 'VERIFYING', requires_human: false, provider_reported_complete: true,
    quote: { amount_inr: 99999 }, verification_result: { household_confirms_working: false },
    authority_evaluations: [{ action: 'approve_repair', decision: 'DENY', reason: 'Explicit backend decision' }] };
  const before = JSON.stringify(raw); const mapped = mapPythonCase(raw);
  assert.equal(mapped.authority.withinAuthority, false); assert.equal(mapped.authority.approvalRequired, false);
  assert.equal(mapped.verification.householdResponse, false); assert.equal(mapped.currentCase.currentState, 'VERIFYING');
  assert.equal(mapped.decision.evidence, 'Explicit backend decision'); assert.equal(JSON.stringify(raw), before);
});

test('local read source propagates unavailable backend instead of fabricating fixture success', async () => {
  let fail = false;
  const api = { case: async () => { if (fail) throw new Error('offline'); return { case_id: 'CASE-1', state: 'VERIFYING' }; }, machine: async () => ({ machine_id: 'WM-001' }) };
  const source = await createLocalCaseSource('CASE-1', api); let calls = 0;
  const unsubscribe = source.subscribe(() => calls++); await source.refresh(); assert.equal(calls, 1);
  fail = true; await assert.rejects(source.refresh(), /offline/); assert.equal(calls, 1); unsubscribe();
});
