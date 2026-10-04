"""Deterministic mock-only logistics, persistence, contract and boundary tests."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from starlette.testclient import TestClient

from integrations.delhivery_mock.config import Config
from integrations.delhivery_mock.http import SERVICEABILITY, CREATE, TRACK, PROVENANCE
from integrations.delhivery_mock.server import create_app
from integrations.delhivery_mock.storage import Storage

MOCK_TOKEN = 'mock-only-token-0123456789012345678901234'
MCP_TOKEN = 'mcp-only-token-01234567890123456789012345'
SHIPMENT = {'name': 'Synthetic Household', 'order': 'MOCK-PUMP-001', 'phone': '0000000000',
            'add': '1 Fictional Test Lane', 'pin': 560001, 'payment_mode': 'Prepaid',
            'products_desc': 'Washing machine drain pump', 'shipping_mode': 'Surface'}
PICKUP = {'name': 'Steward Mock Warehouse'}
PAYLOAD = {'shipments': [SHIPMENT], 'pickup_location': PICKUP}

class TestDelhiveryMock(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='delhivery-tests-'); self.addCleanup(self.temp.cleanup)
        self.config = Config(mock_token=MOCK_TOKEN, mcp_token=MCP_TOKEN,
                             database=Path(self.temp.name)/'shipments.sqlite3')
        self.app = create_app(self.config)
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def request(self, method, path, scenario=None, **kwargs):
        headers = {'Authorization': 'Token '+MOCK_TOKEN}
        if scenario: headers['X-Mock-Scenario'] = scenario
        headers.update(kwargs.pop('headers', {}))
        return self.client.request(method, path, headers=headers, **kwargs)

    def pin(self, scenario=None, params=None):
        return self.request('GET', SERVICEABILITY, scenario, params={'filter_codes':'560001'} if params is None else params)

    def manifest(self, scenario=None, payload=None):
        return self.request('POST', CREATE, scenario, data={'format':'json', 'data':json.dumps(PAYLOAD if payload is None else payload)})

    def track(self, scenario=None, waybill=None, **kwargs):
        if waybill is None: waybill = self.manifest().json()['logistics']['waybill']
        return self.request('GET', TRACK, scenario, params={'waybill':waybill, **kwargs})

    def invoke(self, tool, args): return asyncio.run(self.app.state.adapter.invoke(tool, args))

    def test_serviceable_blank_remark(self):
        response = self.pin('NORMAL_SERVICEABLE')
        self.assertEqual(response.json(), [{'remark':''}]); self.assertEqual(response.headers['X-Response-Schema'], 'SIMULATION')

    def test_embargo_remark(self): self.assertEqual(self.pin('EMBARGO').json(), [{'remark':'Embargo'}])
    def test_nsz_empty_list(self): self.assertEqual(self.pin('NSZ').json(), [])
    def test_missing_pincode(self): self.assertEqual(self.pin(params={}).status_code, 400)
    def test_malformed_pincode(self):
        for value in ('abc','000000','560001,560002','56001'):
            self.assertEqual(self.pin(params={'filter_codes':value}).status_code, 400)

    def test_auth_missing(self): self.assertEqual(self.client.get(SERVICEABILITY).status_code, 401)
    def test_auth_invalid(self): self.assertEqual(self.request('GET', SERVICEABILITY, headers={'Authorization':'Token wrong'}).status_code, 401)
    def test_auth_schemes_separate(self):
        self.assertEqual(self.request('GET', SERVICEABILITY, headers={'Authorization':'Bearer '+MCP_TOKEN}).status_code, 401)
        self.assertEqual(self.client.post('/mcp', headers={'Authorization':'Token '+MOCK_TOKEN}, json={}).status_code, 401)

    def test_valid_sps_prepaid_creation(self):
        response = self.manifest('SHIPMENT_CREATED'); self.assertEqual(response.status_code, 200)
        result = response.json(); self.assertEqual(result['simulation'], PROVENANCE)
        self.assertEqual(result['logistics']['status'], 'SHIPMENT_CREATED')
        row = self.app.state.storage.get(result['logistics']['waybill'])
        self.assertEqual(json.loads(row['payload']), PAYLOAD)

    def test_all_required_fields(self):
        for field in ('name','order','phone','add','pin','payment_mode'):
            shipment = {k:v for k,v in SHIPMENT.items() if k != field}
            self.assertEqual(self.manifest(payload={'shipments':[shipment], 'pickup_location':PICKUP}).status_code, 400, field)
        self.assertEqual(self.manifest(payload={'shipments':[SHIPMENT]}).status_code, 400)

    def test_empty_required_strings(self):
        for field in ('name','order','phone','add'):
            self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,field:''}], 'pickup_location':PICKUP}).status_code, 400)

    def test_whitespace_required_strings(self):
        for field in ('name','order','phone','add'):
            self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,field:'   '}], 'pickup_location':PICKUP}).status_code, 400)

    def test_duplicate_pincode_parameter_rejected(self):
        self.assertEqual(self.pin(params=[('filter_codes','560001'),('filter_codes','560002')]).status_code,400)

    def test_unknown_query_fields_rejected(self):
        self.assertEqual(self.pin(params={'filter_codes':'560001','close_case':'true'}).status_code,400)
        self.assertEqual(self.track(extra='unknown').status_code,400)

    def test_duplicate_waybill_parameter_rejected(self):
        self.assertEqual(self.request('GET',TRACK,params=[('waybill','1122345678722'),('waybill','1122345678723')]).status_code,400)

    def test_manifest_body_size_bounded(self):
        self.assertEqual(self.request('POST',CREATE,content=b'x'*65537,
            headers={'Content-Type':'application/x-www-form-urlencoded'}).status_code,413)

    def test_strict_pin_integer(self):
        for value in ('560001', True, 12345, 1000000):
            self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'pin':value}], 'pickup_location':PICKUP}).status_code, 400)

    def test_sps_only(self):
        for shipments in ([], [SHIPMENT,SHIPMENT]):
            self.assertEqual(self.manifest(payload={'shipments':shipments, 'pickup_location':PICKUP}).status_code, 400)

    def test_order_id_idempotence(self):
        first = self.manifest().json()['logistics']; second = self.manifest().json()['logistics']
        self.assertEqual(first['waybill'],second['waybill']); self.assertEqual(first['created_at'],second['created_at'])
        self.assertFalse(first['idempotent_replay']); self.assertTrue(second['idempotent_replay'])

    def test_conflicting_duplicate_order(self):
        self.manifest()
        self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'add':'Another Synthetic Address'}], 'pickup_location':PICKUP}).status_code, 409)

    def test_unique_orders_unique_waybills(self):
        first = self.manifest().json()['logistics']['waybill']
        second = self.manifest(payload={'shipments':[{**SHIPMENT,'order':'MOCK-PUMP-002'}], 'pickup_location':PICKUP}).json()['logistics']['waybill']
        self.assertNotEqual(first, second)

    def test_deterministic_waybill_across_databases(self):
        first = self.manifest().json()['logistics']['waybill']
        other = Storage(Path(self.temp.name)/'other.sqlite3')
        self.assertEqual(first, other.create(PAYLOAD)[0]['waybill'])

    def test_persistence_after_restart(self):
        first = self.manifest().json()['logistics']
        other = Storage(self.config.database)
        self.assertEqual(other.get(first['waybill'])['order_id'], SHIPMENT['order'])
        self.assertTrue(other.create(PAYLOAD)[1])

    def test_concurrent_duplicate_is_atomic(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            rows = list(pool.map(lambda _: self.app.state.storage.create(PAYLOAD), range(8)))
        self.assertEqual(sum(not duplicate for _,duplicate in rows),1)
        self.assertEqual(len({row['waybill'] for row,_ in rows}),1)

    def test_invalid_payment_mode(self):
        self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'payment_mode':'ReplacementPart'}], 'pickup_location':PICKUP}).status_code, 400)

    def test_documented_other_journeys_not_enabled(self):
        for mode in ('Pickup','COD','REPL'):
            response = self.manifest(payload={'shipments':[{**SHIPMENT,'payment_mode':mode}], 'pickup_location':PICKUP})
            self.assertEqual(response.json()['error']['code'], 'UNSUPPORTED_SHIPMENT_JOURNEY')

    def test_exact_warehouse_name(self):
        for name in ('steward mock warehouse','Steward Mock Warehouse '):
            self.assertEqual(self.manifest(payload={'shipments':[SHIPMENT], 'pickup_location':{'name':name}}).status_code, 400)

    def test_supplied_waybill_supported(self):
        payload = {'shipments':[{**SHIPMENT,'waybill':'1122345678722'}], 'pickup_location':PICKUP}
        self.assertEqual(self.manifest(payload=payload).json()['logistics']['waybill'],'1122345678722')

    def test_supplied_waybill_conflict(self):
        self.manifest(payload={'shipments':[{**SHIPMENT,'waybill':'1122345678722'}], 'pickup_location':PICKUP})
        self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'order':'MOCK-OTHER','waybill':'1122345678722'}], 'pickup_location':PICKUP}).status_code, 409)

    def test_raw_json_not_claimed_supported(self):
        self.assertEqual(self.request('POST', CREATE, json=PAYLOAD).status_code, 415)

    def test_url_encoding_special_characters(self):
        payload = {'shipments':[{**SHIPMENT,'products_desc':'Pump & fittings + bracket = 1'}], 'pickup_location':PICKUP}
        self.assertEqual(self.manifest(payload=payload).status_code, 200)

    def test_unknown_fields_rejected(self):
        self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'close_case':True}], 'pickup_location':PICKUP}).status_code, 400)

    def test_no_rider_or_capacity_no_shipment(self):
        response = self.manifest('NO_RIDER_OR_CAPACITY'); self.assertEqual(response.status_code,503)
        with self.app.state.storage.connect() as db: self.assertEqual(db.execute('SELECT count(*) FROM shipments').fetchone()[0],0)

    def test_embargo_blocks_manifest(self): self.assertEqual(self.manifest('EMBARGO').status_code,422)
    def test_nsz_blocks_manifest(self): self.assertEqual(self.manifest('NSZ').status_code,422)
    def test_known_tracking(self): self.assertEqual(self.track().json()['logistics']['status'],'SHIPMENT_CREATED')
    def test_unknown_tracking(self): self.assertEqual(self.track(waybill='1122345678722').status_code,404)
    def test_missing_tracking_waybill(self): self.assertEqual(self.request('GET',TRACK).status_code,400)
    def test_bulk_tracking_rejected(self): self.assertEqual(self.track(waybill='1122345678722,1122345678723').status_code,400)
    def test_tracking_ref_ids_match(self): self.assertEqual(self.track(ref_ids=SHIPMENT['order']).status_code,200)
    def test_tracking_ref_ids_mismatch(self): self.assertEqual(self.track(ref_ids='MOCK-OTHER').status_code,404)
    def test_tracking_ref_ids_empty_optional(self): self.assertEqual(self.track(ref_ids='').status_code,200)

    def test_polling_does_not_advance(self):
        waybill = self.manifest().json()['logistics']['waybill']
        first = self.track(waybill=waybill).json(); second = self.track(waybill=waybill).json()
        self.assertEqual(first,second)

    def test_tracking_status_persists(self):
        waybill = self.manifest().json()['logistics']['waybill']; self.track('DELIVERED', waybill)
        self.assertEqual(self.track(waybill=waybill).json()['logistics']['status'],'DELIVERED')
        self.assertEqual(Storage(self.config.database).get(waybill)['scenario'],'DELIVERED')

    def test_scenarios_must_be_known(self): self.assertEqual(self.pin('MAKE_CASE_CLOSED').status_code,400)

    def test_health_has_no_secrets(self):
        response = self.client.get('/healthz'); self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['tool_count'],3); self.assertNotIn(MOCK_TOKEN,response.text)

    def test_evidence_no_pii_or_credentials(self):
        self.manifest(); self.pin(); self.track('DELIVERED')
        with self.app.state.storage.connect() as db:
            text = '\n'.join(row[0] for row in db.execute('SELECT payload FROM evidence'))
        for value in (MOCK_TOKEN,MCP_TOKEN,SHIPMENT['name'],SHIPMENT['phone'],SHIPMENT['add'],SHIPMENT['order']): self.assertNotIn(value,text)
        events = [json.loads(line) for line in text.splitlines()]
        for event in events:
            self.assertEqual(event['provider'],'DELHIVERY_MOCK')
            for field in ('timestamp','operation','http_method','documented_endpoint_path','request_metadata','scenario','result','latency_ms','success'):
                self.assertIn(field,event)
        self.assertIn(hashlib.sha256(SHIPMENT['order'].encode()).hexdigest(),text)

    def test_credential_reflection_rejected(self):
        self.assertEqual(self.manifest(payload={'shipments':[{**SHIPMENT,'products_desc':MOCK_TOKEN}], 'pickup_location':PICKUP}).status_code,400)

    def test_database_private_permissions(self): self.assertEqual(self.config.database.stat().st_mode & 0o777,0o600)

    def test_config_requires_distinct_tokens(self):
        for kwargs in ({'mock_token':''},{'mcp_token':'short'},{'mcp_token':MOCK_TOKEN}):
            with self.assertRaises(ValueError): replace(self.config, **kwargs)

    def test_config_protects_canonical_data(self):
        with self.assertRaises(ValueError): replace(self.config,database=Path('data/delhivery.sqlite3'))
        with self.assertRaises(ValueError): replace(self.config,public_host='https://bad.example')
        self.assertNotIn(MOCK_TOKEN,repr(self.config))

    def test_mcp_serviceability_maps_documented_semantics(self):
        for scenario,serviceable in (('NORMAL_SERVICEABLE',True),('EMBARGO',False),('NSZ',False)):
            result = self.invoke('check_delivery_serviceability',{'filter_codes':'560001','simulation_scenario':scenario})
            self.assertTrue(result['success']); self.assertEqual(result['logistics']['serviceable'],serviceable)

    def test_mcp_manifest_and_tracking_use_http_routes(self):
        created = self.invoke('create_part_shipment',{'shipment':SHIPMENT,'pickup_location':PICKUP})
        self.assertTrue(created['success'])
        tracked = self.invoke('track_part_shipment',{'waybill':created['logistics']['waybill'],'simulation_scenario':'DELIVERED'})
        self.assertEqual(tracked['logistics']['status'],'DELIVERED')
        with self.app.state.storage.connect() as db: events = [json.loads(r[0]) for r in db.execute('SELECT payload FROM evidence')]
        self.assertTrue(any(e['documented_endpoint_path']==CREATE and e.get('stage') is None for e in events))
        self.assertTrue(any(e['documented_endpoint_path']==TRACK and e.get('stage') is None for e in events))

    def test_mcp_rejects_extra_decision_arguments(self):
        result = self.invoke('check_delivery_serviceability',{'filter_codes':'560001','authority':True})
        self.assertFalse(result['success']); self.assertEqual(result['error']['code'],'INVALID_ARGUMENT')

    def test_unknown_tool_does_not_log_arbitrary_name(self):
        result = self.invoke(MOCK_TOKEN,{})
        self.assertFalse(result['success']); self.assertNotIn(MOCK_TOKEN,json.dumps(result))

    def test_boundary_no_brain_imports_or_case_outputs(self):
        import ast
        root = Path('integrations/delhivery_mock')
        forbidden = ('steward','rails','repair_policy','authority','case_manager','verifier','recovery','payments')
        for path in root.glob('*.py'):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node,ast.Import): modules = [alias.name for alias in node.names]
                elif isinstance(node,ast.ImportFrom): modules = [node.module or '']
                else: continue
                self.assertFalse(any(part in module.split('.') for module in modules for part in forbidden), str(path))
        before = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('data').rglob('*.json')}
        response = self.track('DELIVERED').json()
        self.assertEqual(response['logistics']['status'],'DELIVERED')
        self.assertNotIn('case_status',json.dumps(response)); self.assertNotIn('RESOLVED',json.dumps(response)); self.assertNotIn('CLOSED',json.dumps(response))
        self.assertEqual(before,{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('data').rglob('*.json')})

    def test_delivered_leaves_existing_awaiting_part_case_untouched(self):
        # Test-only interaction with an isolated case, never imported by the rail.
        from steward.models import ServiceCase, CaseState
        from steward.states import evaluate_closure_invariant
        case = ServiceCase(case_id='MOCK-CASE', machine_id='WM-001',
                           problem='Synthetic drain pump fault', current_state=CaseState.AWAITING_PART)
        before = repr(case)
        result = self.track('DELIVERED').json()
        self.assertEqual(result['logistics']['status'],'DELIVERED')
        self.assertEqual(repr(case),before); self.assertEqual(case.current_state,CaseState.AWAITING_PART)
        self.assertFalse(evaluate_closure_invariant(case)[0])

# Individually reported deterministic operation/scenario cases.
def scenario_test(operation, scenario):
    def run(self):
        response = {'serviceability':self.pin,'shipment':self.manifest,'tracking':self.track}[operation](scenario)
        if scenario == 'TIMEOUT':
            self.assertEqual(response.status_code,504); self.assertEqual(response.json()['error']['code'],'TIMEOUT')
        elif scenario == 'MALFORMED_RESPONSE':
            self.assertEqual(response.status_code,200)
            with self.assertRaises(ValueError): response.json()
        else:
            self.assertEqual(response.json()['logistics']['status'],scenario)
    return run

for _operation in ('serviceability','shipment','tracking'):
    for _scenario in ('TIMEOUT','MALFORMED_RESPONSE'):
        setattr(TestDelhiveryMock,'test_'+_operation+'_'+_scenario.lower(),scenario_test(_operation,_scenario))
for _scenario in ('IN_TRANSIT','DELIVERED','DELIVERY_EXCEPTION'):
    setattr(TestDelhiveryMock,'test_tracking_'+_scenario.lower(),scenario_test('tracking',_scenario))

def adapter_failure_test(tool, scenario):
    def run(self):
        args = {'filter_codes':'560001'} if tool == 'check_delivery_serviceability' else (
            {'shipment':SHIPMENT,'pickup_location':PICKUP} if tool == 'create_part_shipment' else
            {'waybill':self.manifest().json()['logistics']['waybill']})
        result = self.invoke(tool,{**args,'simulation_scenario':scenario})
        self.assertFalse(result['success']); self.assertEqual(result['error']['code'],scenario)
    return run

for _tool in ('check_delivery_serviceability','create_part_shipment','track_part_shipment'):
    for _scenario in ('TIMEOUT','MALFORMED_RESPONSE'):
        setattr(TestDelhiveryMock,'test_mcp_'+_tool+'_'+_scenario.lower(),adapter_failure_test(_tool,_scenario))

if __name__ == '__main__': unittest.main()
