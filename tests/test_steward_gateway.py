"""Gateway contract tests: imported rails, mocked paid voice upstream, no live APIs."""
import ast
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx
from starlette.testclient import TestClient

from integrations.steward_gateway.config import Config
from integrations.steward_gateway.server import create_app, TOOL_NAMES
from integrations.steward_mcp import server as steward
from integrations.gnani_voice import server as gnani
from integrations.gnani_voice.adapter import GnaniVoice, STT_URL
from integrations.delhivery_mock import server as delhivery
from tests.test_gnani_voice import AUDIO, TEXT, wav, STT_OK
from tests.test_mcp_memory import PROVIDER, SLOT, evidence
from tests.test_delhivery_mock import MOCK_TOKEN, MCP_TOKEN, SHIPMENT, PICKUP

TOKEN = 'gateway-test-only-012345678901234567890'
EXPECTED = {'get_machine_memory', 'update_machine_memory', 'request_service_quote',
            'request_service_appointment', 'get_service_status', 'transcribe_voice_input',
            'synthesize_voice_reply', 'check_delivery_serviceability', 'create_part_shipment',
            'track_part_shipment'}


class TestGateway(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='steward-gateway-test-')
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {'GNANI_API_KEY': 'mock-only-placeholder'})
        self.env.start()
        self.addCleanup(self.env.stop)

        def upstream(request):
            if str(request.url) == STT_URL:
                return httpx.Response(200, json=STT_OK)
            return httpx.Response(200, content=wav(), headers={'content-type': 'audio/wav'})

        voice_client = httpx.Client(transport=httpx.MockTransport(upstream), trust_env=False)
        self.addCleanup(voice_client.close)
        self.children = (
            (steward.create_app(steward.Config(database=root/'memory.sqlite3', bearer_token='s'*32)), 's'*32),
            (gnani.create_app(gnani.Config(token='v'*32), GnaniVoice(voice_client)), 'v'*32),
            (delhivery.create_app(delhivery.Config(mock_token=MOCK_TOKEN, mcp_token=MCP_TOKEN,
                                                   database=root/'shipments.sqlite3')), MCP_TOKEN))
        self.forwarded = []
        self.discovered = []
        original = httpx.AsyncClient.post

        async def capture(client, *args, **kwargs):
            response = await original(client, *args, **kwargs)
            if kwargs.get('json', {}).get('method') == 'tools/list':
                self.discovered.extend(response.json()['result']['tools'])
            if kwargs.get('json', {}).get('method') == 'tools/call':
                self.forwarded.append(response.json()['result'])
            return response

        interceptor = patch.object(httpx.AsyncClient, 'post', capture)
        interceptor.start()
        self.addCleanup(interceptor.stop)
        self.client = TestClient(create_app(Config(token=TOKEN, public_host='gateway.onrender.com'), self.children),
                                 base_url='http://127.0.0.1:8004')
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.headers = {'Authorization': 'Bearer '+TOKEN,
                        'Accept': 'application/json, text/event-stream',
                        'MCP-Protocol-Version': '2025-06-18'}

    def rpc(self, method, params=None):
        response = self.client.post('/mcp', headers=self.headers, json={
            'jsonrpc': '2.0', 'id': 1, 'method': method,
            **({'params': params} if params is not None else {})})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['result']

    def call(self, name, arguments, error=False):
        result = self.rpc('tools/call', {'name': name, 'arguments': arguments})
        self.assertEqual(result.get('isError', False), error, result)
        # Exact child envelope, including content, evidence, errors and structuredContent.
        self.assertEqual(result, self.forwarded[-1])
        return result['structuredContent']

    def test_exact_discovery_and_unchanged_complete_contracts(self):
        self.assertEqual(TOOL_NAMES, EXPECTED)
        initialized = self.rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                                              'clientInfo': {'name': 'test', 'version': '1'}})
        self.assertEqual(initialized['serverInfo']['name'], 'steward-round3-gateway')
        actual = self.rpc('tools/list')['tools']
        expected = self.discovered
        self.assertEqual(len(actual), 10)
        self.assertEqual({t['name'] for t in actual}, EXPECTED)
        self.assertEqual(actual, expected)

    def test_all_ten_calls_preserve_results(self):
        memory = self.call('get_machine_memory', {'machine_id': 'WM-001'})
        self.call('update_machine_memory', {'machine_id': 'WM-001', 'case_id': 'CASE-GATEWAY',
            'expected_revision': memory['revision'], 'idempotency_key': 'gateway-update', 'updates': [
                {'type': 'append_failure', 'record_id': 'FAIL-GATEWAY', 'date': '2026-10-03',
                 'problem': 'not draining', 'fault_type': 'drainage', 'evidence': evidence()}]})
        quote = self.call('request_service_quote', {'machine_id': 'WM-001', 'case_id': 'CASE-GATEWAY',
            'provider_id': PROVIDER, 'issue_description': 'Not draining', 'idempotency_key': 'gateway-quote'})
        appointment = self.call('request_service_appointment', {'machine_id': 'WM-001', 'case_id': 'CASE-GATEWAY',
            'provider_id': PROVIDER, 'quote_id': quote['quote_id'], 'requested_slot': SLOT,
            'idempotency_key': 'gateway-book'})
        self.call('get_service_status', {'reference': {'type': 'APPOINTMENT', 'id': appointment['appointment_id']}})
        self.assertEqual(self.call('transcribe_voice_input', AUDIO)['transcript'], STT_OK['transcript'])
        self.assertEqual(self.call('synthesize_voice_reply', TEXT)['source'], 'GNANI_TTS')
        self.call('check_delivery_serviceability', {'filter_codes': '560001'})
        shipment = self.call('create_part_shipment', {'shipment': {**SHIPMENT, 'order': 'MOCK-GATEWAY'},
                                                    'pickup_location': PICKUP})
        tracked = self.call('track_part_shipment', {'waybill': shipment['logistics']['waybill'],
                                                   'simulation_scenario': 'DELIVERED'})
        self.assertEqual(tracked['logistics']['status'], 'DELIVERED')
        self.assertNotIn('case_status', tracked)
        self.assertNotIn('verified', tracked)

    def test_errors_remain_errors_and_no_approval_is_inferred(self):
        for name, arguments in (
            ('get_machine_memory', {'machine_id': 'WM-001', 'approval': True}),
            ('synthesize_voice_reply', {**TEXT, 'approval': True}),
            ('check_delivery_serviceability', {'filter_codes': '560001', 'simulation_scenario': 'TIMEOUT'})):
            self.call(name, arguments, error=True)
        unknown = self.rpc('tools/call', {'name': 'close_case', 'arguments': {}})
        self.assertTrue(unknown['isError'])

    def test_auth_health_and_host_origin_protection(self):
        self.assertEqual(self.client.get('/healthz').json(), {'status': 'ok', 'tool_count': 10})
        for path in ('/mcp', '/mcp/'):
            for token in (None, 'wrong', 's'*32, 'v'*32, MCP_TOKEN):
                headers = {} if token is None else {'Authorization': 'Bearer '+token}
                for method in ('GET', 'POST', 'DELETE'):
                    self.assertEqual(self.client.request(method, path, headers=headers).status_code, 401)
        body = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}
        headers = {**self.headers, 'Host': 'gateway.onrender.com', 'Origin': 'https://gateway.onrender.com'}
        self.assertEqual(self.client.post('/mcp', headers=headers, json=body).status_code, 200)
        self.assertEqual(self.client.post('/mcp', headers={**headers, 'Host': 'untrusted.example'}, json=body).status_code, 421)
        self.assertEqual(self.client.post('/mcp', headers={**headers, 'Origin': 'https://untrusted.example'}, json=body).status_code, 403)
        self.assertEqual(self.client.get('/c/api/pin-codes/json/').status_code, 404)

    def test_config_requires_separate_strong_secret(self):
        for token in ('', 'short', 'x'*31, '\n'+'x'*32, '₹'*32):
            with self.assertRaises(ValueError):
                Config(token=token)
        with self.assertRaises(ValueError):
            create_app(Config(token='s'*32), self.children)

    def test_gateway_has_only_transport_logic(self):
        folder = Path(__file__).resolve().parents[1]/'integrations/steward_gateway'
        imports = set()
        for path in folder.glob('*.py'):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    imports.add(node.module)
                if isinstance(node, ast.Constant):
                    self.assertNotEqual(node.value, 1500)
                if isinstance(node, ast.Name):
                    self.assertNotIn(node.id, {'case_state', 'authority_limit', 'requires_human',
                        'approval', 'verified', 'closure', 'recovery', 'transition'})
        self.assertFalse(any(module and module.startswith(('steward.', 'rails.')) for module in imports))
        source = (folder/'server.py').read_text()
        self.assertIn("result = await forward(routes[name], 'tools/call'", source)
        self.assertIn('return types.CallToolResult.model_validate(result)', source)
        self.assertNotIn('arguments[', source)
        self.assertNotIn('arguments.get(', source)


if __name__ == '__main__':
    unittest.main()
