/**
 * Steward Backend Support Server (Phase 9A)
 *
 * Minimal read-oriented HTTP API providing canonical case state to the frontend adapter.
 * Uses native Node.js HTTP (zero external dependencies).
 * Zero autonomous decision logic - strictly serves validated canonical state.
 */

import http from 'node:http';
import { canonicalCaseStore } from './canonicalCaseStore.js';
import { CaseValidator } from './caseValidator.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

/**
 * Handle incoming HTTP requests
 */
export function handleRequest(req, res) {
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
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // 1. Health check
    if (pathname === '/health' || pathname === '/api/health') {
      res.writeHead(200, CORS_HEADERS);
      res.end(
        JSON.stringify({
          status: 'OK',
          service: 'steward-backend-support',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // 2. List all cases: GET /cases or /api/cases
    if (pathname === '/cases' || pathname === '/api/cases') {
      const cases = canonicalCaseStore.listCases();
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify({ cases, count: cases.length }));
      return;
    }

    // 3. Dynamic Case Routes: /cases/:caseId, /cases/:caseId/status, /cases/:caseId/memory, /cases/:caseId/timeline
    const caseMatch = pathname.match(/^\/(?:api\/)?cases\/([^/]+)(?:\/(status|memory|timeline))?$/);

    if (caseMatch) {
      const caseId = decodeURIComponent(caseMatch[1]);
      const subRoute = caseMatch[2]; // undefined, "status", "memory", or "timeline"

      const rawCase = canonicalCaseStore.getCase(caseId);

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

      // Security and schema audit before responding
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
        const statusData = canonicalCaseStore.getCaseStatus(caseId);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify(statusData));
        return;
      }

      if (subRoute === 'memory') {
        const memoryData = canonicalCaseStore.getCaseMemory(caseId);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify(memoryData));
        return;
      }

      if (subRoute === 'timeline') {
        const timelineData = canonicalCaseStore.getCaseTimeline(caseId);
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

/**
 * Factory function to create and start backend server
 */
export function createStewardBackendServer(port = 3001) {
  const server = http.createServer(handleRequest);
  return {
    server,
    start: () =>
      new Promise((resolve) => {
        server.listen(port, () => {
          console.log(`[Steward Backend] Support API running on http://localhost:${port}`);
          resolve(server);
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

// Auto-start if executed directly via node
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const port = parseInt(process.env.STEWARD_BACKEND_PORT || '3001', 10);
  const backend = createStewardBackendServer(port);
  backend.start();
}
