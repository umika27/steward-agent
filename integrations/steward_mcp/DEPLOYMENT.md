# Independent MCP deployment — prepared, not deployed

Pine/AgenticOrg reasons and orchestrates. This service exposes the existing five factual
memory/provider tools only. Provider calls are still deterministic simulations. Plural
payments remain native to Pine; no Gnani or Delhivery credentials/tools are configured.
The Vite frontend, Python demo API, and legacy Node fixture runtime are not started by
this deployment. Clone/build from the repository root because canonical seed data lives
in `data/machines/WM-001.json`; that file is read, never modified.

## Local command

From repository root, using the existing test environment:

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m integrations.steward_mcp.server --host 127.0.0.1 --port 8001 --database /tmp/steward-mcp-phase1-runtime/runtime.sqlite3 --scenario normal
```

For a fresh environment, create a Python 3.13.7 virtualenv and install
`integrations/steward_mcp/requirements.txt`. Direct dependencies are pinned; transitive
versions are not fully locked. `/mcp` uses Streamable HTTP; `/healthz` is unauthenticated
liveness reporting only. It is not a storage-readiness or external-provider health probe.

## Render configuration

The root `render.yaml` describes one native Python web service, no frontend deployment.
Render terminates public TLS. Use one instance/one Python process with the disk below.
The chosen paid plan supports a persistent disk; review cost before creating the service.
Automatic deploys are disabled; applying the Blueprint still creates/deploys the service.

| Setting | Exact value |
| --- | --- |
| Root directory | repository root (leave blank) |
| Python | `3.13.7` through `PYTHON_VERSION` |
| Plan | `0.5c-512mb` (paid) |
| Build | `python -m pip install -r integrations/steward_mcp/requirements.txt` |
| Start | `python -B -m integrations.steward_mcp.server` |
| Health | `/healthz` |
| MCP | `/mcp` (no trailing slash) |
| Disk | 1 GB mounted at `/var/data/steward_mcp` |
| `MCP_DATABASE_PATH` | `/var/data/steward_mcp/runtime.sqlite3` |
| `MCP_HOST` | `0.0.0.0` |
| `MCP_SCENARIO` | `normal` |
| `MCP_AUTH_TOKEN` | secret random token, at least 32 characters; enter in Render, never commit |
| `PORT` | Render supplies it; do not override it with a localhost port |
| `RENDER_EXTERNAL_HOSTNAME` | Render supplies it; automatically used for the public Host/Origin allowlist |
| `MCP_PUBLIC_HOST` | optional explicit hostname only, for a custom domain |

New environment names override corresponding `STEWARD_MCP_*` legacy names. `PORT`
overrides `STEWARD_MCP_PORT`; explicit CLI flags override environment values.
Public hostname precedence: `MCP_PUBLIC_HOST`, `STEWARD_MCP_PUBLIC_HOST`, then
`RENDER_EXTERNAL_HOSTNAME`. Local defaults remain 127.0.0.1:8001 without authentication.
Public binding without a valid token fails startup. Public Host/Origin validation remains
restrictive; no wildcard allowlist is introduced. Health remains accessible to Render.

SQLite, idempotency receipts, machine revisions and provider records survive process
restarts on the disk. Render disks restrict scaling and disable zero-downtime deploys.
Do not change scenario during an evidence run: existing records retain their creation
scenario, while new records use the configured scenario. Do not delete the disk to reset
an evaluation; use a separate service/database for independent runs.

## Manual deployment and AgenticOrg registration

1. Review the integration report and source diff. Commit the intended source files together
   (exclude tracked cache changes). Push only when you choose to do so; neither was done here.
2. In Render, create a Blueprint from that repository/branch using `render.yaml`, or create
   a native Python Web Service with the exact settings above. Review the paid resources.
3. Generate a secret locally, for example `openssl rand -hex 32`, and enter it as
   `MCP_AUTH_TOKEN` in Render. Do not paste it into source, screenshots, logs or an issue.
4. Deploy manually. Confirm the mounted disk and the detected platform port in logs.
5. Open `https://<assigned-host>/healthz`; expect
   `{"status":"ok","provider_mode":"simulated","tool_count":5}`.
6. Run an authenticated MCP client against `https://<assigned-host>/mcp`; initialize,
   discover exactly five tools, invoke each, and check idempotent replay and restart persistence.
   A GET/curl opening `/mcp` alone is not a tool-discovery test.
7. In AgenticOrg create a connector named **Steward Phase 1 External Tools**:
   URL `https://<assigned-host>/mcp`, transport **Streamable HTTP** if requested,
   Auth Type **custom** only if it accepts arbitrary request headers.
   Supply header **Authorization**, value **Bearer <the same MCP_AUTH_TOKEN>**.
   Store the secret in AgenticOrg's credential field, not an agent prompt.
   An `api_key` option is suitable only if it lets you configure that exact header/value;
   do not send `X-API-Key` or a bare token. Do not select `none` for the public service.
8. If the form cannot send `Authorization: Bearer ...`, stop registration and inspect its
   supported authentication format. Local tests prove this header works, not that
   AgenticOrg's form can supply it. No OAuth metadata/token endpoint is implemented.
9. Discover/attach `get_machine_memory`, `update_machine_memory`,
   `request_service_quote`, `request_service_appointment`, `get_service_status` to Steward.
   Prove Pine invokes them and preserves provider claims separately from household outcomes.
10. Record actual remote discovery/invocation and persistence evidence. Public HTTPS,
    Render deployment, and AgenticOrg compatibility remain unverified until these steps run.

Useful official references: [port binding](https://render.com/docs/web-services#port-binding),
[Blueprint fields](https://render.com/docs/blueprint-spec),
[persistent disks](https://render.com/docs/disks),
[Python version](https://render.com/docs/python-version),
[platform environment](https://render.com/docs/environment-variables).

Remaining Round 3 work: Pine registration/tool attachment and invocation proof; a real
Pine-to-frontend event source; Gnani; Delhivery; native Plural payment test; evaluation
suite and recordings/evidence. Browser-native speech recognition already exists in the
approved frontend, requires user microphone permission, and is separate from Gnani.
