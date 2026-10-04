"""Actual localhost MCP transport; Gnani upstream is mocked and cannot incur charges."""
import asyncio
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from tests.test_gnani_voice import AUDIO, TEXT

TOKEN = 'transport-test-token-012345678901234567890'
EXPECTED = {'transcribe_voice_input', 'synthesize_voice_reply'}

class TestGnaniTransport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='gnani-mcp-test-'); cls.addClassCleanup(cls.temp.cleanup)
        with socket.socket() as reserve: reserve.bind(('127.0.0.1', 0)); cls.port = reserve.getsockname()[1]
        cls.url = f'http://127.0.0.1:{cls.port}/mcp'
        code = '''
import httpx, uvicorn
from integrations.gnani_voice.adapter import GnaniVoice, STT_URL
from integrations.gnani_voice.server import create_app
from integrations.gnani_voice.config import Config
from integrations.gnani_voice.evidence import EvidenceWriter
from tests.test_gnani_voice import wav, STT_OK
from pathlib import Path
import json

def upstream(request):
    if str(request.url) == STT_URL: return httpx.Response(200, json=STT_OK)
    if json.loads(request.read())['text'] == 'upstream rejection': return httpx.Response(429)
    return httpx.Response(200, content=wav(), headers={'content-type':'audio/wav'})
client=httpx.Client(transport=httpx.MockTransport(upstream),trust_env=False)
config=Config(port=PORT_VALUE,token=TOKEN_VALUE,public_host='gnani-voice.onrender.com')
app=create_app(config,GnaniVoice(client,EvidenceWriter(Path(EVIDENCE_VALUE))))
uvicorn.run(app,host='127.0.0.1',port=config.port,access_log=False)
'''.replace('PORT_VALUE', str(cls.port)).replace('TOKEN_VALUE', repr(TOKEN)).replace('EVIDENCE_VALUE', repr(str(Path(cls.temp.name) / 'calls.jsonl')))
        env = {k:v for k,v in os.environ.items() if not k.startswith(('GNANI_', 'STEWARD_MCP_')) and k not in ('PORT','RENDER_EXTERNAL_HOSTNAME')}
        env['GNANI_API_KEY'] = 'unit-placeholder-not-a-live-key'; env['PYTHONDONTWRITEBYTECODE'] = '1'
        cls.logs = tempfile.TemporaryFile(mode='w+'); cls.addClassCleanup(cls.logs.close)
        cls.process = subprocess.Popen([sys.executable, '-B', '-c', code], env=env,
            cwd=Path(__file__).resolve().parents[1], stdout=cls.logs, stderr=cls.logs)
        cls.addClassCleanup(cls.stop)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if cls.process.poll() is not None: break
            try:
                if httpx.get(cls.url.replace('/mcp', '/healthz'), trust_env=False, timeout=0.5).status_code == 200: return
            except httpx.HTTPError: pass
            time.sleep(0.05)
        cls.logs.seek(0); raise AssertionError('Voice server startup failed: '+cls.logs.read())

    @classmethod
    def stop(cls):
        if cls.process.poll() is None:
            cls.process.terminate()
            try: cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired: cls.process.kill(); cls.process.wait(timeout=5)

    async def session(self, operation):
        async with httpx.AsyncClient(headers={'Authorization': 'Bearer '+TOKEN}, timeout=5, trust_env=False) as client:
            async with streamable_http_client(self.url, http_client=client) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize(); return await operation(session)

    def test_authenticated_discovery_is_separate_gnani_connector(self):
        async def run(session):
            tools = (await session.list_tools()).tools
            self.assertEqual({t.name for t in tools}, EXPECTED)
            for t in tools:
                self.assertFalse(t.annotations.idempotentHint); self.assertTrue(t.annotations.openWorldHint)
        asyncio.run(self.session(run))

    def test_real_http_invocation_both_conversion_tools(self):
        async def run(session):
            stt = await session.call_tool('transcribe_voice_input', AUDIO)
            self.assertFalse(stt.isError); self.assertEqual(stt.structuredContent['source'], 'GNANI_STT')
            tts = await session.call_tool('synthesize_voice_reply', TEXT)
            self.assertFalse(tts.isError); self.assertGreater(tts.structuredContent['audio_bytes'], 44)
        asyncio.run(self.session(run))

    def test_malformed_arguments_cannot_smuggle_case_logic(self):
        async def run(session):
            result = await session.call_tool('transcribe_voice_input', {**AUDIO,'approval':True})
            self.assertTrue(result.isError); self.assertEqual(result.structuredContent['error']['code'], 'INVALID_ARGUMENT')
        asyncio.run(self.session(run))

    def test_upstream_error_remains_mcp_error(self):
        async def run(session):
            result = await session.call_tool('synthesize_voice_reply', {'text':'upstream rejection'})
            self.assertTrue(result.isError); self.assertEqual(result.structuredContent['error']['code'],'RATE_LIMITED')
            self.assertNotIn('audio_base64',result.structuredContent)
        asyncio.run(self.session(run))

    def test_auth_required_for_mcp_but_health_is_public(self):
        for headers in ({},{'Authorization':'Bearer wrong'}):
            self.assertEqual(httpx.post(self.url,json={},headers=headers,trust_env=False).status_code,401)
        health=httpx.get(self.url.replace('/mcp','/healthz'),trust_env=False)
        self.assertEqual(health.json(),{'status':'ok','provider':'GNANI','tool_count':2,'credentials_configured':True})

    def test_public_proxy_host_origin_supported_without_wildcards(self):
        headers={'Authorization':'Bearer '+TOKEN,'Host':'gnani-voice.onrender.com',
                 'Origin':'https://gnani-voice.onrender.com','Accept':'application/json, text/event-stream',
                 'MCP-Protocol-Version':'2025-06-18'}
        body={'jsonrpc':'2.0','id':1,'method':'tools/list'}
        response=httpx.post(self.url,json=body,headers=headers,trust_env=False)
        self.assertEqual(response.status_code,200);self.assertEqual({t['name'] for t in response.json()['result']['tools']},EXPECTED)
        response=httpx.post(self.url,json=body,headers={**headers,'Origin':'https://untrusted.example'},trust_env=False)
        self.assertEqual(response.status_code,403)
        response=httpx.post(self.url,json=body,headers={**headers,'Host':'untrusted.example'},trust_env=False)
        self.assertEqual(response.status_code,421)
