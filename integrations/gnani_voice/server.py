"""Independent GNANI Voice Rail MCP: two paid conversion tools, never Steward reasoning."""
from contextlib import asynccontextmanager
import hmac
import json
import os

import anyio
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import uvicorn

from .adapter import GnaniVoice
from .config import Config
from .evidence import EvidenceWriter
from .schemas import MAX_BASE64_LENGTH, TranscribeInput, SynthesizeInput

CATALOG = {
    'transcribe_voice_input': (TranscribeInput, 'STT',
        'GNANI voice rail only: converts a supplied short audio clip to its actual transcript. '
        'No guessed speech or case decisions. May incur provider charges; no automatic retries.'),
    'synthesize_voice_reply': (SynthesizeInput, 'TTS',
        'GNANI voice rail only: converts response text already produced by Pine to playable WAV audio. '
        'Does not compose a reply, reason or invoke service tools. May incur charges; no automatic retries.'),
}

class BearerAuthentication:
    def __init__(self, app, token): self.app, self.token = app, token
    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope['path'].rstrip('/') == '/mcp' and self.token:
            supplied = dict(scope['headers']).get(b'authorization', b'')
            if not hmac.compare_digest(supplied, ('Bearer ' + self.token).encode()):
                await JSONResponse({'error': 'Authentication required'}, status_code=401,
                    headers={'WWW-Authenticate': 'Bearer'})(scope, receive, send)
                return
        await self.app(scope, receive, send)


def create_app(config=None, adapter=None):
    config = config or Config.from_env()
    adapter = adapter or GnaniVoice(evidence=EvidenceWriter(config.evidence_path))
    server = Server('gnani-voice-rail', version='1.0.0',
        instructions='GNANI speech conversion only. Pine is the sole Steward reasoning/orchestration brain.')

    @server.list_tools()
    async def list_tools():
        return [types.Tool(name=name, description=description, inputSchema=model.model_json_schema(),
            annotations=types.ToolAnnotations(readOnlyHint=False, destructiveHint=False,
                idempotentHint=False, openWorldHint=True)) for name, (model, _, description) in CATALOG.items()]

    @server.call_tool(validate_input=False)
    async def call_tool(name, arguments):
        if name not in CATALOG:
            result = {'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Voice tool not found.', 'retryable': False}}
        else:
            result = await anyio.to_thread.run_sync(adapter.invoke, CATALOG[name][1], arguments)
        # Audio is JSON/base64 to avoid relying on connector support for audio content blocks.
        return types.CallToolResult(isError=not result['success'], structuredContent=result,
            content=[types.TextContent(type='text', text=json.dumps(result, ensure_ascii=False))])

    hosts = ['127.0.0.1:*', 'localhost:*', '[::1]:*']
    origins = ['http://127.0.0.1:*', 'http://localhost:*', 'http://[::1]:*']
    if config.public_host:
        hosts.extend([config.public_host, config.public_host + ':443'])
        origins.append('https://' + config.public_host)
    manager = StreamableHTTPSessionManager(server, json_response=True, stateless=True,
        max_request_body_size=MAX_BASE64_LENGTH + 16384,
        security_settings=TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=origins))

    @asynccontextmanager
    async def lifespan(app):
        async with manager.run(): yield

    class MCPHTTP:
        async def __call__(self, scope, receive, send): await manager.handle_request(scope, receive, send)

    async def health(request):
        return JSONResponse({'status': 'ok', 'provider': 'GNANI', 'tool_count': 2,
                             'credentials_configured': bool(os.environ.get('GNANI_API_KEY'))})

    app = Starlette(routes=[Route('/mcp', MCPHTTP(), methods=['GET', 'POST', 'DELETE']),
                            Route('/healthz', health)], lifespan=lifespan)
    app.add_middleware(BearerAuthentication, token=config.token)
    return app


def main():
    config = Config.from_env()
    uvicorn.run(create_app(config), host=config.host, port=config.port, access_log=False)

if __name__ == '__main__': main()
