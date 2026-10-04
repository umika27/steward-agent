import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { casePresentation } from '../src/api/casePresentation.js';
import { stewardApi } from '../src/api/steward.js';

let server, CaseDetails, CaseActions, cacheDir;
before(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-legacy-ui-cache-'));
  server = await createServer({ cacheDir, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ CaseDetails, CaseActions } = await server.ssrLoadModule('/src/components/Conversation/CaseDetails.jsx'));
});
after(async () => { await server?.close(); if (cacheDir) await fs.rm(cacheDir, { recursive: true, force: true }); });

const runtime = (serviceCase) => ({ serviceCase, machine: null, busy: false, health: { status: 'ok' },
  report() {}, approve() {}, verify() {}, refresh() {}, reset() {}, advance() {} });
const caseData = (extra = {}) => ({ case_id: 'CASE-FROM-PYTHON', state: 'VERIFYING', state_label: 'Waiting for household verification',
  issue: 'Not draining', next_action: 'Is the washing machine draining normally now?',
  actions: { verification: true, approval: false, advance_demo: false }, authority_evaluations: [], timeline: [], ...extra });

test('provider completion presentation never claims closure', () => {
  const presentation = casePresentation(caseData());
  assert.match(presentation.text, /household verification/);
  assert.notEqual(presentation.status, 'success');
});
test('closed presentation uses the backend label and success emotion only after response', () => {
  assert.equal(casePresentation(caseData({ state: 'CLOSED', state_label: 'Case closed' })).status, 'success');
});
test('approval card renders backend reason and explicit decisions', () => {
  const html = renderToStaticMarkup(React.createElement(CaseDetails, { runtime: runtime(caseData({
    state: 'HUMAN_APPROVAL_REQUIRED', actions: { approval: true },
    quote: { amount_inr: 3800, provider_name: 'Mock provider' },
    authority_evaluations: [{ action: 'approve_repair', reason: 'Backend requires human approval at this limit' }],
  })), onReported() {} }));
  assert.match(html, /₹3800/);
  assert.match(html, /Backend requires human approval at this limit/);
  assert.match(html, />Approve</);
  assert.match(html, />Reject</);
  assert.doesNotMatch(html, /Yes, it/);
});
test('verification interaction exposes both household choices', () => {
  const html = renderToStaticMarkup(React.createElement(CaseActions, { runtime: runtime(caseData()) }));
  assert.match(html, /Yes, it’s working/);
  assert.match(html, /No, the problem remains/);
});
test('timeline renders supplied backend events only', () => {
  const html = renderToStaticMarkup(React.createElement(CaseDetails, { runtime: runtime(caseData({ timeline: [{
    timestamp: '2026-09-25T12:00:00Z', state_label: 'Provider contacted', reason: '[MOCK] Actual event from Python', actor: 'steward',
  }] })), onReported() {} }));
  assert.match(html, /Actual event from Python/);
  assert.match(html, /CASE-FROM-PYTHON/);
  assert.doesNotMatch(html, /Confirmed order/);
});
test('API client sends strict boolean verification and the observed state', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/cases/CASE-FROM-PYTHON/verification');
      assert.deepEqual(JSON.parse(options.body), { working: false, expected_state: 'VERIFYING' });
      return { ok: true, json: async () => ({ state: 'REASSESS_REPAIR_VS_REPLACE' }) };
    };
    assert.equal((await stewardApi.verify(caseData(), false)).state, 'REASSESS_REPAIR_VS_REPLACE');
  } finally { globalThis.fetch = original; }
});
test('API client preserves domain errors instead of fabricating success', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 409,
      json: async () => ({ error: { code: 'DOMAIN_REJECTED', message: 'Verification is required' } }) });
    await assert.rejects(stewardApi.advance(caseData()), (error) => error.status === 409 && error.message === 'Verification is required');
    globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
    await assert.rejects(stewardApi.health(), /Cannot reach Steward/);
  } finally { globalThis.fetch = original; }
});
