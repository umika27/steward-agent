"""Explicit paid smoke test: at most one STT and one TTS request, never automatic retries."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path

from .adapter import GnaniVoice, decode_audio, wav_metadata
from .evidence import EvidenceWriter, redact, timestamps
from .schemas import TranscribeInput, SynthesizeInput

SENTENCE = 'Your washing machine repair case is still active.'


def run(audio_path, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    if (output_dir / 'smoke-evidence.json').exists():
        raise ValueError('Use a fresh output directory to preserve previous smoke evidence')
    input_audio = audio_path.read_bytes()
    request = TranscribeInput(audio_base64=base64.b64encode(input_audio).decode(), filename=audio_path.name)
    # Validate the actual file and TTS configuration before either paid call.
    _, metadata = decode_audio(request)
    text = SynthesizeInput(text=SENTENCE)
    summary = {**timestamps(), 'provider': 'GNANI', 'input_audio_path': str(audio_path),
        'input_metadata': metadata, 'input_sha256': hashlib.sha256(input_audio).hexdigest(),
        'input_origin': 'Caller-supplied audio; current run uses macOS synthesized speech, not a microphone recording.',
        'reasoning_boundary': 'No Pine invocation. TTS text is a harmless fixed smoke-test sentence, not a Steward decision.',
        'paid_http_requests_attempted': 0}
    if not os.environ.get('GNANI_API_KEY'):
        summary.update(stt={'status': 'SKIPPED', 'reason': 'GNANI_API_KEY missing'},
                       tts={'status': 'SKIPPED', 'reason': 'GNANI_API_KEY missing'})
    else:
        def preserve_response(direction, body, content_type):
            if direction == 'TTS' and body[:4] == b'RIFF' and body[8:12] == b'WAVE':
                # Preserve provider bytes before validation; this file is not a PASS assertion.
                (output_dir / 'provider-response.wav').write_bytes(body)
            elif direction == 'STT':
                try:
                    payload = json.loads(body)
                    if isinstance(payload, dict):
                        selected = {k: payload[k] for k in ('success', 'request_id', 'timestamp', 'transcript') if k in payload}
                        (output_dir / 'provider-stt-response.json').write_text(json.dumps(redact(selected), indent=2) + '\n')
                except (ValueError, UnicodeDecodeError): pass
        adapter = GnaniVoice(evidence=EvidenceWriter(output_dir / 'calls.jsonl'), response_observer=preserve_response)
        stt = adapter.invoke('STT', request.model_dump())
        summary['paid_http_requests_attempted'] += 1
        summary['stt'] = {'status': 'PASS' if stt['success'] else 'FAIL', **stt}
        # Do not incur a second failed auth/credit/rate/network call when its failure is already known.
        blocking = not stt['success'] and stt['error']['code'] in ('AUTH_FAILED', 'RATE_LIMITED', 'MISSING_CREDENTIALS', 'NETWORK_ERROR', 'TIMEOUT')
        if blocking:
            summary['tts'] = {'status': 'SKIPPED', 'reason': 'STT established an access/network/credit blocker; no blind second paid call.'}
        else:
            tts = adapter.invoke('TTS', text.model_dump())
            summary['paid_http_requests_attempted'] += 1
            encoded = tts.pop('audio_base64', None)
            if tts['success']:
                audio = base64.b64decode(encoded, validate=True)
                wav_metadata(audio, output=True)
                target = output_dir / 'reply.wav'
                target.write_bytes(audio)
                tts['output_audio_path'] = str(target)
                tts['sha256'] = hashlib.sha256(audio).hexdigest()
            summary['tts'] = {'status': 'PASS' if tts['success'] else 'FAIL', **tts}
    safe = redact(summary)
    target = output_dir / 'smoke-evidence.json'
    target.write_text(json.dumps(safe, ensure_ascii=False, indent=2) + '\n')
    return safe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    summary = run(args.audio, args.output_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if all(summary[k]['status'] == 'PASS' for k in ('stt', 'tts')) else 1

if __name__ == '__main__': raise SystemExit(main())
