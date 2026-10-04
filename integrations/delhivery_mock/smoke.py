"""Offline end-to-end receipts through the MCP adapter and exact mock HTTP routes."""
import argparse
import asyncio
import json
from pathlib import Path
import tempfile
import secrets

from .config import Config
from .http import PROVENANCE
from .server import create_app
from .storage import now

async def exercise(adapter):
    shipment = {'name':'Synthetic Household', 'order':'MOCK-PUMP-001', 'phone':'0000000000',
                'add':'1 Fictional Test Lane', 'pin':560001, 'payment_mode':'Prepaid',
                'products_desc':'Washing machine drain pump', 'shipping_mode':'Surface'}
    creation = {'shipment':shipment, 'pickup_location':{'name':'Steward Mock Warehouse'}}
    receipts = []

    async def call(tool, arguments, expected_success=True, expected_code=None, expected_status=None, expected_serviceable=None):
        result = await adapter.invoke(tool, arguments)
        valid = result.get('success') is expected_success
        if expected_code: valid &= result.get('error',{}).get('code') == expected_code
        if expected_status: valid &= result.get('logistics',{}).get('status') == expected_status
        if expected_serviceable is not None: valid &= result.get('logistics',{}).get('serviceable') is expected_serviceable
        receipts.append({'tool':tool, 'scenario':arguments.get('simulation_scenario','NORMAL_SERVICEABLE'),
                         'assertion_pass':bool(valid), 'actual_result':result})
        return result

    await call('check_delivery_serviceability',{'filter_codes':'560001'},expected_serviceable=True)
    result = await call('create_part_shipment',creation,expected_status='SHIPMENT_CREATED')
    waybill = result.get('logistics',{}).get('waybill')
    if waybill:
        replay = await call('create_part_shipment',creation,expected_status='SHIPMENT_CREATED')
        receipts[-1]['assertion_pass'] &= replay.get('logistics',{}).get('idempotent_replay') is True
        for scenario in ('IN_TRANSIT','DELIVERED','DELIVERY_EXCEPTION'):
            await call('track_part_shipment',{'waybill':waybill,'simulation_scenario':scenario},expected_status=scenario)
    else:
        receipts.append({'assertion_pass':False,'reason':'Creation failed; dependent tracking not attempted'})
    for scenario in ('EMBARGO','NSZ'):
        await call('check_delivery_serviceability',{'filter_codes':'560001','simulation_scenario':scenario},expected_serviceable=False)
        await call('create_part_shipment',{**creation,'simulation_scenario':scenario},False,'PINCODE_NOT_SERVICEABLE')
    await call('create_part_shipment',{**creation,'simulation_scenario':'NO_RIDER_OR_CAPACITY'},False,'NO_RIDER_OR_CAPACITY')
    for scenario in ('TIMEOUT','MALFORMED_RESPONSE'):
        await call('check_delivery_serviceability',{'filter_codes':'560001','simulation_scenario':scenario},False,scenario)
        await call('create_part_shipment',{**creation,'simulation_scenario':scenario},False,scenario)
        if waybill: await call('track_part_shipment',{'waybill':waybill,'simulation_scenario':scenario},False,scenario)
    await call('create_part_shipment',{**creation,'shipment':{**shipment,'order':'MOCK-PUMP-002'},
               'simulation_scenario':'SHIPMENT_CREATED'},expected_status='SHIPMENT_CREATED')
    return {**PROVENANCE, 'timestamp':now(), 'live_provider_calls':0,
            'validation_scope':'In-process adapter calls exact mock HTTP routes; remote transport separately tested',
            'success':all(r['assertion_pass'] for r in receipts), 'call_count':sum('tool' in r for r in receipts), 'receipts':receipts}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists(): parser.error('Refusing to overwrite existing evidence')
    with tempfile.TemporaryDirectory(prefix='delhivery-offline-smoke-') as directory:
        config = Config(mock_token=secrets.token_urlsafe(32), mcp_token=secrets.token_urlsafe(32),
                        database=Path(directory)/'shipments.sqlite3')
        app = create_app(config)
        result = asyncio.run(exercise(app.state.adapter))
        with app.state.storage.connect() as db:
            result['http_evidence'] = [json.loads(row[0]) for row in db.execute('SELECT payload FROM evidence')
                                       if json.loads(row[0]).get('stage') is None]
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as output: json.dump(result,output,indent=2); output.write('\n')
    print(json.dumps({'success':result['success'],'call_count':result['call_count'],'live_provider_calls':0}))
    if not result['success']: raise SystemExit(1)

if __name__ == '__main__': main()
