"""Official SDK Streamable HTTP server: five factual tools, default port 8001."""
from __future__ import annotations

import argparse
from contextlib import asynccontextmanager
from dataclasses import replace
import hmac
import json
import logging
from pathlib import Path
import sqlite3

import anyio
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import TypeAdapter, ValidationError
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import uvicorn

from .config import Config, SCENARIOS
from .memory import MachineMemory
from .provider import SimulatedProvider
from .schemas import (
    AppointmentInput, AppointmentResult, ErrorInfo, Failure, GetMemoryInput, MemoryResult,
    Provenance, QuoteInput, QuoteResult, StatusInput, StatusResult, ToolFailure,
    UpdateMemoryInput, UpdateMemoryResult, now_iso,
)
from .storage import Storage

LOG = logging.getLogger(__name__)
CATALOG = {
    "get_machine_memory": (GetMemoryInput, MemoryResult,
        "Retrieves stored machine facts, history, household preferences and revision with provenance. "
        "Preferences are facts for Pine to interpret; retrieval makes no repair, authority or case decision."),
    "update_machine_memory": (UpdateMemoryInput, UpdateMemoryResult,
        "Persists explicitly supplied factual records with evidence, revision checks and idempotency. "
        "Provider claims and household observations remain separate. A persistence receipt establishes no "
        "physical verification, service resolution or case closure."),
    "request_service_quote": (QuoteInput, QuoteResult,
        "Requests a quotation from the simulated appliance-service provider. Returns price, charge scope, "
        "missing information and provider provenance. A quotation is provider evidence only and does not "
        "constitute household approval or authorization to book. A visiting charge is not a full repair price."),
    "request_service_appointment": (AppointmentInput, AppointmentResult,
        "Executes a simulated booking request that Pine has already decided is permitted. Checks quote "
        "associations and expiry, and reports provider confirmation or missing terms. Does not evaluate "
        "household spending authority or infer confirmation from an attempted request."),
    "get_service_status": (StatusInput, StatusResult,
        "Reads persisted provider facts for a typed quote or appointment reference. Polling does not advance "
        "the scenario. Provider-reported completion is a provider claim only; it establishes no household "
        "verification, physical resolution or case closure."),
}


class Application:
    def __init__(self, config: Config):
        self.config = config
        self.storage = Storage(config.database)
        self.memory = MachineMemory(self.storage)
        self.provider = SimulatedProvider(self.storage, config.scenario)

    def invoke(self, name: str, arguments: dict):
        if name not in CATALOG:
            raise ToolFailure("NOT_FOUND", "Tool not found")
        input_model, _, _ = CATALOG[name]
        # JSON validation preserves strict booleans/integers while using public ISO strings.
        request = input_model.model_validate_json(json.dumps(arguments, allow_nan=False))
        operations = {
            "get_machine_memory": lambda: self.memory.get(request.machine_id),
            "update_machine_memory": lambda: self.memory.update(request),
            "request_service_quote": lambda: self.provider.quote(request),
            "request_service_appointment": lambda: self.provider.appointment(request),
            "get_service_status": lambda: self.provider.status(request),
        }
        return operations[name]()


class BearerAuthentication:
    def __init__(self, app, token: str | None):
        self.app, self.token = app, token

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/mcp" and self.token:
            headers = dict(scope["headers"])
            supplied = headers.get(b"authorization", b"")
            expected = ("Bearer " + self.token).encode()
            if not hmac.compare_digest(supplied, expected):
                response = JSONResponse({"error": "Authentication required"}, status_code=401,
                                        headers={"WWW-Authenticate": "Bearer"})
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def create_app(config: Config | None = None) -> Starlette:
    config = config or Config.from_env()
    application = Application(config)
    server = Server("steward-external-tools", version="1.0.0",
                    instructions="Pine owns Steward reasoning and orchestration. These tools expose facts and provider actions only.")

    @server.list_tools()
    async def list_tools():
        catalog = []
        for name, (input_model, output_model, description) in CATALOG.items():
            output_schema = TypeAdapter(output_model | Failure).json_schema()
            output_schema["type"] = "object"
            catalog.append(types.Tool(name=name, description=description,
                inputSchema=input_model.model_json_schema(), outputSchema=output_schema,
                annotations=types.ToolAnnotations(readOnlyHint=name in ("get_machine_memory", "get_service_status"),
                    destructiveHint=False, idempotentHint=True, openWorldHint=False)))
        return catalog

    @server.call_tool(validate_input=False)
    async def call_tool(name, arguments):
        try:
            result = await anyio.to_thread.run_sync(application.invoke, name, arguments)
            data = result.model_dump(mode="json")
            return data  # The SDK checks outputSchema and supplies structuredContent.
        except (ValidationError, ValueError, TypeError):
            error = ToolFailure("INVALID_ARGUMENT", "Arguments do not match the strict public tool schema")
        except ToolFailure as exc:
            error = exc
        except (sqlite3.Error, OSError):
            LOG.exception("Integration persistence failed")
            error = ToolFailure("OUTCOME_UNKNOWN", "Persistence outcome unavailable; retry the identical idempotent request")
        except Exception:
            LOG.exception("Integration operation failed")
            error = ToolFailure("OUTCOME_UNKNOWN", "Operation outcome unavailable; no external success is asserted")
        data = Failure(error=ErrorInfo(code=error.code, message=error.message),
            provenance=Provenance(source="mcp_runtime", reference="tool:" + name[:100],
                                  observed_at=now_iso(), is_simulated=True),
            provider_booking_status=("UNKNOWN" if error.code in ("OUTCOME_UNKNOWN", "PROVIDER_UNAVAILABLE")
                                     else "REJECTED" if error.code in ("SLOT_UNAVAILABLE", "QUOTE_EXPIRED") else None)
                if name == "request_service_appointment" else None).model_dump(mode="json")
        return types.CallToolResult(isError=True, structuredContent=data,
                                    content=[types.TextContent(type="text", text=json.dumps(data))])

    hosts = ["127.0.0.1:*", "localhost:*", "[::1]:*"]
    origins = ["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"]
    if config.public_host:
        hosts.extend([config.public_host, config.public_host + ":443"])
        origins.append("https://" + config.public_host)
    manager = StreamableHTTPSessionManager(server, json_response=True, stateless=True,
        max_request_body_size=65536,
        security_settings=TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=origins))

    @asynccontextmanager
    async def lifespan(app):
        async with manager.run():
            yield

    class MCPHTTP:
        async def __call__(self, scope, receive, send):
            await manager.handle_request(scope, receive, send)

    async def health(request):
        return JSONResponse({"status": "ok", "provider_mode": "simulated", "tool_count": len(CATALOG)})

    app = Starlette(routes=[Route("/mcp", MCPHTTP(), methods=["GET", "POST", "DELETE"]),
                            Route("/healthz", health, methods=["GET"])], lifespan=lifespan)
    app.add_middleware(BearerAuthentication, token=config.bearer_token)
    app.state.integration = application
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--database", type=Path)
    parser.add_argument("--scenario", choices=SCENARIOS)
    parser.add_argument("--public-host")
    args = parser.parse_args()
    settings = {key: value for key, value in vars(args).items() if value is not None}
    config = replace(Config.from_env(), **settings)
    uvicorn.run(create_app(config), host=config.host, port=config.port, access_log=False)


if __name__ == "__main__":
    main()
