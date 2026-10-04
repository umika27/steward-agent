"""Mock-only Gnani contract, failure, security and architecture tests. No paid calls."""
import ast
import base64
import io
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

import httpx
from integrations.gnani_voice.adapter import GnaniVoice, STT_URL, TTS_URL, wav_metadata
from integrations.gnani_voice.config import Config
from integrations.gnani_voice.evidence import EvidenceWriter
from integrations.gnani_voice.schemas import MAX_AUDIO_BYTES

KEY = 'unit-test-placeholder-not-a-real-credential'

def wav(rate=48000, seconds=0.05):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as handle:
        handle.setnchannels(1); handle.setsampwidth(2); handle.setframerate(rate)
        handle.writeframes(b'\x00\x00' * int(rate * seconds))
    return stream.getvalue()

AUDIO = {'audio_base64': base64.b64encode(wav(16000)).decode(), 'filename': 'voice.wav'}
TEXT = {'text': 'Your washing machine repair case is still active.'}
STT_OK = {'success': True, 'request_id': 'gnani-request-123', 'timestamp': '2026-10-04T02:00:00Z',
          'transcript': 'My washing machine is not draining.'}

class TestGnaniVoice(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'GNANI_API_KEY': KEY}, clear=True); self.env.start(); self.addCleanup(self.env.stop)
        self.requests = []

    def call(self, direction, response=None, arguments=None, exception=None, check=None, evidence=None):
        def handler(request):
            self.requests.append(request)
            if check: check(request)
            if exception: raise exception
            return response
        client = httpx.Client(transport=httpx.MockTransport(handler), timeout=45, trust_env=False)
        self.addCleanup(client.close)
        return GnaniVoice(client, evidence).invoke(direction, arguments if arguments is not None else AUDIO if direction == 'STT' else TEXT)

    def test_stt_success_preserves_actual_fields_and_provenance(self):
        result = self.call('STT', httpx.Response(200, json=STT_OK))
        self.assertTrue(result['success']); self.assertEqual(result['transcript'], STT_OK['transcript'])
        self.assertEqual(result['request_id'], STT_OK['request_id']); self.assertEqual(result['timestamp'], STT_OK['timestamp'])
        self.assertEqual(result['source'], 'GNANI_STT'); self.assertEqual(result['language'], 'en-IN')
        self.assertEqual(result['evidence']['http_status'], 200)
        self.assertGreaterEqual(result['evidence']['latency_ms'], 0)

    def test_indian_english_multipart_configuration(self):
        def check(request):
            self.assertEqual(str(request.url), STT_URL); self.assertEqual(request.method, 'POST')
            self.assertEqual(request.headers['X-API-Key-ID'], KEY)
            content_type = request.headers['content-type']; self.assertIn('multipart/form-data; boundary=', content_type)
            body = request.read()
            for value in (b'name="audio_file"', b'filename="voice.wav"', b'name="language_code"\r\n\r\nen-IN',
                          b'name="format"\r\n\r\ntranscribe', b'name="itn_native_numerals"\r\n\r\nfalse'):
                self.assertIn(value, body)
            self.assertNotIn(b'substitution', body); self.assertNotIn(b'boost', body)
        self.assertTrue(self.call('STT', httpx.Response(200, json=STT_OK), check=check)['success'])

    def test_stt_hindi_language_is_passed_without_decisions(self):
        result = self.call('STT', httpx.Response(200, json={**STT_OK, 'transcript': 'Machine drain nahi ho raha'}),
                           {**AUDIO, 'language_code': 'hi-IN'})
        self.assertEqual(result['language'], 'hi-IN')
        self.assertIn(b'hi-IN', self.requests[0].read())

    def test_stt_empty_transcript(self):
        result = self.call('STT', httpx.Response(200, json={**STT_OK, 'transcript': ' '}))
        self.assertEqual(result['error']['code'], 'EMPTY_TRANSCRIPT'); self.assertNotIn('transcript', result)

    def test_stt_malformed_json(self):
        self.assertEqual(self.call('STT', httpx.Response(200, content=b'not-json'))['error']['code'], 'MALFORMED_RESPONSE')

    def test_stt_missing_request_metadata(self):
        self.assertEqual(self.call('STT', httpx.Response(200, json={'success': True, 'transcript': 'Speech'}))['error']['code'], 'MALFORMED_RESPONSE')

    def test_live_observed_missing_provider_timestamp_preserved_as_null(self):
        payload = {k:v for k,v in STT_OK.items() if k != 'timestamp'}
        result = self.call('STT', httpx.Response(200, json=payload))
        self.assertTrue(result['success']); self.assertIsNone(result['timestamp'])
        self.assertEqual(result['provider_timestamp_status'], 'not_supplied')
        self.assertEqual(result['transcript'], payload['transcript'])

    def test_invalid_supplied_timestamp_is_rejected(self):
        result = self.call('STT', httpx.Response(200, json={**STT_OK, 'timestamp': {'invented': True}}))
        self.assertEqual(result['error']['code'], 'MALFORMED_RESPONSE')

    def test_tts_reflected_header_secret_not_returned(self):
        result = self.call('TTS', httpx.Response(200, content=wav(), headers={'content-type':'audio/wav','x-request-id':KEY}))
        self.assertTrue(result['success']); self.assertIsNone(result['request_id'])
        self.assertNotIn(KEY, json.dumps(result))

    def test_stt_non_object_json(self):
        self.assertEqual(self.call('STT', httpx.Response(200, json=[]))['error']['code'], 'MALFORMED_RESPONSE')

    def test_stt_provider_success_false(self):
        self.assertEqual(self.call('STT', httpx.Response(200, json={'success': False, 'error': KEY}))['error']['code'], 'PROVIDER_REJECTED')

    def test_stt_timeout(self):
        self.assertEqual(self.call('STT', exception=httpx.ReadTimeout(KEY))['error']['code'], 'TIMEOUT')
        self.assertEqual(len(self.requests), 1)

    def test_stt_network_error(self):
        self.assertEqual(self.call('STT', exception=httpx.ConnectError(KEY))['error']['code'], 'NETWORK_ERROR')

    def test_tts_success_wav_and_exact_request(self):
        def check(request):
            self.assertEqual(str(request.url), TTS_URL); self.assertEqual(request.headers['X-API-Key-ID'], KEY)
            self.assertEqual(json.loads(request.read()), {**TEXT, 'voice': 'Kaveri', 'model': 'timbre-v2.5',
                'language': 'en-IN', 'speed': 1.0, 'audio_config': {'sample_rate': 48000,
                    'num_channels': 1, 'sample_width': 2, 'encoding': 'linear_pcm', 'container': 'wav'}})
        body = wav(); result = self.call('TTS', httpx.Response(200, content=body, headers={'content-type': 'audio/wav', 'x-request-id': 'tts-123'}), check=check)
        self.assertTrue(result['success']); self.assertEqual(base64.b64decode(result['audio_base64']), body)
        self.assertEqual(result['content_type'], 'audio/wav'); self.assertEqual(result['source'], 'GNANI_TTS')
        self.assertEqual((result['voice'], result['model'], result['sample_rate']), ('Kaveri', 'timbre-v2.5', 48000))

    def test_tts_empty_audio(self):
        self.assertEqual(self.call('TTS', httpx.Response(200, content=b'', headers={'content-type': 'audio/wav'}))['error']['code'], 'EMPTY_AUDIO')

    def test_tts_json_instead_of_binary(self):
        self.assertEqual(self.call('TTS', httpx.Response(200, json={'success': False}))['error']['code'], 'MALFORMED_RESPONSE')

    def test_tts_invalid_wav(self):
        self.assertEqual(self.call('TTS', httpx.Response(200, content=b'RIFFnot-wave', headers={'content-type': 'audio/wav'}))['error']['code'], 'MALFORMED_RESPONSE')

    def test_tts_truncated_pcm(self):
        self.assertEqual(self.call('TTS', httpx.Response(200, content=wav()[:-20], headers={'content-type': 'audio/wav'}))['error']['code'], 'MALFORMED_RESPONSE')

    def test_tts_actual_valid_sample_rate_is_reported_without_fabrication(self):
        result = self.call('TTS', httpx.Response(200, content=wav(16000), headers={'content-type': 'audio/wav'}))
        self.assertTrue(result['success']); self.assertEqual(result['sample_rate'], 16000)
        self.assertFalse(result['matches_requested_audio_config'])

    def test_tts_octet_stream_validated_as_wav(self):
        self.assertTrue(self.call('TTS', httpx.Response(200, content=wav(), headers={'content-type': 'application/octet-stream'}))['success'])

    def test_tts_timeout(self):
        self.assertEqual(self.call('TTS', exception=httpx.ReadTimeout(KEY))['error']['code'], 'TIMEOUT')
        self.assertEqual(len(self.requests), 1)

    def test_tts_network_error(self):
        self.assertEqual(self.call('TTS', exception=httpx.ConnectError(KEY))['error']['code'], 'NETWORK_ERROR')

    def test_missing_credential_is_explicit_and_no_http_call(self):
        with patch.dict(os.environ, {}, clear=True):
            for direction in ('STT', 'TTS'):
                result = self.call(direction)
                self.assertEqual(result['error']['code'], 'MISSING_CREDENTIALS')
        self.assertEqual(len(self.requests), 0)

    def test_secret_not_in_errors_or_logs(self):
        stream = io.StringIO(); handler = logging.StreamHandler(stream); root = logging.getLogger(); root.addHandler(handler)
        try:
            for direction in ('STT', 'TTS'):
                result = self.call(direction, httpx.Response(403, content=KEY.encode(), headers={'x-request-id': KEY}))
                self.assertNotIn(KEY, json.dumps(result))
                result = self.call(direction, exception=httpx.ReadTimeout(KEY)); self.assertNotIn(KEY, json.dumps(result))
            self.assertNotIn(KEY, stream.getvalue())
        finally: root.removeHandler(handler)

    def test_reflected_secret_in_success_payload_rejected(self):
        result = self.call('STT', httpx.Response(200, json={**STT_OK, 'transcript': KEY}))
        self.assertFalse(result['success']); self.assertNotIn(KEY, json.dumps(result))

    def test_credential_like_text_is_redacted_in_persisted_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'evidence.jsonl'
            result = self.call('TTS', httpx.Response(200, content=wav(), headers={'content-type': 'audio/wav'}),
                {'text': 'The OTP is 123456 and password is private'}, evidence=EvidenceWriter(target))
            self.assertTrue(result['success']); self.assertNotIn('123456', target.read_text())
            self.assertNotIn('private', target.read_text()); self.assertNotIn(KEY, target.read_text())

    def test_wav_duration_limit_before_paid_call(self):
        result = self.call('STT', arguments={**AUDIO, 'audio_base64': base64.b64encode(wav(16000, 31)).decode()})
        self.assertEqual(result['error']['code'], 'INVALID_AUDIO'); self.assertEqual(len(self.requests), 0)

    def test_invalid_base64_and_filename_before_paid_call(self):
        for args in ({**AUDIO, 'audio_base64': '!bad'}, {**AUDIO, 'filename': '../voice.wav'},
                     {**AUDIO, 'filename': 'clip.exe'}, {**AUDIO, 'state': 'CLOSED'}):
            self.assertFalse(self.call('STT', arguments=args)['success'])
        self.assertEqual(len(self.requests), 0)

    def test_tts_empty_text_extra_business_fields_rejected(self):
        for args in ({'text': ''}, {**TEXT, 'approval': True}, {**TEXT, 'model': 'arbitrary-model'}):
            self.assertEqual(self.call('TTS', arguments=args)['error']['code'], 'INVALID_ARGUMENT')
        self.assertEqual(len(self.requests), 0)

    def test_evidence_io_failure_preserves_actual_conversion_receipt(self):
        writer = EvidenceWriter(Path('/tmp/gnani-test-evidence.jsonl'))
        with patch.object(writer, 'record', side_effect=OSError('disk-full')):
            result = self.call('STT', httpx.Response(200, json=STT_OK), evidence=writer)
        self.assertTrue(result['success']); self.assertEqual(result['evidence']['journal_status'], 'unavailable')

    def test_no_redirect_or_retry(self):
        result = self.call('STT', httpx.Response(302, headers={'Location': 'https://untrusted.example'}))
        self.assertFalse(result['success']); self.assertEqual(len(self.requests), 1)

    def test_supported_audio_extensions(self):
        for ext in ('wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a'):
            result = self.call('STT', httpx.Response(200, json=STT_OK), {**AUDIO, 'filename': 'voice.' + ext})
            self.assertTrue(result['success'], ext)

