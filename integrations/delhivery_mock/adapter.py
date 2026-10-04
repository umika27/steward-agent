"""Thin MCP-to-HTTP bridge. Calls only our in-process mock, never a live provider."""
import json
import time

import httpx
from pydantic import ValidationError

from .http import CREATE, SERVICEABILITY, TRACK, PROVENANCE
from .schemas import ServiceabilityInput, CreateInput, TrackInput
from .storage import digest, now

CATALOG = {
    'check_delivery_serviceability': (ServiceabilityInput, 'GET', SERVICEABILITY,
        'MOCK Delhivery pincode facts only: blank remark is serviceable, Embargo or empty list is not. '
        'simulation_scenario is an explicit evaluation control, not a Delhivery API field.'),
    'create_part_shipment': (CreateInput, 'POST', CREATE,
        'MOCK single-piece Prepaid forward shipment of a physical repair part. '
        'Pine decides whether to request it. No payment, approval, repair or case decisions.'),
    'track_part_shipment': (TrackInput, 'GET', TRACK,
        'MOCK logistics facts for one waybill. DELIVERED means only that the physical part arrived; '
        'installation and household verification still belong to Pine. No case closure.'),
}

class Adapter:
    def __init__(self, http_app, config, storage):
        self.http_app, self.config, self.storage = http_app, config, storage

    async def invoke(self, name, arguments):
        started = time.monotonic()
        entry = CATALOG.get(name)
        event = {**PROVENANCE, 'timestamp': now(), 'stage': 'MCP_ADAPTER', 'operation': name if entry else 'UNKNOWN_TOOL',
                 'http_method': entry[1] if entry else None, 'documented_endpoint_path': entry[2] if entry else None,
                 'scenario': self.config.scenario, 'request_metadata': {}}
        result = {'success': False, 'simulation': PROVENANCE}
        try:
            if not entry: raise ValueError()
            model, method, path, _ = entry
            args = model.model_validate_json(json.dumps(arguments, allow_nan=False))
            scenario = args.simulation_scenario or self.config.scenario
            event['scenario'] = scenario
            headers = {'Authorization': 'Token ' + self.config.mock_token, 'X-Mock-Scenario': scenario,
                       'Accept': 'application/json'}
            if name == 'create_part_shipment':
                payload = {'shipments': [args.shipment.model_dump(exclude_none=True)],
                           'pickup_location': args.pickup_location.model_dump()}
                kwargs = {'data': {'format': 'json', 'data': json.dumps(payload, ensure_ascii=False)}}
                event['order_id_sha256'] = digest(args.shipment.order)
                event['request_metadata'] = {'shipment_count': 1, 'payment_mode': args.shipment.payment_mode}
            else:
                headers['Content-Type'] = 'application/json'
                kwargs = {'params': args.model_dump(exclude={'simulation_scenario'}, exclude_none=True)}
                if name == 'track_part_shipment': event['waybill'] = args.waybill
                else: event['request_metadata'] = {'single_pincode': True}
            # There is deliberately no configurable live base URL or socket transport.
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.http_app),
                    base_url='http://delhivery-mock.internal', trust_env=False, timeout=5) as client:
                response = await client.request(method, path, headers=headers, **kwargs)
            event['http_status'] = response.status_code
            try: body = response.json()
            except ValueError:
                result['error'] = {'code': 'MALFORMED_RESPONSE', 'retryable': False}
            else:
                if response.status_code != 200:
                    error = body.get('error') if isinstance(body, dict) else None
                    if not isinstance(error, dict) or not isinstance(error.get('code'), str):
                        result['error'] = {'code': 'MALFORMED_RESPONSE', 'retryable': False}
                    else:
                        result['error'] = {'code': error['code'], 'retryable': response.status_code in (503, 504)}
                elif name == 'check_delivery_serviceability':
                    if not isinstance(body, list) or len(body) > 1 or any(
                            not isinstance(item, dict) or item.get('remark') not in ('', 'Embargo') for item in body):
                        result['error'] = {'code': 'MALFORMED_RESPONSE', 'retryable': False}
                    else:
                        result.update(success=True, delhivery_compatible_data=body,
                                      logistics={'serviceable': bool(body) and body[0]['remark'] == ''})
                elif not isinstance(body, dict) or body.get('simulation') != PROVENANCE or not isinstance(body.get('logistics'), dict):
                    result['error'] = {'code': 'MALFORMED_RESPONSE', 'retryable': False}
                else:
                    result.update(success=True, logistics=body['logistics'])
        except (ValidationError, ValueError, TypeError):
            result['error'] = {'code': 'INVALID_ARGUMENT', 'retryable': False}
        except httpx.TimeoutException:
            result['error'] = {'code': 'TIMEOUT', 'retryable': True}
        except httpx.HTTPError:
            result['error'] = {'code': 'MOCK_UNAVAILABLE', 'retryable': True}
        event.update(success=result['success'], result=result.get('error', {}).get('code', 'LOGISTICS_FACTS'),
                     latency_ms=round((time.monotonic()-started)*1000, 2))
        if result.get('logistics', {}).get('waybill'): event['waybill'] = result['logistics']['waybill']
        self.storage.record(event)
        result['evidence'] = event
        return result
