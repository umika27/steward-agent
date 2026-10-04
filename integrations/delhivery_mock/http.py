"""Only documented B2C request paths; response fixtures explicitly SIMULATION."""
import hmac
import json
import time
from urllib.parse import parse_qs

from pydantic import ValidationError
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from .config import SCENARIOS
from .schemas import Manifest, ServiceabilityInput, TrackInput
from .storage import Conflict, digest, now

SERVICEABILITY = '/c/api/pin-codes/json/'
CREATE = '/api/cmu/create.json'
TRACK = '/api/v1/packages/json/'
OPERATIONS = {SERVICEABILITY: 'serviceability', CREATE: 'shipment_creation', TRACK: 'tracking'}
PROVENANCE = {'provider': 'DELHIVERY_MOCK', 'provider_rail': 'DELHIVERY',
              'execution_environment': 'MOCK', 'contract_basis': 'OFFICIAL DELHIVERY B2C DOCUMENTATION',
              'response_schema': 'SIMULATION — authoritative provider response schemas not supplied'}

def simulated(facts=None, error=None, status=200):
    body = {'simulation': PROVENANCE, 'logistics': facts} if error is None else {
        'simulation': PROVENANCE, 'error': {'code': error}}
    return JSONResponse(body, status_code=status)

def service_fixture(scenario):
    # Only empty-list and remark semantics are documented; record/list shape is a fixture.
    return [] if scenario == 'NSZ' else [{'remark': 'Embargo' if scenario == 'EMBARGO' else ''}]