class TestGnaniArchitecture(unittest.TestCase):
    def test_no_steward_decisions_or_legacy_imports(self):
        root = Path(__file__).resolve().parents[1] / 'integrations/gnani_voice'
        forbidden = {'CaseManager', 'AuthorityEngine', 'DemoApplication', 'repair_policy', 'recovery', 'verifier', 'transition_state'}
        for path in root.glob('*.py'):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    names = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or '']
                    for name in names: self.assertNotIn(name.split('.')[0], {'steward', 'rails', 'importlib'}, str(path))
                if isinstance(node, ast.Name): self.assertNotIn(node.id, forbidden | {'eval', 'exec', '__import__'}, str(path))
                if isinstance(node, ast.Attribute): self.assertNotIn(node.attr, forbidden, str(path))

    def test_fresh_process_does_not_load_steward(self):
        code = "from integrations.gnani_voice.server import create_app; import sys; create_app(); assert not any(n.split('.')[0] in ('steward','rails') for n in sys.modules)"
        env = {k:v for k,v in os.environ.items() if not k.startswith(('GNANI_', 'STEWARD_MCP_')) and k not in ('PORT', 'RENDER_EXTERNAL_HOSTNAME')}
        result = subprocess.run([sys.executable, '-B', '-c', code], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_two_gnani_tools_and_five_steward_tools_are_separate(self):
        from integrations.gnani_voice.server import CATALOG as voice
        from integrations.steward_mcp.server import CATALOG as steward
        self.assertEqual(set(voice), {'transcribe_voice_input', 'synthesize_voice_reply'})
        self.assertEqual(len(steward), 5); self.assertTrue(set(voice).isdisjoint(steward))

    def test_public_binding_fails_closed_and_tokens_hidden(self):
        with self.assertRaises(ValueError): Config(host='0.0.0.0')
        with self.assertRaises(ValueError): Config(token='short')
        config = Config(host='0.0.0.0', token='z' * 40)
        self.assertNotIn('z' * 40, repr(config))

    def test_environment_config_and_protected_evidence_location(self):
        with patch.dict(os.environ, {'PORT': '10000', 'GNANI_VOICE_HOST': '0.0.0.0', 'GNANI_MCP_AUTH_TOKEN': 'z' * 40,
             'GNANI_EVIDENCE_PATH': '/tmp/gnani-voice/evidence.jsonl', 'RENDER_EXTERNAL_HOSTNAME': 'gnani-voice.onrender.com'}, clear=True):
            config = Config.from_env()
            self.assertEqual((config.port, config.public_host), (10000, 'gnani-voice.onrender.com'))
        with self.assertRaises(ValueError): Config(evidence_path=Path(__file__).parent / 'evidence.jsonl')

# Each required status/direction is its own reported test, not a hidden subcase.
for direction in ('STT', 'TTS'):
    for status in (400, 403, 429, 500, 503):
        def status_test(self, direction=direction, status=status):
            result = self.call(direction, httpx.Response(status, content=KEY.encode()))
            self.assertFalse(result['success']); self.assertEqual(result['evidence']['http_status'], status)
            self.assertNotIn(KEY, json.dumps(result)); self.assertEqual(len(self.requests), 1)
            self.assertNotIn('transcript', result); self.assertNotIn('audio_base64', result)
        setattr(TestGnaniVoice, f'test_{direction.lower()}_http_{status}', status_test)
