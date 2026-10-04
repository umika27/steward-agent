"""Forward unchanged MCP contracts from imported applications through one connector."""
from contextlib import AsyncExitStack, asynccontextmanager

import httpx
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import uvicorn

from integrations.steward_mcp import server as steward
from integrations.gnani_voice import server as gnani
from integrations.delhivery_mock import server as delhivery
from integrations.delhivery_mock.adapter import CATALOG as DELIVERY_CATALOG
from .config import Config

TOOL_GROUPS = (tuple(steward.CATALOG), tuple(gnani.CATALOG), tuple(DELIVERY_CATALOG))
TOOL_NAMES = frozenset(name for group in TOOL_GROUPS for name in group)


def imported_applications():
    """No network forwarding; each imported application keeps its authentication."""
    sc, gc, dc = steward.Config.from_env(), gnani.Config.from_env(), delhivery.Config.from_env()
    return ((steward.create_app(sc), sc.bearer_token),
            (gnani.create_app(gc), gc.token),
            (delhivery.create_app(dc), dc.mcp_token))


def create_app(config=None, applications=None):
    config = config or Config.from_env()
    applications = applications if applications is not None else imported_applications()
    if len(applications) != len(TOOL_GROUPS):
        raise ValueError('Exactly three imported applications are required')
    # Separate gateway credentials must never grant direct access to a child rail.
    if any(token == config.token for _, token in applications):
        raise ValueError('Gateway bearer token must differ from integration MCP tokens')
    server = Server('steward-round3-gateway', version='1.0.0',
                    instructions='Capabilities only. Pine AgenticOrg alone reasons and orchestrates Steward.')
    clients = []
    catalog = []
    routes = {name: index for index, group in enumerate(TOOL_GROUPS) for name in group}

    async def forward(index, method, params=None):
        response = await clients[index].post('/mcp', json={
            'jsonrpc': '2.0', 'id': 1, 'method': method, **({'params': params} if params is not None else {})})
        response.raise_for_status()
        envelope = response.json()
        if 'error' in envelope:
            raise RuntimeError('Imported MCP application rejected forwarding')
        return envelope['result']

    @server.list_tools()
    async def list_tools():
        return catalog

    @server.call_tool(validate_input=False)
    async def call_tool(name, arguments):
        if name not in routes:
            return types.CallToolResult(isError=True,
                content=[types.TextContent(type='text', text='Tool not found')])
        result = await forward(routes[name], 'tools/call', {'name': name, 'arguments': arguments})
        return types.CallToolResult.model_validate(result)

    hosts = ['127.0.0.1:*', 'localhost:*', '[::1]:*']
    origins = ['http://127.0.0.1:*', 'http://localhost:*', 'http://[::1]:*']
    if config.public_host:
        hosts.extend([config.public_host, config.public_host + ':443'])
        origins.append('https://' + config.public_host)
    manager = StreamableHTTPSessionManager(server, json_response=True, stateless=True,
        max_request_body_size=gnani.MAX_BASE64_LENGTH + 16384,
        security_settings=TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=origins))

    @asynccontextmanager
    async def lifespan(app):
        async with AsyncExitStack() as stack:
            for child, token in applications:
                await stack.enter_async_context(child.router.lifespan_context(child))
                headers = {'Accept': 'application/json, text/event-stream',
                           'MCP-Protocol-Version': '2025-06-18'}
                if token:
                    headers['Authorization'] = 'Bearer ' + token
                client = await stack.enter_async_context(httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=child), base_url='http://127.0.0.1:8004',
                    headers=headers, trust_env=False, timeout=60))
                clients.append(client)
            try:
                for index, group in enumerate(TOOL_GROUPS):
                    tools = (await forward(index, 'tools/list'))['tools']
                    if {tool['name'] for tool in tools} != set(group) or len(tools) != len(group):
                        raise ValueError('Imported catalog differs from expected gateway tools')
                    catalog.extend(types.Tool.model_validate(tool) for tool in tools)
                if len(catalog) != 10 or len(TOOL_NAMES) != 10:
                    raise ValueError('Gateway requires exactly ten distinct tools')
                async with manager.run():
                    yield
            finally:
                catalog.clear()
                clients.clear()

    class MCPHTTP:
        async def __call__(self, scope, receive, send):
            await manager.handle_request(scope, receive, send)

    async def health(request):
        return JSONResponse({'status': 'ok', 'tool_count': len(catalog)})

    app = Starlette(routes=[Route('/mcp', MCPHTTP(), methods=['GET', 'POST', 'DELETE']),
                            Route('/healthz', health)], lifespan=lifespan)
    app.add_middleware(gnani.BearerAuthentication, token=config.token)
    return app


def main():
    config = Config.from_env()
    uvicorn.run(create_app(config), host=config.host, port=config.port, access_log=False)


if __name__ == '__main__':
    main()
