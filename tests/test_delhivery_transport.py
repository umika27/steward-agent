"""Real localhost MCP discovery and calls; the upstream is our HTTP mock only."""
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

from integrations.delhivery_mock.http import SERVICEABILITY, CREATE, TRACK
from tests.test_delhivery_mock import MOCK_TOKEN, MCP_TOKEN, SHIPMENT, PICKUP, PAYLOAD

TOOLS = {'check_delivery_serviceability', 'create_part_shipment', 'track_part_shipment'}

class TestDelhiveryTransport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='delhivery-http-'); cls.addClassCleanup(cls.temp.cleanup)
        with socket.socket() as sock: sock.bind(('127.0.0.1',0)); cls.port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{cls.port}'
        cls.database = Path(cls.temp.name)/'shipments.sqlite3'
        env = {k:v for k,v in os.environ.items() if not k.startswith(('DELHIVERY_','GNANI_')) and k not in ('PORT','RENDER_EXTERNAL_HOSTNAME')}
        env.update(DELHIVERY_MOCK_TOKEN=MOCK_TOKEN, DELHIVERY_MCP_AUTH_TOKEN=MCP_TOKEN,
                   DELHIVERY_DATABASE_PATH=str(cls.database), DELHIVERY_PORT=str(cls.port),
                   DELHIVERY_PUBLIC_HOST='delhivery-mock-rail.onrender.com', PYTHONDONTWRITEBYTECODE='1')
        cls.logs = tempfile.TemporaryFile(mode='w+'); cls.addClassCleanup(cls.logs.close)
        cls.process = subprocess.Popen([sys.executable,'-B','-m','integrations.delhivery_mock.server'],
            env=env, cwd=Path(__file__).resolve().parents[1], stdout=cls.logs, stderr=cls.logs)
        cls.addClassCleanup(cls.stop)
        deadline = time.monotonic()+10
        while time.monotonic()<deadline:
            if cls.process.poll() is not None: break
            try:
                if httpx.get(cls.base+'/healthz',trust_env=False,timeout=0.5).status_code == 200: return
            except httpx.HTTPError: pass
            time.sleep(0.05)
        cls.logs.seek(0); raise AssertionError('Mock startup failed: '+cls.logs.read())

    @classmethod
    def stop(cls):
        if cls.process.poll() is None:
            cls.process.terminate()
            try: cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired: cls.process.kill(); cls.process.wait(timeout=5)

    async def session(self, operation):
        async with httpx.AsyncClient(headers={'Authorization':'Bearer '+MCP_TOKEN},trust_env=False,timeout=5) as client:
            async with streamable_http_client(self.base+'/mcp',http_client=client) as (read,write,_):
                async with ClientSession(read,write) as session:
                    await session.initialize(); return await operation(session)

    def test_discovery_only_three_logistics_tools(self):
        async def run(session):
            tools = (await session.list_tools()).tools
            self.assertEqual({tool.name for tool in tools},TOOLS)
            for tool in tools:
                self.assertFalse(tool.inputSchema['additionalProperties']); self.assertFalse(tool.annotations.openWorldHint)
        asyncio.run(self.session(run))

    def test_normal_flow_over_actual_mcp_http(self):
        async def run(session):
            pin = await session.call_tool('check_delivery_serviceability',{'filter_codes':'560001'})
            self.assertFalse(pin.isError); self.assertTrue(pin.structuredContent['logistics']['serviceable'])
            created = await session.call_tool('create_part_shipment',{'shipment':{**SHIPMENT,'order':'MOCK-MCP-001'},'pickup_location':PICKUP})
            self.assertFalse(created.isError)
            tracked = await session.call_tool('track_part_shipment',{'waybill':created.structuredContent['logistics']['waybill'],'simulation_scenario':'DELIVERED'})
            self.assertFalse(tracked.isError); self.assertEqual(tracked.structuredContent['logistics']['status'],'DELIVERED')
            self.assertNotIn('case_status',json.dumps(tracked.structuredContent))
        asyncio.run(self.session(run))

    def test_exact_documented_routes(self):
        headers = {'Authorization':'Token '+MOCK_TOKEN}
        pin = httpx.get(self.base+SERVICEABILITY,params={'filter_codes':'194103'},headers=headers,trust_env=False)
        self.assertEqual(pin.json(),[{'remark':''}])
        payload = {'shipments':[{**SHIPMENT,'order':'MOCK-HTTP-001'}],'pickup_location':PICKUP}
        created = httpx.post(self.base+CREATE,data={'format':'json','data':json.dumps(payload)},headers=headers,trust_env=False)
        self.assertEqual(created.status_code,200)
        tracked = httpx.get(self.base+TRACK,params={'waybill':created.json()['logistics']['waybill'],'ref_ids':'MOCK-HTTP-001'},headers=headers,trust_env=False)
        self.assertEqual(tracked.status_code,200)

    def test_auth_and_health(self):
        for headers in ({},{'Authorization':'Bearer wrong'},{'Authorization':'Token '+MOCK_TOKEN}):
            self.assertEqual(httpx.post(self.base+'/mcp',json={},headers=headers,trust_env=False).status_code,401)
        self.assertEqual(httpx.get(self.base+SERVICEABILITY,trust_env=False).status_code,401)
        self.assertEqual(httpx.get(self.base+'/healthz',trust_env=False).status_code,200)

    def test_remote_host_origin_validation(self):
        headers = {'Authorization':'Bearer '+MCP_TOKEN,'Host':'delhivery-mock-rail.onrender.com',
                   'Origin':'https://delhivery-mock-rail.onrender.com','Accept':'application/json, text/event-stream',
                   'MCP-Protocol-Version':'2025-06-18'}
        request = {'jsonrpc':'2.0','id':1,'method':'tools/list'}
        response = httpx.post(self.base+'/mcp',json=request,headers=headers,trust_env=False)
        self.assertEqual(response.status_code,200)
        self.assertEqual({t['name'] for t in response.json()['result']['tools']},TOOLS)
        self.assertEqual(httpx.post(self.base+'/mcp',json=request,headers={**headers,'Host':'untrusted.example'},trust_env=False).status_code,421)
        self.assertEqual(httpx.post(self.base+'/mcp',json=request,headers={**headers,'Origin':'https://untrusted.example'},trust_env=False).status_code,403)

    def test_bad_scenarios_are_mcp_errors_without_success(self):
        async def run(session):
            for scenario in ('TIMEOUT','MALFORMED_RESPONSE'):
                result = await session.call_tool('check_delivery_serviceability',{'filter_codes':'560001','simulation_scenario':scenario})
                self.assertTrue(result.isError); self.assertEqual(result.structuredContent['error']['code'],scenario)
        asyncio.run(self.session(run))

    def test_mcp_and_http_share_persistent_facts(self):
        payload = {'shipments':[{**SHIPMENT,'order':'MOCK-CROSS-001'}],'pickup_location':PICKUP}
        result = httpx.post(self.base+CREATE,data={'format':'json','data':json.dumps(payload)},
            headers={'Authorization':'Token '+MOCK_TOKEN},trust_env=False).json()
        async def run(session):
            tracked = await session.call_tool('track_part_shipment',{'waybill':result['logistics']['waybill']})
            self.assertEqual(tracked.structuredContent['logistics']['order_id'],'MOCK-CROSS-001')
        asyncio.run(self.session(run))

if __name__ == '__main__': unittest.main()
