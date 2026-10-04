"""One deployment: independent mock HTTP routes and a three-tool MCP bridge."""
from contextlib import asynccontextmanager
import hmac
import json

from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import uvicorn

from .adapter import Adapter, CATALOG
from .config import Config
from .http import MockHTTP, PROVENANCE
from .storage import Storage

class ProtectMCP:
    def __init__(self, app, token): self.app, self.token = app, token
    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope['path'].rstrip('/') == '/mcp':
            supplied = dict(scope['headers']).get(b'authorization', b'')
            if not hmac.compare_digest(supplied, ('Bearer '+self.token).encode()):
                await JSONResponse({'error': 'UNAUTHORIZED'}, status_code=401,
                    headers={'WWW-Authenticate': 'Bearer'})(scope, receive, send)
                return
        await self.app(scope, receive, send)

def create_app(config=None):
    config = config or Config.from_env()
    storage = Storage(config.database)
    mock = MockHTTP(config, storage)
    http_app = Starlette(routes=mock.routes())
    adapter = Adapter(http_app, config, storage)
    server = Server('delhivery-mock-rail', version='1.0.0',
        instructions='Simulated physical-part logistics only. Pine alone reasons and orchestrates Steward.')

    @server.list_tools()
    async def list_tools():
        return [types.Tool(name=name, description=entry[3], inputSchema=entry[0].model_json_schema(),
            annotations=types.ToolAnnotations(readOnlyHint=name != 'create_part_shipment',
                destructiveHint=False, idempotentHint=True, openWorldHint=False)) for name, entry in CATALOG.items()]

    @server.call_tool(validate_input=False)
    async def call_tool(name, arguments):
        result = await adapter.invoke(name, arguments)
        return types.CallToolResult(isError=not result['success'], structuredContent=result,
            content=[types.TextContent(type='text', text=json.dumps(result, ensure_ascii=False))])

    hosts = ['127.0.0.1:*', 'localhost:*', '[::1]:*']
    origins = ['http://127.0.0.1:*', 'http://localhost:*', 'http://[::1]:*']
    if config.public_host:
        hosts.extend([config.public_host, config.public_host+':443']); origins.append('https://'+config.public_host)
    manager = StreamableHTTPSessionManager(server, json_response=True, stateless=True,
        max_request_body_size=131072,
        security_settings=TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=origins))

    @asynccontextmanager
    async def lifespan(app):
        async with manager.run(): yield

    class MCPHTTP:
        async def __call__(self, scope, receive, send): await manager.handle_request(scope, receive, send)

    async def health(request):
        return JSONResponse({'status': 'ok', 'provider': 'DELHIVERY_MOCK',
                             'execution_environment': 'MOCK', 'tool_count': 3})

    app = Starlette(routes=[*mock.routes(), Route('/mcp', MCPHTTP(), methods=['GET', 'POST', 'DELETE']),
                            Route('/healthz', health)], lifespan=lifespan)
    app.add_middleware(ProtectMCP, token=config.mcp_token)
    app.state.storage, app.state.adapter = storage, adapter
    return app

def main():
    config = Config.from_env()
    uvicorn.run(create_app(config), host=config.host, port=config.port, access_log=False)

if __name__ == '__main__': main()
