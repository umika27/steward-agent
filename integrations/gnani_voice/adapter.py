"""Fixed Gnani REST contracts, no retries, no reasoning, no fallback speech/audio."""
import base64
import binascii
import io
import json
import os
import time
import wave

import httpx
from pydantic import ValidationError

from .evidence import EvidenceWriter, timestamps
from .schemas import MAX_AUDIO_BYTES, TranscribeInput, SynthesizeInput

STT_URL = 'https://api.vachana.ai/stt/v3'
TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference'
MAX_TTS_BYTES = 8 * 1024 * 1024
MIMES = {'.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
         '.aac': 'audio/aac', '.m4a': 'audio/mp4'}
HTTP_ERRORS = {400: ('INVALID_REQUEST', False), 403: ('AUTH_FAILED', False),
               429: ('RATE_LIMITED', True), 500: ('UPSTREAM_ERROR', True), 503: ('UNAVAILABLE', True)}
MESSAGES = {'INVALID_REQUEST': 'Gnani rejected the voice request.', 'AUTH_FAILED': 'Gnani authentication or access was rejected.',
            'RATE_LIMITED': 'Gnani rate limit reached.', 'UPSTREAM_ERROR': 'Gnani returned a server error.',
            'UNAVAILABLE': 'Gnani is unavailable.', 'HTTP_ERROR': 'Gnani returned an unsuccessful HTTP status.',
            'TIMEOUT': 'Gnani request timed out; no conversion success is asserted.',
            'NETWORK_ERROR': 'Gnani could not be reached.', 'MALFORMED_RESPONSE': 'Gnani returned an invalid response.',
            'EMPTY_TRANSCRIPT': 'Gnani returned no speech transcript.', 'EMPTY_AUDIO': 'Gnani returned no audio.',
            'INVALID_AUDIO': 'Audio is unsupported, invalid, too large or exceeds the WAV duration limit.',
            'INVALID_ARGUMENT': 'Arguments do not match the strict voice schema.',
            'MISSING_CREDENTIALS': 'GNANI_API_KEY is not configured.',
            'PROVIDER_REJECTED': 'Gnani did not report successful transcription.',
            'INTERNAL_ERROR': 'Voice conversion failed without an asserted result.'}

class VoiceFailure(Exception):
    def __init__(self, code, retryable=False):
        self.code, self.retryable = code, retryable
        super().__init__(MESSAGES[code])


def wav_metadata(data, *, output=False):
    try:
        with wave.open(io.BytesIO(data), 'rb') as audio:
            rate, channels, width, frames = audio.getframerate(), audio.getnchannels(), audio.getsampwidth(), audio.getnframes()
            if not rate or not frames or audio.getcomptype() != 'NONE': raise ValueError()
            pcm = audio.readframes(frames)
            if len(pcm) != frames * channels * width: raise ValueError()
            if output and (rate not in (8000, 16000, 22050, 24000, 44100, 48000) or channels not in (1, 2) or width not in (1, 2, 3, 4)): raise ValueError()
            return {'duration_seconds': round(frames / rate, 3), 'sample_rate': rate, 'num_channels': channels, 'sample_width': width}
    except (wave.Error, EOFError, ValueError, OverflowError):
        raise VoiceFailure('INVALID_AUDIO' if not output else 'MALFORMED_RESPONSE') from None


def decode_audio(request):
    extension = '.' + request.filename.rsplit('.', 1)[-1].lower()
    if extension not in MIMES: raise VoiceFailure('INVALID_AUDIO')
    try: data = base64.b64decode(request.audio_base64, validate=True)
    except (binascii.Error, ValueError): raise VoiceFailure('INVALID_AUDIO') from None
    if not data or len(data) > MAX_AUDIO_BYTES: raise VoiceFailure('INVALID_AUDIO')
    metadata = {'filename': request.filename, 'content_type': MIMES[extension], 'audio_bytes': len(data), 'duration_seconds': None}
    if extension == '.wav':
        metadata.update(wav_metadata(data))
        if metadata['duration_seconds'] > 30: raise VoiceFailure('INVALID_AUDIO')
    return data, metadata


