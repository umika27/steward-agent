# Round 3 integration and MCP deployment readiness

Prepared locally on 2026-10-04. Nothing staged, committed, pushed or deployed.
The canonical approved product is `origin/frontened@200eb68`. Default operation remains
its fixture demonstration. Browser voice input already works through its existing
microphone/transcript/Send interaction. Removing fixtures and enabling real automatic
Steward behavior requires a Pine event/runtime endpoint and authentication; neither is
configured. The local Python backend and MCP provider are simulations, not live Pine.

## A. Integration strategy

Selectively imported the canonical Git blobs for `src/`, `public/`, `index.html` and
`vite.config.js` into the primary repository on `ui`. No merge, index mutation or history
rewrite. Preserved reconstructed Python backend, all Phase-1 MCP modules, local API and
tests. Generated files from the teammate worktree were not copied. Package dependencies
and lockfile match the canonical project; retained/extended the local test script.
Before modifying source, installed canonical frontend dependencies, built/launched it,
ran the existing seven local frontend tests, attempted teammate regression suites, and
performed Chrome runtime checks. Initial failures were macOS sandbox/keychain access,
a concurrent Vite optimizer-cache collision, and genuine teammate runtime bugs described
below. No dependency upgrade or forced audit fix was performed.

## B. Git state and preservation

Before: branch `ui`, HEAD `f22ba44`; no staged changes; 33 modified tracked files
(9 source/config files plus 24 tracked bytecode files), 7 untracked source/test files.
Committed backend: `9414452`. Committed MCP: `f22ba44`. Canonical frontend: `200eb68`.
After: same branch/HEAD, no staged changes; 35 modified tracked files (including the
24 pre-existing tracked bytecode changes) and 123 untracked files. Integration source,
tests, docs and deployment configuration remain visible in the working tree. Exact final status is in the external review
backup. No uncommitted file was deleted. Overlapping old UI implementation was
intentionally superseded by canonical source, with originals and binary diff backed up:
`/tmp/steward-final-integration-backup-20261004/{files,manifest.json,changes-before.patch,status-before.txt}`.
The external backup is local temporary storage, not a substitute for a reviewed commit.

## C. Canonical teammate frontend preserved

App layout, room scene, Butler assets/animations, dialogue presentation, controls,
scenario dashboards, wording/navigation and interactions remain canonical.
`App.jsx`, `ConversationDemo.jsx`, `GameDialogueBox.jsx`, all image assets and all other
presentation components match the reference exactly except the one evidence-rendering
bug and whitespace fix below. Production CSS has the same content hash as the canonical
build. `round3-canonical-preservation.json` lists exact canonical file hashes and every
intentional difference; 140 of 145 source/assets/HTML files match byte-for-byte.
No assets were replaced. Canonical Vite wallpaper generation remains; its generated
outputs match the committed assets byte-for-byte on this macOS run. Its historical
Windows-only image-copy path remains a portability limitation, not an integration change.

Every changed teammate file:

| FILE | CHANGE TYPE | WHY REQUIRED | VISIBLE UI CHANGE |
| --- | --- | --- | --- |
| `src/backend/integration/runtimeCaseProvider.js` | BUG FIX | Construction reloaded existing cases and erased staged/restored runtime state; initialize only absent defaults | NONE |
| `src/backend/persistence/persistenceStore.js` | BUG FIX | Concurrent read-modify-write snapshots lost other cases; queue the entire operation, propagate corruption, allow retry after failed writes | NONE |
| `src/integration/stewardCaseAdapter.js` | INTEGRATION FIX / BUG FIX | Explicit attach/detach source labels, preserve negative household booleans, stop inferred recovery defaults, propagate attached-source failure instead of silently returning fixtures | NONE for approved fixtures |
| `src/components/Case/VerificationStatus.jsx` | BUG FIX | A boolean false household observation disappeared; render explicit booleans as text | NONE for approved fixtures; external boolean false now appears as `false` evidence |
| `src/components/Conversation/ConversationDemo.css` | TEST FIX | Removed one trailing blank line rejected by `git diff --check`; no CSS rule changed | NONE |
| `vite.config.js` | INTEGRATION FIX | Restore `/api` proxy to preserved Python server at 127.0.0.1:8000 | NONE |
| `package.json` | TEST FIX | Run retained tests plus canonical suites and new adapter regression checks | NONE |

