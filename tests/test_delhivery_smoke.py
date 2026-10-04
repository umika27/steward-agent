"""Smoke receipts assert actual mock results, including expected failures."""
import asyncio
import unittest

from integrations.delhivery_mock.smoke import exercise
from tests import test_delhivery_mock

class TestDelhiverySmoke(unittest.TestCase):
    def setUp(self):
        fixture = test_delhivery_mock.TestDelhiveryMock(methodName='test_serviceable_blank_remark')
        fixture.setUp(); self.addCleanup(fixture.doCleanups)
        self.adapter = fixture.app.state.adapter

    def test_mock_receipts_prove_expected_successes_and_failures(self):
        result = asyncio.run(exercise(self.adapter))
        self.assertTrue(result['success']); self.assertEqual(result['live_provider_calls'],0)
        self.assertEqual(result['call_count'],18)
        self.assertTrue(any(not r['actual_result']['success'] for r in result['receipts']))

    def test_failed_actual_creation_cannot_be_marked_pass(self):
        class Failed:
            async def invoke(self, name, args): return {'success':False,'error':{'code':'TIMEOUT'}}
        result = asyncio.run(exercise(Failed()))
        self.assertFalse(result['success'])
        self.assertTrue(any(r.get('reason') for r in result['receipts']))