class GnaniVoice:
    def __init__(self, client=None, evidence=None, response_observer=None):
        self.client = client
        self.evidence = evidence or EvidenceWriter()
        self.response_observer = response_observer

    def invoke(self, direction, arguments):
        started = time.monotonic()
        event = {**timestamps(), 'provider': 'GNANI', 'direction': direction,
                 'source': 'GNANI_' + direction, 'success': False, 'http_status': None,
                 'request_id': None, 'language': None, 'input': {}, 'output': {}}
        result = None
        try:
            if direction not in ('STT', 'TTS'): raise VoiceFailure('INVALID_ARGUMENT')
            model = TranscribeInput if direction == 'STT' else SynthesizeInput
            request = model.model_validate_json(json.dumps(arguments, allow_nan=False))
            if direction == 'STT':
                audio, metadata = decode_audio(request)
                event.update(language=request.language_code, input=metadata)
                kwargs = {'data': {'language_code': request.language_code, 'format': 'transcribe', 'itn_native_numerals': 'false'},
                          'files': {'audio_file': (request.filename, audio, metadata['content_type'])}}
                url, maximum = STT_URL, 1024 * 1024
            else:
                event.update(language=request.language, input={'text': request.text, 'voice': request.voice, 'model': request.model})
                kwargs = {'json': {**request.model_dump(), 'speed': 1.0, 'audio_config': {
                    'sample_rate': 48000, 'num_channels': 1, 'sample_width': 2, 'encoding': 'linear_pcm', 'container': 'wav'}}}
                url, maximum = TTS_URL, MAX_TTS_BYTES
            key = os.environ.get('GNANI_API_KEY')
            if not key: raise VoiceFailure('MISSING_CREDENTIALS')
            if '\r' in key or '\n' in key or not key.isascii(): raise VoiceFailure('MISSING_CREDENTIALS')
            owned = self.client is None
            client = self.client or httpx.Client(timeout=45, follow_redirects=False, trust_env=False)
            try:
                with client.stream('POST', url, headers={'X-API-Key-ID': key}, **kwargs) as response:
                    event['http_status'] = response.status_code
                    event['response_content_type'] = response.headers.get('content-type', '').split(';')[0]
                    event['request_id'] = response.headers.get('x-request-id')
                    if event['request_id'] and any(secret and secret in event['request_id'] for secret in
                            (key, os.environ.get('GNANI_MCP_AUTH_TOKEN'))):
                        event['request_id'] = None
                    if response.status_code != 200:
                        code, retryable = HTTP_ERRORS.get(response.status_code, ('HTTP_ERROR', False))
                        # Safe diagnostics: only known error categories, never raw bodies/messages.
                        diagnostic = bytearray()
                        for chunk in response.iter_bytes():
                            diagnostic.extend(chunk[:max(0, 4096 - len(diagnostic))])
                            if len(diagnostic) >= 4096: break
                        try:
                            problem = json.loads(diagnostic)
                            kind = problem.get('error', {}).get('type') if isinstance(problem, dict) and isinstance(problem.get('error'), dict) else None
                            if kind in ('INVALID_REQUEST_ERROR', 'FORBIDDEN', 'RATE_LIMIT_ERROR', 'API_ERROR', 'SERVICE_UNAVAILABLE'):
                                event['provider_error_type'] = kind
                        except (ValueError, UnicodeDecodeError): pass
                        retry_after = response.headers.get('retry-after', '')
                        if retry_after.isdigit(): event['retry_after_seconds'] = int(retry_after)
                        raise VoiceFailure(code, retryable)
                    chunks, size = [], 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > maximum: raise VoiceFailure('MALFORMED_RESPONSE')
                        chunks.append(chunk)
                    body = b''.join(chunks)
                    content_type = response.headers.get('content-type', '').split(';')[0].lower().strip()
            finally:
                if owned: client.close()
            if self.response_observer:
                try: self.response_observer(direction, body, content_type)
                except Exception: event['diagnostic_artifact_status'] = 'unavailable'
            if direction == 'STT':
                try: payload = json.loads(body)
                except (ValueError, UnicodeDecodeError): raise VoiceFailure('MALFORMED_RESPONSE') from None
                if not isinstance(payload, dict): raise VoiceFailure('MALFORMED_RESPONSE')
                event['response_fields'] = {field: type(payload[field]).__name__ if field in payload else 'missing'
                                            for field in ('success', 'request_id', 'timestamp', 'transcript')}
                if isinstance(payload.get('request_id'), str) and key not in payload['request_id']:
                    event['request_id'] = payload['request_id']
                if payload.get('success') is not True: raise VoiceFailure('PROVIDER_REJECTED')
                if not isinstance(payload.get('transcript'), str) or not payload['transcript'].strip():
                    raise VoiceFailure('EMPTY_TRANSCRIPT')
                if not isinstance(payload.get('request_id'), str) or not payload['request_id'].strip():
                    raise VoiceFailure('MALFORMED_RESPONSE')
                timestamp = payload.get('timestamp')
                if timestamp is not None and (not isinstance(timestamp, str) or not timestamp.strip()):
                    raise VoiceFailure('MALFORMED_RESPONSE')
                # Reflected credentials are not valid provider evidence and are never returned.
                if any(isinstance(payload.get(k), str) and key in payload[k] for k in ('transcript', 'request_id', 'timestamp')):
                    raise VoiceFailure('MALFORMED_RESPONSE')
                event['request_id'] = payload['request_id']
                event['output'] = {'transcript': payload['transcript'], 'provider_timestamp': timestamp,
                                   'provider_timestamp_status': 'supplied' if timestamp is not None else 'not_supplied'}
                result = {'success': True, 'source': 'GNANI_STT', 'transcript': payload['transcript'],
                          'request_id': payload['request_id'], 'timestamp': timestamp, 'language': request.language_code,
                          'provider_timestamp_status': event['output']['provider_timestamp_status']}
            else:
                if not body: raise VoiceFailure('EMPTY_AUDIO')
                if content_type not in ('audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'):
                    raise VoiceFailure('MALFORMED_RESPONSE')
                metadata = wav_metadata(body, output=True)
                metadata['matches_requested_audio_config'] = (metadata['sample_rate'], metadata['num_channels'], metadata['sample_width']) == (48000, 1, 2)
                event['output'] = {**metadata, 'content_type': content_type, 'audio_bytes': len(body)}
                result = {'success': True, 'source': 'GNANI_TTS', 'audio_base64': base64.b64encode(body).decode(),
                          'content_type': 'audio/wav', 'provider_content_type': content_type, 'audio_bytes': len(body),
                          'language': request.language, 'voice': request.voice, 'model': request.model,
                          'request_id': event['request_id'], **metadata}
            event['success'] = True
        except VoiceFailure as error:
            result = {'success': False, 'error': {'code': error.code, 'message': MESSAGES[error.code], 'retryable': error.retryable}}
        except httpx.TimeoutException:
            result = {'success': False, 'error': {'code': 'TIMEOUT', 'message': MESSAGES['TIMEOUT'], 'retryable': True}}
        except httpx.HTTPError:
            result = {'success': False, 'error': {'code': 'NETWORK_ERROR', 'message': MESSAGES['NETWORK_ERROR'], 'retryable': True}}
        except (ValidationError, TypeError, ValueError):
            result = {'success': False, 'error': {'code': 'INVALID_ARGUMENT', 'message': MESSAGES['INVALID_ARGUMENT'], 'retryable': False}}
        except Exception:
            result = {'success': False, 'error': {'code': 'INTERNAL_ERROR', 'message': MESSAGES['INTERNAL_ERROR'], 'retryable': False}}
        event['latency_ms'] = round((time.monotonic() - started) * 1000, 2)
        event['error_code'] = result.get('error', {}).get('code')
        try:
            result['evidence'] = self.evidence.record(event)
            result['evidence']['journal_status'] = 'written' if self.evidence.path else 'inline_only'
        except OSError:
            # Preserve actual paid conversion outcome even if local evidence storage is unavailable.
            from .evidence import redact
            result['evidence'] = {**redact(event), 'journal_status': 'unavailable'}
        return result