New adapter files are INTEGRATION FIX: `src/api/caseSource.js` maps local Python snapshots
without price/state decisions; `src/api/casePresentation.js` preserves the older display
helper separately so canonical input-adapter source remains unchanged. Test additions
are TEST FIX. Importing canonical files changed the old local tree, not the teammate design.

## D. Local uncommitted functionality

Preserved `steward/api.py`, `steward/demo_application.py`, `tests/test_api.py`,
`src/api/steward.js`, `src/api/useSteward.js`, older `CaseDetails.jsx`, and frontend tests.
Approval/rejection, YES/NO verification, expected-state checks, errors, and demo memory
persistence remain available through the Python API. Older presentation components are
not inserted into the approved UI; they remain dormant/reference components. Old local
App, scene/dialogue and appended visual styles were superseded by canonical versions,
with their originals retained in the backup. The old case-presentation helper was moved
without visual integration, and its tests point to the new isolated file.

## E. Final frontend/data architecture

Default: canonical mock store → input/case adapters → approved React presentation.
The scripted room conversation still imports teammate demo reasoning/autonomy modules;
these are fixture behavior, not production Steward policy. They were preserved, not
exposed by MCP. Optional source: Python case+machine snapshots → `mapPythonCase` →
`createLocalCaseSource` → `stewardCaseAdapter.connectCaseSource(source,'local_backend')`.
Attach before mounting consumers; call `source.refresh()` explicitly. The source only
reads an already-created case: it never creates, advances, approves, verifies or closes it.
Disconnect/unmount consumers before switching sources. No polling/event connection is
claimed. `sourceKind` distinguishes `fixture`, `local_backend`, and explicitly supplied
`pine_events`; actual Pine transport is not implemented.

The mapping transports supplied authority decisions, current state and verification.
It does not compare quote prices, infer failed repair, create recovery or close cases.
A source error rejects, preserving last-known local data without fake fixture success.
The room narrative/Mock Controller still use demo data; attaching a dashboard source
alone does not make the entire product live. Production requires a complete Pine event
contract/transport and explicit loading/error handling, respecting the approved design.

## F. Steward feature coverage

| Feature | Coverage | Evidence/limit |
| --- | --- | --- |
| Machine identity, active case, state | FIXTURE | Canonical Bosch case dashboards; local Python WM-001 differs intentionally |
| Household identity | PARTIAL | Machine/location visible; no complete household profile |
| Timeline, quote, authority limit, decision reason | FIXTURE | Supplied canonical ACT/RESTRAIN/RECOVER records |
| Autonomous vs human-required status | FIXTURE | Read-only authority/approval cards |
| Approval/rejection interaction | MISSING in canonical UI | WORKING in retained local API and dormant older components |
| Appointment | FIXTURE / PARTIAL | Provider/time/status visible; canonical card lacks full booking reference detail |
| Outcome verification and independent provider claim | FIXTURE | Separate supplied provider and household evidence; negative booleans fixed |
| YES/NO verification interaction | MISSING in canonical UI | WORKING through retained Python API/older components |
| Continued ownership, failure/recovery evidence | FIXTURE | RECOVER remains non-closed; Python negative-verification API tested |
| Service history and cumulative spend | FIXTURE | Canonical memory card; local persistent machine API also tested |
| Loading/error behavior | PARTIAL | Scene loading and voice errors; default fixtures don't exercise live runtime outages |
| Room/dashboard controls and existing voice command input | WORKING | Chrome interaction tests; injected transcript enters input and Send handler |
| Real microphone/STT/network transcription | PARTIAL | Existing browser support/permission needed; real audio not tested |
| Actual Pine automatic decisions/event stream | MISSING | Endpoint/authentication absent; no fabricated live integration |

