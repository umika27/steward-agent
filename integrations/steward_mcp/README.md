# Steward Round-3 MCP Phase 1

Pine / AgenticOrg owns Steward reasoning, household authority, repair-versus-replacement
decisions, case orchestration, recovery, outcome verification and closure. This package
exposes external facts and provider actions through the official MCP Python SDK.
It imports no Steward decision modules, makes no LLM calls and has no payment rail.

All appliance-provider operations are deterministic simulations. Gnani speech-to-text /
text-to-speech and Delhivery serviceability / shipment creation / tracking are deliberately
outside Phase 1. Pine Labs / Plural payments remain a native AgenticOrg connector.
No vendor credentials are assumed or required for this simulator.

For independent public HTTPS hosting, environment aliases, persistent storage and
AgenticOrg registration, see [DEPLOYMENT.md](DEPLOYMENT.md). No deployment has been performed.

## Local setup and launch

Run from the repository root with Python 3.10+ and an available IANA timezone database:

```sh
python3 -m venv /tmp/steward-mcp-phase1-venv
/tmp/steward-mcp-phase1-venv/bin/python -m pip install -r integrations/steward_mcp/requirements.txt
/tmp/steward-mcp-phase1-venv/bin/python -B -m integrations.steward_mcp.server --host 127.0.0.1 --port 8001 --database /tmp/steward-mcp-phase1-runtime/runtime.sqlite3 --scenario normal
```

Local MCP URL: **http://127.0.0.1:8001/mcp** (no trailing slash).
Health: **http://127.0.0.1:8001/healthz**. `/healthz` is intentionally unauthenticated
and returns only liveness, simulated provider mode and tool count.

This is a separate process from the browser API on port 8000. The Vite `/api` proxy
continues to serve the existing frontend. Nothing in this package edits frontend state
or writes to `data/machines` or `tmp/ui_runtime`.

The direct dependency versions are pinned in `requirements.txt`: official `mcp==1.30.0`,
`pydantic==2.13.5`, `starlette==1.7.0`, `uvicorn==0.54.0`, `httpx==0.28.1`,
and `anyio==4.15.1`. The SDK's supported v1 maintenance line was chosen explicitly;
do not upgrade to SDK v2 without rerunning transport acceptance tests. Transitive
dependencies are resolved by pip and are not a complete frozen environment lock.

## Five discovered tools

Every input and result has an explicit JSON Schema. Unknown fields are rejected.
There is no tool-level `scenario`, approval flag, case state or arbitrary payload field.

| Tool | Input | Returned evidence |
| --- | --- | --- |
| `get_machine_memory` | `machine_id` | Machine facts, preferences, history, revision, provenance, retrieval time |
| `update_machine_memory` | `machine_id`, `case_id`, `expected_revision`, `idempotency_key`, `updates` | Persisted record IDs, new revision, replay receipt |
| `request_service_quote` | `machine_id`, `case_id`, `provider_id`, `issue_description`, `idempotency_key` | Simulated quote, integer `amount_inr`, charge scope, exclusions, expiry, missing information |
| `request_service_appointment` | `machine_id`, `case_id`, `provider_id`, `quote_id`, `requested_slot`, `idempotency_key` | Booking request reference, provider result, concrete or incomplete terms |
| `get_service_status` | `reference: {type, id}` | Stored provider status, claims and associated quote/booking details |

`requested_slot` has `date` (`YYYY-MM-DD`), `start_time`, `end_time` (24-hour `HH:MM`)
and an IANA `timezone`, such as `Asia/Kolkata`. End time must follow start time on the
same date. This validates the transaction shape; it does not check household availability.

`reference.type` is `QUOTE`, `APPOINTMENT` or `APPOINTMENT_REQUEST`. Confirmed simulator
bookings have both a `request_id` and an `appointment_id`. Incomplete commitments have
only a request ID; their `appointment_id` and unreported provider terms stay null.
Use `APPOINTMENT_REQUEST` to inspect these requests. Timeout errors return no invented
appointment or booking reference.

The configured fixture provider is `PRV-SAM-BLR-01`. Its name and sample
`SAM-BLR-99201` reference are simulation data, not proof of a live booking.
The normal INR 900 quote is explicitly `VISITING_CHARGE`, with repair labour and parts
excluded. `over_limit` returns INR 3800 as `FULL_REPAIR`. Both are returned without
household authority evaluation. Pine decides whether and when to request a booking.

Booking statuses are `REQUESTED`, `CONFIRMED`, `REJECTED`, `UNKNOWN`. A confirmed result
requires a provider reference and a complete slot. Rejections and ambiguous failures are
MCP errors with an explicit `provider_booking_status` where applicable.

## Factual memory updates

WM-001 is imported once from the canonical fixture into a narrow public factual schema.
Legacy case/lifecycle fields and authority decisions are not projected into this schema.
The INR 1500 repair-limit preference and INR 24000 replacement estimate are stored facts.
Historical household-confirmation evidence is preserved as a fixture reference.

`updates` is a batch of 1–20 discriminated records:

| `type` | Required record fields beyond `record_id` and `evidence` |
| --- | --- |
| `append_failure` | `date`, `problem`, `fault_type`; optional `notes` |
| `append_service_event` | `event`, `details` |
| `append_household_observation` | `working` (strict boolean), `notes` |
| `append_repair_record` | `date`, `problem`, `work_description`, `amount_inr`, `provider_name` |

Service events are `PROVIDER_CONTACT`, `VISIT_REPORTED`, `PROVIDER_REPORTED_COMPLETE`,
`PART_REQUIRED`, `NO_SHOW` or `NOTE`. Provider-completion events require a `PROVIDER`
evidence source; household observations require `HOUSEHOLD`. Each evidence record contains
`source`, `reference`, offset-aware `observed_at` and explicit `is_simulated`.
The outer `case_id` is an opaque Pine correlation identifier, not a locally managed case.

Repair records may also contain `provider_id`, `parts_replaced`, and a
`household_confirmation_reference`. For new records, this reference must point to an
already supplied household-observation record ID for the same case (including an earlier
record in the same batch). It preserves a linkage; the server does not interpret the
observation's physical outcome. A provider claim never generates a household observation.

Appending a repair records Pine-supplied work/expense and mechanically adds `amount_inr`
to cumulative recorded repair spend. It does not assert successful repair, resolve a
failure, change lifecycle/case state or close anything. Whole INR amounts are used;
floats, booleans and negative amounts are rejected. Other machine fields and household
authority preferences cannot be replaced through the update tool.

Example `update_machine_memory` arguments:

```json
{
  "machine_id": "WM-001",
  "case_id": "CASE-DEMO-1",
  "expected_revision": 1,
  "idempotency_key": "memory-demo-1",
  "updates": [{
    "type": "append_failure",
    "record_id": "FAIL-DEMO-1",
    "date": "2026-10-03",
    "problem": "not draining",
    "fault_type": "drainage",
    "evidence": {
      "source": "HOUSEHOLD",
      "reference": "demo-household-report-1",
      "observed_at": "2026-10-03T12:00:00+05:30",
      "is_simulated": true
    }
  }]
}
```

Evidence labels/references are caller-supplied facts. The shared-token boundary authenticates
the integration caller, not an individual household member or the truth of an observation.
Pine must retain the actual household evidence and approval process.

## Storage and retry behavior

SQLite stores separate `machines`, `provider_records` and `receipts` tables. The machine
document and revision, or provider record, are committed in the same transaction as their
idempotency receipt. `BEGIN IMMEDIATE`, SQLite locking, full synchronous commits and a
10-second busy timeout prevent lost updates in the intended single-instance deployment.
There is no distributed concurrency layer.

The default database is `~/.local/share/steward_mcp/runtime.sqlite3`; the local command above
uses `/tmp/steward-mcp-phase1-runtime/runtime.sqlite3` instead. `/tmp` is for local demos only,
not durable deployment. Use a writable persistent volume for deployment and back up the
database. Protected source/fixture/UI directories are rejected as runtime paths.

Revision starts at 1 and increases once per successful batch. Stale writes return
`VERSION_CONFLICT`. A receipt lookup precedes revision checking, so a successful original
request can be replayed using its original revision after later writes.

Idempotency keys are scoped by tool operation within this single-household store. The
same key and normalized arguments replay the persisted result; different arguments return
`IDEMPOTENCY_CONFLICT`. Preserve the original arguments when retrying. `replayed=true`
does not create new records. Duplicate record IDs are rejected. A new booking key for an
already booked quote and the same requested slot returns the existing request; a different
slot is rejected. Rescheduling requires Pine to obtain a new quote/request in this demo.

Simulated provider-unavailable and booking failure/timeout receipts persist too. Replaying
an ambiguous request cannot become confirmation after a restart. Changing the startup
scenario affects new quotations only. Existing quotations retain their captured scenario,
and bookings/status queries follow it. Quote expiry is seven days from creation and uses
the server clock. The simulator IDs are deterministic; timestamps reflect real observation
and retrieval times. Status polling never writes records or progresses a scenario.

## Deterministic scenarios

Select a scenario explicitly with `--scenario NAME` or `STEWARD_MCP_SCENARIO=NAME`.
Fixture values are in `fixtures/provider_scenarios.json`.

| Scenario | Result |
| --- | --- |
| `normal` | INR 900 visiting charge, confirmed requested slot, `SCHEDULED` |
| `over_limit` | INR 3800 full repair quote; no authority decision |
| `incomplete_commitment` | Date/start known, missing end/reference; `REQUESTED`, no appointment ID |
| `provider_unavailable` | Quote fails with `PROVIDER_UNAVAILABLE` |
| `appointment_provider_unavailable` | Quote available; booking fails with `PROVIDER_UNAVAILABLE` |
| `slot_unavailable` | Booking fails with `SLOT_UNAVAILABLE` / `REJECTED` |
| `ambiguous_timeout` | Booking fails with `OUTCOME_UNKNOWN` / `UNKNOWN`; no invented ID |
| `malformed` | Quote preserves null amount/diagnosis/expiry and `UNKNOWN` charge scope; booking outcome unknown |
| `no_show` | Persisted appointment status `NO_SHOW` |
| `part_required` | `PART_REQUIRED`, with a provider claim |
| `provider_reported_complete` | Provider completion claim; no household verification |
| `technician_en_route` | `TECHNICIAN_EN_ROUTE` |
| `service_attempted` | `SERVICE_ATTEMPTED` |
| `cancelled` | `CANCELLED` |
| `unknown` | Confirmed booking with unknown subsequent provider status |

