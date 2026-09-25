import unittest

from rails import MockLogisticsRail, MockPaymentsRail, MockVoiceRail


class TestRails(unittest.TestCase):
    def test_all_rails_are_explicit_local_mocks(self):
        for rail in (MockVoiceRail(), MockPaymentsRail(), MockLogisticsRail()):
            self.assertTrue(rail.is_mock)

    def test_mock_payment_authority_and_idempotency(self):
        rail = MockPaymentsRail()
        self.assertFalse(rail.request_payment("C1", 3800, "provider").success)
        self.assertFalse(rail.get_payment_status("MOCK-PAY-C1").success)
        first = rail.request_payment("C1", 900, "provider")
        second = rail.request_payment("C1", 900, "provider")
        self.assertEqual(first, second)
        first.payload["amount_inr"] = 0
        self.assertEqual(rail.get_payment_status("MOCK-PAY-C1").payload["amount_inr"], 900)
        with self.assertRaises(ValueError):
            rail.request_payment("C1", 1000, "provider")

    def test_mock_voice_preserves_unresolved_questions(self):
        rail = MockVoiceRail()
        payload = {"unresolved_questions": ["Prior repair coverage?"]}
        result = rail.receive_call_result(payload)
        self.assertEqual(result.payload, payload)
        self.assertTrue(result.is_mock)
        self.assertIn("[MOCK]", result.summary)
        result.payload["unresolved_questions"].clear()
        self.assertEqual(len(payload["unresolved_questions"]), 1)

    def test_mock_logistics_reports_unknown_and_delivered(self):
        rail = MockLogisticsRail()
        self.assertFalse(rail.get_delivery_status("unknown").success)
        self.assertFalse(rail.validate_address("", "560001").success)
        self.assertTrue(rail.validate_address("Local address", "560001").success)
        self.assertEqual(rail.track_part("MOCK-PART-1", "pump").payload["status"], "IN_TRANSIT")
        rail.mark_part_delivered("MOCK-PART-1")
        self.assertEqual(rail.get_delivery_status("MOCK-PART-1").payload["status"], "DELIVERED")