## G. MCP boundary proof

Official SDK low-level server + stateless JSON Streamable HTTP; separate SQLite store.
Static import/call audit and fresh-process tests prove MCP does not load `steward` or
`rails`, CaseManager, AuthorityEngine, repair/recovery/verifier orchestration, DemoApplication
or payments. Over-limit booking tests confirm MCP does not evaluate household authority.
Provider completion remains provider evidence; household observations remain separate.
Pine owns authority, repair/replacement, transitions, recovery, verification and closure.
The schemas, memory, provider, storage, server handlers, fixtures and requirements from
`f22ba44` are unchanged; only runtime environment configuration and README changed.

## H. Exact tool catalog

1. `get_machine_memory`: stored facts/history/preferences/revision/provenance.
2. `update_machine_memory`: typed factual updates, expected revision, durable idempotency.
3. `request_service_quote`: simulated quote, scope/missing terms/provider provenance.
4. `request_service_appointment`: executes a booking Pine already decided is allowed;
   validates quote associations/expiry and returns provider confirmation or uncertainty.
5. `get_service_status`: typed reference lookup of stored provider evidence; reads do not
   advance provider scenarios or imply household verification/closure.

No Gnani, Delhivery or Plural tool added. Existing README and schemas specify exact inputs.

## I. Verification

- Python discovery: **143 tests pass = 95 backend/API + 48 MCP** (original 39 plus
  7 configuration and 2 public-proxy transport tests).
- Frontend: **10 node:test cases pass** (retained 7 plus 3 new cases). Canonical case
  includes 15 Phase 9E checks and nested 9A/9B/9C/9D and Phase 1/7 regression suites.
  Some historical suite rows are declarative `pass: true`; they are not independent proof
  of visual preservation. Source hashes, CSS build hash and Chrome checks supply that proof.
- Production build: PASS, 1570 modules. Canonical CSS hash `index-DLK7GJPp.css` retained.
- HTTP discovery/invocation: exact five tools using official SDK; every tool invoked,
  malformed/not-found/conflict/timeout/auth errors tested. Public-proxy hostname + Origin
  with bearer authentication discovers all five and reads memory over localhost HTTP.
- Python proxy health: PASS via Vite `/api/health`; explicitly `local_demo` and `mock`.
- Chrome: room, information modal, dashboard, ACT/RESTRAIN/RECOVER selectors, close,
  scene switch and image loading pass. No JavaScript page exception or failed app asset.
  Pre-existing `/favicon.ico` 404 remains; strict audit script returns nonzero for that
  console entry, not an application interaction failure. No favicon/design change made.
- Voice: injected browser recognition result → existing transcript input → Send/handler
  PASS. Does not prove actual microphone or external recognition-service availability.
- `git diff --check`: PASS. MCP `pip check`: PASS.
- `render.yaml`: YAML parse and official Render JSON Schema validation PASS;
  no Render account semantic validation, Linux build or actual deployment performed.
- `npm audit`: existing 1 moderate esbuild + 1 high Vite finding. No forced upgrade;
  dev server is local. MCP deployment does not install or run Node/Vite.

Evidence outside repository: `/tmp/steward-final-python-tests.log`,
`/tmp/steward-final-mcp-verification.json`, `/tmp/steward-browser/{canonical,integrated,final}-*.png`.
In-app browser automation was unavailable; isolated headless installed Chrome was used.

## J. Hygiene

24 historical tracked `.pyc` files remain dirty and preserved. Ignore rules do not untrack
existing files. Do not stage those cache changes. Primary HEAD tracks no node_modules,
dist, runtime SQLite or .env files; teammate history has generated dependencies, and those
were not imported. New SQLite files/journals, secrets, build/cache outputs and teammate
runtime/test JSON files are ignored. Runtime tests use temporary directories; canonical
machine fixtures are unchanged. No credentials were introduced or printed.

## K–P. Deployment artifacts, commands, registration and manual actions

