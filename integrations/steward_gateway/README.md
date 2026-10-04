# Steward Round-3 gateway

Fourth independent service for the AgenticOrg connector authorization workaround.
Connect one MCP connector to `https://<gateway-host>/mcp` using the separate
`STEWARD_GATEWAY_MCP_AUTH_TOKEN`. Pine AgenticOrg remains the sole brain.
The gateway performs discovery and capability forwarding only; it does not evaluate
spending authority, approval, case states, recovery, verification or closure.

The three existing ASGI applications are imported unchanged. Their MCP catalogs
(including descriptions, input/output schemas and annotations) are discovered at
startup. Calls are forwarded over in-process ASGI transports, retaining each child's
bearer authentication, validation, adapter, persistence and complete MCP result.
There are no remote MCP dependencies, retries or fallback decisions. The child
HTTP routes are private to the process; only `/mcp` and `/healthz` are exposed.
Host/origin protection and the voice rail's audio request-size limit are retained.
Startup fails if the imported catalogs do not contain exactly the expected ten tools.

## Exact catalog

- `get_machine_memory`
- `update_machine_memory`
- `request_service_quote`
- `request_service_appointment`
- `get_service_status`
- `transcribe_voice_input`
- `synthesize_voice_reply`
- `check_delivery_serviceability`
- `create_part_shipment`
- `track_part_shipment`

## Configuration and Render

The appended `steward-round3-gateway` definition uses the free plan, no disk,
and automatic deployments disabled. Existing Render entries are unchanged.
Configure these secrets on the **fourth service**, without editing the old services:

| Variable | Purpose |
| --- | --- |
| `STEWARD_GATEWAY_MCP_AUTH_TOKEN` | Required gateway bearer secret; at least 32 printable ASCII characters; distinct from all child MCP tokens |
| `MCP_AUTH_TOKEN` | Imported Steward MCP bearer secret |
| `GNANI_MCP_AUTH_TOKEN` | Imported voice MCP bearer secret |
| `DELHIVERY_MCP_AUTH_TOKEN` | Imported logistics MCP bearer secret |
| `DELHIVERY_MOCK_TOKEN` | Private mock HTTP authentication; must differ from Delhivery MCP token |
| `GNANI_API_KEY` | Required for real speech conversion, not discovery or health |

Use at least 32 printable ASCII characters for all bearer/mock tokens. These may
be new child credentials scoped to this gateway deployment; they need not reuse
secrets from the existing services. Credentials remain environment-only.

The Blueprint supplies `STEWARD_GATEWAY_HOST=0.0.0.0`, Python 3.13.7,
`MCP_DATABASE_PATH=/tmp/steward_gateway_memory.sqlite3`, `MCP_SCENARIO=normal`,
`GNANI_EVIDENCE_PATH=/tmp/steward_gateway_voice.jsonl`,
`DELHIVERY_DATABASE_PATH=/tmp/steward_gateway_shipments.sqlite3`,
`DELHIVERY_SCENARIO=NORMAL_SERVICEABLE`, and
`DELHIVERY_WAREHOUSE_NAME=Steward Mock Warehouse`.
Render supplies `PORT` and `RENDER_EXTERNAL_HOSTNAME`. Local defaults are
`127.0.0.1:8004`; optional overrides are `STEWARD_GATEWAY_PORT` and
`STEWARD_GATEWAY_PUBLIC_HOST` (hostname only).
Existing integration environment names and aliases still work unchanged.

This deployment has its **own** memory, shipments and voice journal. It does not
read the existing deployments' data. `/tmp` data is ephemeral across restarts;
this minimal gateway does not promise durable production memory or automatic
migration. Steward service and Delhivery operations remain simulated. Real Gnani
conversion is possible only on an explicit tool invocation with credentials and
may incur charges; startup/discovery/health never call the voice upstream.

## Local run

From the repository root, install:

```sh
python -m pip install -r integrations/steward_gateway/requirements.txt
```

Provide the secrets above in your environment and use isolated writable paths:

```sh
MCP_DATABASE_PATH=/tmp/steward_gateway_memory.sqlite3 \
DELHIVERY_DATABASE_PATH=/tmp/steward_gateway_shipments.sqlite3 \
GNANI_EVIDENCE_PATH=/tmp/steward_gateway_voice.jsonl \
python -B -m integrations.steward_gateway.server
```

`GET /healthz` is public and returns `{"status":"ok","tool_count":10}`.
All MCP HTTP methods require the gateway bearer token, including `/mcp/`.

## Verification

```sh
python -B -m unittest tests.test_steward_gateway -v
python -B -m unittest discover -s tests -q
git diff --check
```

Gateway tests compare entire discovered tool definitions and exact forwarded
result envelopes, invoke all ten tools using real imported adapters with mocked
Gnani HTTP, check structured errors, authentication, host/origin protection,
secret validation, and the gateway's transport-only source boundary. Existing
integration suites remain unchanged. No deployment, commit or push is performed.
