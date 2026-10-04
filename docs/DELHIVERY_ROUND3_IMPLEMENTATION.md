# Round-3 Delhivery mock implementation and readiness

Implemented one independent `delhivery-mock-rail` deployment: Pine's three-tool
Streamable HTTP MCP bridge calls our Delhivery-compatible mock HTTP request routes
through in-process HTTP transport. No live Delhivery/Gnani calls, public Delhivery
MCP, Steward reasoning imports, frontend changes, commits, pushes or deployments.
Pine remains the sole brain; Plural payments stay native to Pine.

## Exact files in this task

Added:

- `integrations/delhivery_mock/__init__.py`
- `integrations/delhivery_mock/config.py`
- `integrations/delhivery_mock/schemas.py`
- `integrations/delhivery_mock/storage.py`
- `integrations/delhivery_mock/http.py`
- `integrations/delhivery_mock/adapter.py`
- `integrations/delhivery_mock/server.py`
- `integrations/delhivery_mock/smoke.py`
- `integrations/delhivery_mock/requirements.txt`
- `integrations/delhivery_mock/README.md`
- `tests/test_delhivery_mock.py`
- `tests/test_delhivery_transport.py`
- `tests/test_delhivery_smoke.py`
- `evidence/delhivery_round3_mock_smoke.json`
- `docs/DELHIVERY_ROUND3_IMPLEMENTATION.md`

Modified existing working-tree files:

- `.gitignore`: ignore this rail's local runtime folder.
- `render.yaml`: append independent mock/MCP service; prior two entries unchanged.
- `docs/round3-commit-files.txt`: add these new reviewable files; no staging.

## Contracts and scenarios

Exact underlying endpoints:

- `GET /c/api/pin-codes/json/?filter_codes=<one pincode>`
- `POST /api/cmu/create.json` with URL-encoded `format=json&data=<manifest>`
- `GET /api/v1/packages/json/?waybill=<one waybill>&ref_ids=<optional order>`

All require `Authorization: Token <DELHIVERY_MOCK_TOKEN>`. Readable MCP tools are
`check_delivery_serviceability`, `create_part_shipment`, `track_part_shipment`.
No tools were added to Steward's existing five-tool catalog.

Ten deterministic scenarios: NORMAL_SERVICEABLE, EMBARGO, NSZ, SHIPMENT_CREATED,
NO_RIDER_OR_CAPACITY, TIMEOUT, MALFORMED_RESPONSE, IN_TRANSIT, DELIVERED,
DELIVERY_EXCEPTION. Explicit MCP `simulation_scenario`, separate HTTP
`X-Mock-Scenario`, or deployment configuration selects the fixture.

The supplied B2C documentation has no complete authoritative response schemas.
Every response fixture/status/error outside documented semantics is labeled
SIMULATION. Empty serviceability list means NSZ; Embargo/blank remark semantics
remain intact. Only Prepaid forward SPS is enabled. REPL is not used merely
because a repair part is called a replacement. Both documented `return_add` and
`return_address` remain accepted, without asserting undocumented optional types.

## Persistence, auth and evidence

Separate private SQLite stores order, deterministic synthetic waybill, normalized
manifest, created timestamp, logistics status and deduplicated scan history.
Identical requests replay the existing shipment; different payload for the same
order or colliding waybill gets simulated 409. Transactions serialize concurrent
creation and persist across process restarts. Polling does not autonomously
advance a shipment; explicit evaluation controls change logistics fixtures.

Mock HTTP token and MCP bearer token are required, distinct and at least 32
printable ASCII characters. Missing/invalid auth fails explicitly. Host/Origin
validation protects remote MCP. Access logging is off; evidence excludes tokens,
names, phones, addresses and raw order IDs. Order hashes and waybills correlate
calls. Full synthetic shipment inputs remain in private mode-0600 SQLite.

The recorded offline smoke receipt includes 18 actual adapter-to-mock HTTP calls,
all expected-result assertions PASS, ten scenarios, and zero live provider calls.
Every receipt is labeled MOCK. Failure receipts retain `success=false`; successful
assertion of an expected failure never relabels that operation as successful.

## Verified results

| Category | Result |
| --- | --- |
| Delhivery | 81 PASS: 72 HTTP/storage/adapter/boundary, 7 real HTTP MCP transport, 2 smoke integrity |
| Gnani | 58 PASS; upstream mocked |
| Steward MCP | 48 PASS, same five tools |
| Backend/API | 95 PASS |
| All Python | 282 PASS |
| Frontend | 10 PASS; includes 15 embedded canonical 9E checks |
| Frontend build | PASS, 1,570 modules |
| Render | PASS against cached official Blueprint JSON schema; existing two services unchanged |
| Dependencies | `pip check` PASS; no new dependency installation |
| Whitespace | `git diff --check` PASS |