Added root `render.yaml` and `integrations/steward_mcp/DEPLOYMENT.md`; changed environment
configuration/README/ignore rules and added deployment tests. Native Python hosting is
sufficient; no Docker/Kubernetes/database infrastructure added. See DEPLOYMENT.md for
exact launch/build/start commands, environment precedence and manual steps.

Local MCP command:

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m integrations.steward_mcp.server --host 127.0.0.1 --port 8001 --database /tmp/steward-mcp-phase1-runtime/runtime.sqlite3 --scenario normal
```

Render: root repository, Python 3.13.7; build
`python -m pip install -r integrations/steward_mcp/requirements.txt`; start
`python -B -m integrations.steward_mcp.server`; `MCP_HOST=0.0.0.0`; platform `PORT`;
`MCP_DATABASE_PATH=/var/data/steward_mcp/runtime.sqlite3`; 1 GB persistent disk mounted
at `/var/data/steward_mcp`; `MCP_SCENARIO=normal`; secret `MCP_AUTH_TOKEN` at least 32
characters. Render-provided hostname populates restrictive Host/Origin security.
Public HTTPS is supplied by Render. `/healthz` public liveness; `/mcp` protected MCP.
Plan `0.5c-512mb` is paid; automatic deploy trigger off. Blueprint creation still deploys.

Manual: review/commit intended source, then push when chosen; create Render Blueprint or
Web Service, configure secret/disk, manually deploy; verify HTTPS health/discovery,
invoke all five tools and replay/restart persistence; register in AgenticOrg, attach tools,
prove Pine invocation. None of these external actions was taken.
Connector: name `Steward Phase 1 External Tools`, URL `https://<assigned-host>/mcp`,
transport Streamable HTTP. Auth `custom` ONLY if it supports arbitrary headers:
`Authorization: Bearer <MCP_AUTH_TOKEN>`. `api_key` is suitable only if it can send that
exact header/value. No `X-API-Key`, no bare token, no unauthenticated public configuration.
AgenticOrg compatibility is conditional and must be proven in its actual registration UI.

Official references: [web service port binding](https://render.com/docs/web-services),
[Blueprint fields](https://render.com/docs/blueprint-spec),
[persistent disks](https://render.com/docs/disks),
[Python version](https://render.com/docs/python-version).

## Q. Limitations/conflicts

Approved frontend is a demo, not a live automated product. Live fixture removal awaits
runtime choice/real Pine endpoint and authentication. The backend API can simulate
policy/case flows but must remain reference/demo in production. Canonical Node fixture
server on 3001 and Python API on 8000 are different contracts; `/api` targets Python;
MCP on 8001 is independent. No endpoint collision or MCP routing through Vite.
Fixtures have different machine IDs between canonical UI and Python/MCP; they are not
silently merged. New read adapter omits failure/recovery if Python doesn't explicitly
supply those records and does not invent them from a state name.
Browser voice requires supported browser/permission and often a network speech service;
user must press Send, preserving the approved interaction. No auto-submit, Gnani or TTS
was added. Real Pine, HTTPS/Linux hosting, auth-form compatibility and remote persistence
remain unproven. Direct MCP dependencies pinned, transitive environment not fully locked.
SQLite deployment is one instance; persistent disk limits scaling and zero-downtime deploys.

## R. Remaining Round 3 work and commit scope

Register MCP with AgenticOrg; attach exactly five tools to Steward; prove Pine → MCP
invocation; agree and connect a real Pine-to-frontend event source; implement Gnani and
Delhivery later; test native Pine/Plural payments; run evaluation suite and capture recordings.

Review and commit the exact files in `round3-commit-files.txt` together: canonical source
imports/assets, preserved Python/API work and tests, integration fixes/adapters, MCP
configuration/transport tests, ignore rules, Render Blueprint and documentation. Existing
MCP implementation is already committed in `f22ba44`. Exclude all tracked bytecode changes,
node_modules, dist, runtime stores, secret files and the external backup. The manifest is
an explicit review list, not a command to stage all working-tree contents.