class MockHTTP:
    def __init__(self, config, storage): self.config, self.storage = config, storage

    async def handle(self, request):
        started = time.monotonic()
        scenario = request.headers.get('x-mock-scenario', self.config.scenario)
        event = {**PROVENANCE, 'timestamp': now(), 'operation': OPERATIONS[request.url.path],
                 'http_method': request.method, 'documented_endpoint_path': request.url.path,
                 'request_metadata': {}, 'scenario': scenario if scenario in SCENARIOS else 'INVALID',
                 'success': False}
        try:
            supplied = request.headers.get('authorization', '').encode()
            if not hmac.compare_digest(supplied, ('Token ' + self.config.mock_token).encode()):
                response = simulated(error='UNAUTHORIZED', status=401)
            elif scenario not in SCENARIOS:
                response = simulated(error='INVALID_SCENARIO', status=400)
            else:
                response = await self.operation(request, scenario, event)
        except (ValidationError, ValueError, UnicodeDecodeError, TypeError, KeyError):
            response = simulated(error='INVALID_REQUEST', status=400)
        except Conflict:
            response = simulated(error='CONFLICTING_ORDER_OR_WAYBILL', status=409)
        event.update(http_status=response.status_code, latency_ms=round((time.monotonic()-started)*1000, 2))
        if response.media_type == 'application/json':
            body = json.loads(response.body)
            event['result'] = body.get('error', {}).get('code', 'LOGISTICS_FACTS') if isinstance(body, dict) else 'SERVICEABILITY_FACTS'
            event['success'] = response.status_code < 400
        else: event['result'] = 'MALFORMED_RESPONSE'
        self.storage.record(event)
        # Headers label the minimal serviceability fixture without altering NSZ empty-list semantics.
        response.headers['X-Execution-Environment'] = 'MOCK'
        response.headers['X-Response-Schema'] = 'SIMULATION'
        response.headers['X-Mock-Scenario'] = event['scenario']
        return response

    async def operation(self, request, scenario, event):
        path = request.url.path
        if path == SERVICEABILITY:
            if set(request.query_params) != {'filter_codes'} or len(request.query_params.getlist('filter_codes')) != 1:
                raise ValueError()
            ServiceabilityInput.model_validate(dict(request.query_params))
            event['request_metadata'] = {'single_pincode': True}
        elif path == CREATE:
            if request.headers.get('content-type', '').split(';')[0] != 'application/x-www-form-urlencoded':
                return simulated(error='URL_ENCODED_PAYLOAD_REQUIRED', status=415)
            data = bytearray()
            async for chunk in request.stream():
                data.extend(chunk)
                if len(data) > 65536: return simulated(error='REQUEST_TOO_LARGE', status=413)
            form = parse_qs(data.decode(), strict_parsing=True, keep_blank_values=True)
            if set(form) != {'format', 'data'} or form['format'] != ['json'] or len(form['data']) != 1:
                raise ValueError()
            payload = Manifest.model_validate_json(form['data'][0]).model_dump(exclude_none=True)
            shipment = payload['shipments'][0]
            # Never reflect either credential through submitted values or persisted inputs.
            def contains_token(value):
                if isinstance(value, str): return any(token in value for token in (self.config.mock_token, self.config.mcp_token))
                if isinstance(value, dict): return any(contains_token(k) or contains_token(v) for k,v in value.items())
                if isinstance(value, list): return any(contains_token(v) for v in value)
                return False
            if contains_token(payload):
                raise ValueError()
            event['request_metadata'] = {'shipment_count': 1, 'payment_mode': shipment['payment_mode']}
            event['order_id_sha256'] = digest(shipment['order'])
            if shipment['payment_mode'] != 'Prepaid':
                return simulated(error='UNSUPPORTED_SHIPMENT_JOURNEY', status=400)
            if payload['pickup_location']['name'] != self.config.warehouse:
                return simulated(error='WAREHOUSE_NAME_MISMATCH', status=400)
            waybill = shipment.get('waybill')
            if waybill is not None and (not isinstance(waybill, str) or len(waybill) != 13 or not waybill.isascii() or not waybill.isdigit()):
                raise ValueError()
        else:
            if set(request.query_params) - {'waybill', 'ref_ids'} or any(
                    len(request.query_params.getlist(key)) != 1 for key in request.query_params): raise ValueError()
            args = TrackInput.model_validate(dict(request.query_params))
            event['waybill'] = args.waybill

        if scenario == 'TIMEOUT': return simulated(error='TIMEOUT', status=504)
        if scenario == 'MALFORMED_RESPONSE': return Response(b'{intentionally invalid JSON', media_type='application/json-invalid')
        if path == SERVICEABILITY: return JSONResponse(service_fixture(scenario))
        if path == CREATE:
            # The same scenario fixture is checked before manifestation; no authority decisions.
            serviceability = service_fixture(scenario)
            if not serviceability or serviceability[0]['remark'] == 'Embargo':
                return simulated(error='PINCODE_NOT_SERVICEABLE', status=422)
            if scenario == 'NO_RIDER_OR_CAPACITY': return simulated(error='NO_RIDER_OR_CAPACITY', status=503)
            row, duplicate = self.storage.create(payload)
            event['waybill'] = row['waybill']
            return simulated({'order_id': row['order_id'], 'waybill': row['waybill'],
                              'status': row['scenario'], 'created_at': row['created_at'], 'idempotent_replay': duplicate})
        row = self.storage.get(args.waybill)
        if not row: return simulated(error='UNKNOWN_WAYBILL', status=404)
        if args.ref_ids and args.ref_ids != row['order_id']: return simulated(error='REFERENCE_MISMATCH', status=404)
        status = scenario if scenario in ('IN_TRANSIT', 'DELIVERED', 'DELIVERY_EXCEPTION') else row['scenario']
        history = self.storage.track(args.waybill, status)
        event['order_id_sha256'] = digest(row['order_id'])
        return simulated({'waybill': args.waybill, 'order_id': row['order_id'], 'status': status, 'history': history})

    def routes(self):
        return [Route(SERVICEABILITY, self.handle, methods=['GET']),
                Route(CREATE, self.handle, methods=['POST']), Route(TRACK, self.handle, methods=['GET'])]