Python command: `python -B -m unittest discover -s tests -q` in the existing
`/tmp/steward-mcp-phase1-venv` environment. The sandbox initially denied localhost
binds; rerunning with approved local-test permissions passed. Expected existing
backend failure-path tests emit a simulated disk-full traceback while passing.
Starlette emits a TestClient/httpx deprecation warning; it does not affect results
and does not justify a dependency change under this deadline.

Before/after SHA-256 comparison preserves every frontend/public asset, backend/
rail source, existing Steward MCP and Gnani integration file in the snapshot.
Only `.gitignore` and `render.yaml` changed among those snapshot paths. Thus this
task introduces **zero visible frontend changes**; previous working-tree UI
differences were already present and were not overwritten. Source/build
preservation is established without claiming a newly performed screenshot audit.
The build retains `index-e-1qtpIJ.js` and `index-DLK7GJPp.css` asset hashes.

Boundary tests reject production imports of Steward case/authority/repair/
verification/recovery/payment engines and case-decision inputs. DELIVERED returns
only logistics facts, never RESOLVED/CLOSED or case_status. An isolated existing
AWAITING_PART case stays byte-for-byte equivalent in representation after a
delivered result; its closure invariant remains unsatisfied.

## Deployment and exact registration template

Full setup and examples: `integrations/delhivery_mock/README.md`.

Render service: `delhivery-mock-rail`, Python 3.13.7, paid 0.5c-512mb instance,
1-GB persistent disk mounted at `/var/data/delhivery_mock`, health `/healthz`,
automatic deploys off. Start: `python -B -m integrations.delhivery_mock.server`.
Build: `python -m pip install -r integrations/delhivery_mock/requirements.txt`.
Database: `/var/data/delhivery_mock/shipments.sqlite3`.

Exact required secret names: `DELHIVERY_MOCK_TOKEN`, `DELHIVERY_MCP_AUTH_TOKEN`.
No real Delhivery credential is needed. Host binding is `DELHIVERY_HOST=0.0.0.0`;
Render supplies PORT and RENDER_EXTERNAL_HOSTNAME. Warehouse defaults to exactly
`Steward Mock Warehouse`; default scenario is NORMAL_SERVICEABLE.

AgenticOrg registration:

- Name: `Delhivery Mock Logistics Rail`
- Transport: `Streamable HTTP`
- URL: `https://<actual-render-assigned-hostname>/mcp`
- Header: `Authorization: Bearer <DELHIVERY_MCP_AUTH_TOKEN>`
- Discovery: only the three named logistics tools.

These are concrete registration values with a hostname placeholder, not a claim
of completed deployment or registration. AgenticOrg needs header-authenticated
Streamable HTTP support; this service does not provide OAuth.

## Example flows

Normal: provider identifies a drain pump; Pine checks serviceability; Pine submits
one Prepaid Surface SPS order; mock returns synthetic waybill; Pine maintains
AWAITING_PART; tracking returns IN_TRANSIT then DELIVERED. Pine must continue to
technician installation and household verification before deciding resolution.
The logistics rail never changes or closes the case.

Embargo/NSZ: serviceability says non-serviceable; manifestation fails explicitly
with PINCODE_NOT_SERVICEABLE and no shipment. Pine chooses the next action.

Timeout/malformed: controlled TIMEOUT is a simulated bounded 504, not a real
network delay; invalid-JSON fixture becomes MALFORMED_RESPONSE. Both remain MCP
errors, create no shipment and trigger no automatic retries or fallback.

## Git safety and remaining work

Pre-existing substantial modified/untracked work was preserved; no files staged,
committed, pushed, reset, cleaned, stashed, merged or rebased. Existing tracked
bytecode changes were present before this task and were not included in the
review manifest. The snapshot and original status are in
`/tmp/steward-delhivery-before-20261004/`.
Final working-tree status: 35 modified tracked files (pre-existing count),
152 untracked files including this task's 15 additions, zero staged files.
The updated review manifest lists 163 source/documentation/assets files.

Remaining external blockers: deploy with the two generated secrets and persistent
disk, obtain the actual HTTPS hostname, register in AgenticOrg, and verify remote
discovery plus a Pine-controlled complete replacement-part flow. Local mock code
and transport are verified; actual Pine connectivity has not been exercised.
The approved frontend remains as it was, rather than adding a new logistics UI.
Gnani live STT stays confirmed; live TTS remains unverified/rate-limited, and no
further live Gnani call was made in this task.

Next highest-priority Round-3 task: deploy/register the three independent rails
and prove the real AgenticOrg agent owns the replacement-part workflow, including
delivery followed by installation and household verification before closure.
