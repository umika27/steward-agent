"""Paid-runner safeguards tested with mocked adapter only; no paid network calls."""
import base64
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from integrations.gnani_voice.smoke import run
from tests.test_gnani_voice import wav

class TestSmokeSafeguards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='gnani-smoke-unit-'); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.audio = self.root / 'speech.wav'; self.audio.write_bytes(wav(16000))
        self.output = self.root / 'output'

    def test_missing_key_skips_both_without_adapter_call(self):
        with patch.dict(os.environ, {}, clear=True), patch('integrations.gnani_voice.smoke.GnaniVoice') as adapter:
            result = run(self.audio, self.output)
        adapter.assert_not_called(); self.assertEqual(result['paid_http_requests_attempted'], 0)
        self.assertEqual((result['stt']['status'], result['tts']['status']), ('SKIPPED', 'SKIPPED'))

    def test_one_call_each_and_playable_output_saved_on_success(self):
        body = wav()
        with patch.dict(os.environ, {'GNANI_API_KEY': 'unit-placeholder'}, clear=True), patch('integrations.gnani_voice.smoke.GnaniVoice') as adapter:
            adapter.return_value.invoke.side_effect = [{'success': True, 'transcript': 'Actual mocked test transcript'},
                {'success': True, 'audio_base64': base64.b64encode(body).decode(), 'audio_bytes': len(body)}]
            result = run(self.audio, self.output)
        self.assertEqual(adapter.return_value.invoke.call_count, 2)
        self.assertEqual(result['paid_http_requests_attempted'], 2)
        self.assertEqual((self.output / 'reply.wav').read_bytes(), body)
        self.assertNotIn('audio_base64', json.dumps(result))

    def test_access_failure_skips_second_paid_call(self):
        with patch.dict(os.environ, {'GNANI_API_KEY': 'unit-placeholder'}, clear=True), patch('integrations.gnani_voice.smoke.GnaniVoice') as adapter:
            adapter.return_value.invoke.return_value = {'success': False, 'error': {'code': 'AUTH_FAILED'}}
            result = run(self.audio, self.output)
        self.assertEqual(adapter.return_value.invoke.call_count, 1)
        self.assertEqual(result['tts']['status'], 'SKIPPED')

    def test_previous_receipt_cannot_be_overwritten(self):
        self.output.mkdir(); target = self.output / 'smoke-evidence.json'; target.write_text('original')
        with patch('integrations.gnani_voice.smoke.GnaniVoice') as adapter, self.assertRaises(ValueError):
            run(self.audio, self.output)
        adapter.assert_not_called(); self.assertEqual(target.read_text(), 'original')

    def test_provider_candidate_saved_before_validation_without_claiming_pass(self):
        body = wav()
        with patch.dict(os.environ, {'GNANI_API_KEY': 'unit-placeholder'}, clear=True), patch('integrations.gnani_voice.smoke.GnaniVoice') as adapter:
            def create(*args, **kwargs):
                kwargs['response_observer']('TTS', body, 'audio/wav')
                return adapter.return_value
            adapter.side_effect = create
            adapter.return_value.invoke.return_value = {'success': False, 'error': {'code': 'MALFORMED_RESPONSE'}}
            result = run(self.audio, self.output)
        self.assertEqual((self.output / 'provider-response.wav').read_bytes(), body)
        self.assertEqual(result['tts']['status'], 'FAIL'); self.assertFalse((self.output / 'reply.wav').exists())
