/**
 * Runtime API Bridge (Phase 9C)
 *
 * Dispatches HTTP requests to runtime-backed case providers.
 * Conforms strictly to the Phase 9A HTTP route and CORS contracts.
 */

import { runtimeCaseProvider } from './runtimeCaseProvider.js';
import { CaseValidator } from '../caseValidator.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

/**
 * Handle HTTP request backed by runtimeCaseProvider
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} provider - Runtime case provider instance
 */
export function handleRuntimeApiRequest(req, res, provider = runtimeCaseProvider) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Strictly Read-Only API
  if (req.method !== 'GET') {
    res.writeHead(405, CORS_HEADERS);
    res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are supported' }));
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // 1. Health check
    if (pathname === '/health' || pathname === '/api/health') {
      res.writeHead(200, CORS_HEADERS);
      res.end(
        JSON.stringify({
          status: 'OK',
          service: 'steward-backend-runtime-bridge',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // 2. List cases: GET /cases or /api/cases
    if (pathname === '/cases' || pathname === '/api/cases') {
      const cases = provider.listCases();
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify({ cases, count: cases.length }));
      return;
    }

    // 3. Dynamic Case Routes: /cases/:caseId, /cases/:caseId/status, /cases/:caseId/memory, /cases/:caseId/timeline
    const caseMatch = pathname.match(/^\/(?:api\/)?cases\/([^/]+)(?:\/(status|memory|timeline))?$/);

    if (caseMatch) {
      const caseId = decodeURIComponent(caseMatch[1]);
      const subRoute = caseMatch[2]; // undefined, "status", "memory", or "timeline"

      const rawCase = provider.getCase(caseId);

      if (!rawCase) {
        res.writeHead(404, CORS_HEADERS);
        res.end(
          JSON.stringify({
            error: 'CASE_NOT_FOUND',
            message: `Case with identifier "${caseId}" was not found`,
          })
        );
        return;
      }

      // Validate schema and security
      const validation = CaseValidator.validateCase(rawCase);
      if (!validation.valid) {
        res.writeHead(500, CORS_HEADERS);
        res.end(
          JSON.stringify({
            error: 'DATA_INTEGRITY_ERROR',
            message: 'Case data failed backend integrity validation',
            details: validation.errors,
          })
        );
        return;
      }

      // Sub-route responses
      if (subRoute === 'status') {
        const statusData = provider.getStatus(caseId);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify(statusData));
        return;
      }

      if (subRoute === 'memory') {
        const memoryData = provider.getMemory(caseId);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify(memoryData));
        return;
      }

      if (subRoute === 'timeline') {
        const timelineData = provider.getTimeline(caseId);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify(timelineData));
        return;
      }

      // Full Case payload
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify(rawCase));
      return;
    }

    // 4. Unknown route
    res.writeHead(404, CORS_HEADERS);
    res.end(JSON.stringify({ error: 'ROUTE_NOT_FOUND', message: `Route "${pathname}" not recognized` }));
  } catch (err) {
    res.writeHead(500, CORS_HEADERS);
    res.end(
      JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred processing the request',
      })
    );
  }
}
