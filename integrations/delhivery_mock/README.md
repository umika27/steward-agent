# Delhivery mock logistics rail

This independent service supplies physical repair-part logistics facts to Pine
AgenticOrg. Pine remains the only reasoning/orchestration layer. Delivery never
changes a Steward case, establishes a repair outcome, authorizes spending or
executes payments. The existing five Steward MCP tools and two Gnani tools are
unchanged. There are no live Delhivery requests and no dependency on its public
developer-assistance MCP.

One process contains two layers: a stateless Streamable HTTP MCP adapter and a
mock HTTP server. The adapter uses `httpx.ASGITransport` to make HTTP requests to
the mock's exact routes in process. There is no configurable external provider
URL or network fallback. Public mock requests use those same handlers and the
same isolated SQLite database.

## Contract scope and honest response labeling

The source of truth is the ordinary B2C documentation supplied in the execution
task. Its request paths, field names, authentication and specified serviceability
semantics are preserved. It supplies no authoritative complete response schema.
This is a contract-aligned request mock, **not** a claim of full Delhivery response
compatibility. Heavy Product, MPS, RVP, NDR, labels, costs, warehouses, cancellation
and e-waybill APIs are absent.

| Method | Exact mock path | Request |
| --- | --- | --- |
| GET | `/c/api/pin-codes/json/` | `filter_codes=<one six-digit pincode>` |
| POST | `/api/cmu/create.json` | URL-encoded `format=json&data=<manifest JSON>` |
| GET | `/api/v1/packages/json/` | One `waybill`, optional `ref_ids` |

All three require `Authorization: Token <DELHIVERY_MOCK_TOKEN>`. Manifestation
accepts `application/x-www-form-urlencoded`; use `Accept: application/json`.
Tracking accepts the documented `Content-Type: application/json` header.
Unsupported raw JSON manifestation receives an explicitly simulated 415 error.

Serviceability returns `[]` for NSZ, `[{'remark':'Embargo'}]` for embargo, and
`[{'remark':''}]` for serviceable, expressed as actual JSON with double quotes.
The empty-list/remark meanings are documented. The minimal record/list shape is
a fixture, labeled by `X-Execution-Environment: MOCK` and
`X-Response-Schema: SIMULATION` headers. Other responses separate invented
logistics facts from provenance:

```json
{
  "simulation": {
    "provider": "DELHIVERY_MOCK",
    "provider_rail": "DELHIVERY",
    "execution_environment": "MOCK",
    "contract_basis": "OFFICIAL DELHIVERY B2C DOCUMENTATION",
    "response_schema": "SIMULATION — authoritative provider response schemas not supplied"
  },
  "logistics": {
    "order_id": "MOCK-PUMP-001",
    "waybill": "<deterministic synthetic 13-digit number>",
    "status": "SHIPMENT_CREATED"
  }
}
```

`logistics`, its members/statuses, error codes and failure HTTP statuses are all
simulation conventions, not assertions about an undocumented provider response.
The MCP serviceability result additionally exposes `delhivery_compatible_data`
and a separately derived simulated `logistics.serviceable` boolean.

Manifest JSON has exactly one item in `shipments` and a top-level
`pickup_location: {"name":"Steward Mock Warehouse"}`. Required shipment fields
are `name`, `order`, `phone`, `add`, integer `pin`, and `payment_mode`. Documented
optional field names are preserved, including both `return_address` and
`return_add`. Their values remain JSON because supplied documentation does not
provide authoritative optional field types; this is not full provider validation.
Unknown fields, blank required values, invalid pincodes and malformed waybills
are rejected. Supplied SPS waybills may be omitted or must be 13 ASCII digits.

The documented modes `Pickup`, `COD`, `Prepaid`, `REPL` are recognized. This MVP
enables only ordinary **Prepaid forward SPS**. Other journeys return
`UNSUPPORTED_SHIPMENT_JOURNEY`. A drain pump is a replacement *part*, not a REPL
exchange journey. Warehouse name must match configured name exactly, including
case and spaces. Serviceability uses the same scenario fixture before creating
a shipment; Embargo/NSZ never persist a successful manifestation.

## Pine-facing MCP contract

Only these tools appear at `/mcp`:

| Tool | Required arguments | Optional arguments |
| --- | --- | --- |
| `check_delivery_serviceability` | `filter_codes` string | `simulation_scenario` |
| `create_part_shipment` | `shipment`, `pickup_location` | `simulation_scenario` |
| `track_part_shipment` | `waybill` string | `ref_ids`, `simulation_scenario` |

Input schemas are strict and discovery exposes their definitions. Results are
JSON in MCP structured content and text, with `success`, labeled `simulation`,
logistics facts or an error, and safe evidence. A transport/validation failure
sets MCP `isError=true`; a successfully retrieved NSZ/Embargo fact has
`success=true` and `serviceable=false`. No retries occur automatically.

`simulation_scenario` is an explicit mock evaluation control, **not** a provider
field. The adapter sends it as `X-Mock-Scenario`, outside the Delhivery payload.
Direct mock callers can use the same header. Without an override,
`DELHIVERY_SCENARIO` controls the service; default is `NORMAL_SERVICEABLE`.

| Scenario | Deterministic behavior |
| --- | --- |
| `NORMAL_SERVICEABLE` | Blank remark; ordinary creation; tracking reads stored status |
| `EMBARGO` | Remark `Embargo`; creation rejected |
| `NSZ` | Empty serviceability list; creation rejected |
| `SHIPMENT_CREATED` | Valid SPS accepted; tracking reads stored facts |
| `NO_RIDER_OR_CAPACITY` | Creation returns simulated 503, no shipment inserted |
| `TIMEOUT` | Simulated bounded 504/TIMEOUT; no sleep or mutation |
| `MALFORMED_RESPONSE` | Intentionally invalid JSON; adapter reports failure |
| `IN_TRANSIT` | Known shipment receives simulated transit scan |
| `DELIVERED` | Known part receives delivered logistics scan only |
| `DELIVERY_EXCEPTION` | Known shipment receives exception scan only |

Tracking-specific scenarios only affect tracking; failure scenarios apply to all
three operations. Unknown waybills fail even under DELIVERED. Polling without a
scenario change never advances a shipment. Explicit evaluation controls may
replace a stored logistics status; this is not a real carrier event feed.
TIMEOUT is a controlled simulated upstream outcome, not a real socket delay.

## Persistence and evidence

An independent SQLite database stores unique order ID, stable synthetic waybill,
original normalized manifest, created timestamp, current logistics scenario and
deduplicated scan history. `BEGIN IMMEDIATE`, unique constraints and a transaction
make concurrent identical creation safe. The same order/normalized payload
returns the existing shipment and original timestamp; changed input or reused
waybill returns simulated 409. Waybills derive deterministically from order-ID
SHA-256; rare numeric collisions are rejected, never silently reassigned.
An idempotent replay reports the *current* logistics status, not a reset status.

The database is mode 0600 and outside Steward's canonical data/runtime. It also
persists evidence for each mock operation and MCP call. Evidence contains UTC
timestamp, operation, documented path/method, safe request metadata, scenario,
result, success/failure, latency, order-ID SHA-256 and waybill where applicable.
Names, phones, addresses, raw order IDs, payloads and credentials are not logged.
Order ID hashes permit correlation without disclosing caller-supplied IDs.
Submitted credential reflection is rejected. Do not use real PII in competition
fixtures: full authorized shipment inputs are stored in the private database.
Database availability is required; disk failure must not be mistaken for success.
Health is public and reveals no credentials. Server access logging is disabled.

## Local run

Use the existing Python environment or install the pinned requirements in an
isolated environment. Configure **two different**, at least 32-character printable
ASCII secrets in the shell; do not commit them:

```sh
python -m pip install -r integrations/delhivery_mock/requirements.txt
python -B -m integrations.delhivery_mock.server
```

Set `DELHIVERY_MOCK_TOKEN` and `DELHIVERY_MCP_AUTH_TOKEN` before starting. Default
binding is `127.0.0.1:8003`, database `tmp/delhivery_mock/shipments.sqlite3`.
`DELHIVERY_PORT` selects the local port; Render's `PORT` takes precedence.
`DELHIVERY_DATABASE_PATH` changes only this rail's database.

Offline replay, with no external requests or required live credentials:

```sh
python -B -m integrations.delhivery_mock.smoke --output /tmp/delhivery-new-smoke.json
python -B -m unittest tests.test_delhivery_mock tests.test_delhivery_transport tests.test_delhivery_smoke -v
```

The smoke command refuses to overwrite an existing evidence file. It creates an
ephemeral private database and tokens, exercises 18 deterministic adapter-to-HTTP
requests, asserts actual successes and expected failures, writes the real call
receipts and returns nonzero if expectations fail. It claims only mock execution.
The transport tests separately use an actual localhost server and official MCP
client to verify remote discovery, authentication and invocation.

## Render setup and AgenticOrg registration

`render.yaml` adds only `delhivery-mock-rail`; existing service definitions remain
unchanged. No deployment has been performed. Review the Blueprint before applying
because it creates billable resources. Manual web-service settings are:

| Setting | Exact value |
| --- | --- |
| Runtime | Python 3.13.7 |
| Build | `python -m pip install -r integrations/delhivery_mock/requirements.txt` |
| Start | `python -B -m integrations.delhivery_mock.server` |
| Health path | `/healthz` |
| Host | `DELHIVERY_HOST=0.0.0.0` |
| Database | `DELHIVERY_DATABASE_PATH=/var/data/delhivery_mock/shipments.sqlite3` |
| Disk | 1 GB at `/var/data/delhivery_mock` |
| Default scenario | `DELHIVERY_SCENARIO=NORMAL_SERVICEABLE` |
| Warehouse | `DELHIVERY_WAREHOUSE_NAME=Steward Mock Warehouse` |
| Automatic deploys | Off |

Required Render secrets are **only** `DELHIVERY_MOCK_TOKEN` and
`DELHIVERY_MCP_AUTH_TOKEN`, distinct values. No real Delhivery token or Gnani
credential is required. Public Host/Origin allowlists use Render's
`RENDER_EXTERNAL_HOSTNAME` automatically; elsewhere set `DELHIVERY_PUBLIC_HOST`
to the exact hostname, without scheme/port/wildcards. Use one persistent instance;
SQLite here is not a multi-replica database.

Register an independent AgenticOrg remote MCP connector:

| Field | Value |
| --- | --- |
| Display name | `Delhivery Mock Logistics Rail` |
| Transport | Streamable HTTP |
| URL | `https://<actual-render-assigned-hostname>/mcp` |
| Authentication header | `Authorization: Bearer <DELHIVERY_MCP_AUTH_TOKEN>` |
| Discovered tools | The three tools above, no Steward or Gnani tools |

The hostname is a registration template until Render creates the service. This
server uses static bearer authentication, not an OAuth authorization server.
AgenticOrg must support Streamable HTTP and attaching the configured header;
actual registration and external connectivity remain to be verified after
deployment. Keep mock HTTP token out of Pine configuration: the server supplies
it internally. Do not register Delhivery's public developer-assistance MCP as the
runtime logistics connector.

## Replacement-part flow and failures

Pine first obtains the provider's drain-pump requirement, checks serviceability,
then submits the synthetic example below. Pine alone decides and maintains the
appropriate AWAITING_PART case state. Tracking IN_TRANSIT or DELIVERED supplies
facts only. After delivery, Pine must still arrange technician installation and
obtain household verification before independently resolving/closing anything.
Payments continue through Pine's native Plural connector.

```json
{
  "shipment": {
    "name": "Synthetic Household", "order": "MOCK-PUMP-001",
    "phone": "0000000000", "add": "1 Fictional Test Lane", "pin": 560001,
    "payment_mode": "Prepaid", "products_desc": "Washing machine drain pump",
    "shipping_mode": "Surface"
  },
  "pickup_location": {"name": "Steward Mock Warehouse"}
}
```

For Embargo/NSZ, serviceability returns non-serviceable facts and creation returns
`PINCODE_NOT_SERVICEABLE` without a shipment. Pine chooses the next action. For
TIMEOUT or MALFORMED_RESPONSE, MCP returns an explicit error and never fabricates
a waybill or delivery success. There is no autonomous fallback or retry loop.
An existing AWAITING_PART case remains untouched after DELIVERED, enforced by
architecture and isolated-case regression tests.