Use a separate test database or new idempotency/quote keys for independent scenario runs.
There is no exposed scenario-mutation tool or generic orchestration tool.

## Error contract

Tool errors set MCP `isError=true` and structured `success=false`, with `error.code`,
`error.message` and provenance. Supported codes:

```text
NOT_FOUND INVALID_ARGUMENT VERSION_CONFLICT IDEMPOTENCY_CONFLICT
PROVIDER_UNAVAILABLE QUOTE_EXPIRED SLOT_UNAVAILABLE OUTCOME_UNKNOWN NOT_CONFIGURED
```

Missing arguments, unknown fields, malformed IDs, non-integer INR, invalid dates/timezones
and wrongly attributed evidence are rejected. Provider quote/machine/case associations
and expiry are validated before booking. These are transaction-integrity checks.
Errors do not invent successful provider actions. An incomplete quote is a successful
retrieval of incomplete evidence, not a complete quotation or permission to book.
Invalid MCP/HTTP envelopes can fail at the protocol layer before a tool executes.

## Public deployment and AgenticOrg registration

Remote AgenticOrg cannot reach this laptop's loopback address. Deploy one application
instance with persistent storage and expose **https://YOUR_HOST/mcp** through TLS
termination. The default transport is stateless Streamable HTTP with JSON responses;
business records and receipts persist independently of MCP sessions. The SDK owns
protocol handling and its lifespan. No Vite proxy change is needed.

For a non-loopback bind, configure these environment variables in the deployment secret
manager/runtime (do not put the token in source or a command-line argument):

```text
STEWARD_MCP_HOST=0.0.0.0
STEWARD_MCP_PORT=8001
STEWARD_MCP_DATABASE=/persistent/steward_mcp/runtime.sqlite3
STEWARD_MCP_PUBLIC_HOST=YOUR_HOST
STEWARD_MCP_BEARER_TOKEN=<random secret of at least 32 characters>
```

Launch from the repository root:

```sh
python -B -m integrations.steward_mcp.server
```

The client sends `Authorization: Bearer <token>` to `/mcp`. Configure the reverse proxy
to preserve the public Host or use the permitted internal Host, and preserve MCP protocol
and Accept headers. SDK Host/Origin validation remains enabled; the configured public
hostname is explicitly allowed. Do not expose an unauthenticated localhost-mode server
through a tunnel. This package provides a shared bearer-token gate, not OAuth discovery,
per-user authorization or multi-tenant isolation. Confirm AgenticOrg's supported
authentication configuration before choosing the deployment boundary.

Registration procedure for the intended environment:

1. **Dashboard → Connectors → Register Connector**.
2. Check **MCP**.
3. Enter the public HTTPS MCP URL ending in **/mcp**.
4. Configure the supported authentication mechanism and credentials.
5. Verify discovery contains exactly the five tools and invoke each from AgenticOrg.
6. Keep Pine Labs / Plural payments configured through its native connector.

This implementation has only been tested with the official SDK client on localhost.
**AgenticOrg compatibility is unverified until the deployed server is registered and
tested in the target environment.** No deployment or registration is performed here.

## Verification

From the repository root, using the installed environment:

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m unittest tests.test_mcp_memory tests.test_mcp_provider tests.test_mcp_transport -v
/tmp/steward-mcp-phase1-venv/bin/python -B -m unittest tests.test_mcp_memory.TestMCPArchitecture -v
/tmp/steward-mcp-phase1-venv/bin/python -B -m unittest discover -s tests -v
node --test tests/frontend.test.mjs
git diff --check
```

HTTP tests launch temporary localhost servers and require permission to bind sockets.
Tests use isolated temporary SQLite stores; the canonical fixture is checked unchanged.
The transport test exercises discovery and representative calls to every tool. Set
`STEWARD_MCP_TEST_REPORT` to a writable JSON path when running it to capture the actual
discovered catalog and representative structured results.

Architecture tests scan imports/calls and verify in a fresh process that neither
`steward` nor `rails` is loaded. Coverage includes revisions, concurrent writes,
rollback when receipt persistence fails, restart-safe replay, conflicting retries,
separate evidence roles, quote scopes, missing commitments, stable status polling,
ambiguous booking errors, authentication and Host/Origin protection.

Known limits: one seeded machine, one simulated provider, one household/integration
identity, no live external actions, no cancellation/rescheduling tool, no autonomous
status progression, no distributed database, and no server-side verification of the
truth of caller-supplied evidence. A local confirmed booking asserts simulation facts
only. Additional machines/providers and real vendor adapters require later work.
