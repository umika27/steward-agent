# GNANI Voice Rail — independent connector

Pine/AgenticOrg is Steward's only reasoning/orchestration brain. This service performs
only GNANI speech conversion. It does not call an LLM, use a Gnani conversational agent,
or import Steward case/authority/repair/recovery/verifier code. Steward MCP retains
exactly its existing five tools, unchanged. No frontend or business logic was modified.
The approved browser-native microphone experience remains separate; it is not silently
replaced or relabeled as GNANI. No new dependency versions are introduced: the voice
requirements reuse the pinned SDK/HTTP transport dependencies only, not Steward code.

```
Audio → transcribe_voice_input → actual GNANI transcript → Pine
Pine → reasons / invokes its other tools → response text
Response text → synthesize_voice_reply → actual GNANI WAV bytes → playback client
```

## Public interface and limits

Independent MCP name `gnani-voice-rail`, Streamable HTTP `POST /mcp`. Exactly two tools:

- `transcribe_voice_input`: required `audio_base64` (standard strict base64) and basename
  `filename`; optional `language_code`, default `en-IN`. Accepts WAV, MP3, OGG, FLAC,
  AAC and M4A. Maximum decoded file 6 MiB; WAV duration enforced at 30 seconds. Compressed
  duration cannot be measured without a decoder, so callers must keep those clips under
  30 seconds. The upstream validates compressed formats. No file paths/URLs are accepted,
  avoiding local-file access and URL-fetch/SSRF behaviors. Ten documented Indian language
  codes supported. Provider STT endpoint `/stt/v3`; multipart `audio_file`,
  `language_code`, `format=transcribe`, `itn_native_numerals=false`; client constructs
  boundary. No substitution or word boosting is enabled.
- `synthesize_voice_reply`: required `text` (1–500 characters); fixed defaults/allowed
  values `voice=Kaveri`, `model=timbre-v2.5`, `language=en-IN`. No text generation.
  Provider REST `/api/v1/tts/inference`; speed 1.0, requested WAV PCM 48 kHz/mono/16-bit.
  Output bounded at 8 MiB. Valid PCM WAV returned as `audio_base64`, `content_type=audio/wav`,
  actual audio length/duration/rate/channels/width and provider content type. If Gnani
  returns another valid supported PCM rate, report it and set
  `matches_requested_audio_config=false`; never pretend it is 48 kHz.

STT success preserves actual transcript/request ID, source `GNANI_STT`, language and
provider timestamp. **The real API omitted the documented timestamp in this run.** It is
returned as `null` with `provider_timestamp_status=not_supplied`; local observation time
is separate evidence, never fabricated provider time. A missing actual request ID,
missing transcript or malformed supplied timestamp is still an explicit failure.

Every success/failure includes `evidence`: UTC/Asia-Kolkata timestamps, provider/direction,
source, request ID if supplied, language, HTTP status, latency, input/output metadata,
and optional journal status. Successful TTS source is `GNANI_TTS`. Errors contain
`success=false`, stable code/message and retryability; MCP `isError=true`. Timeouts,
network errors, false success, malformed/empty responses and upstream statuses
400/403/429/500/503 never turn into guessed speech or invented audio.

Both tools may incur charges: `idempotentHint=false`, no automatic retries or redirect
following. Repeating a tool call can incur a second charge. Connector middleware/Pine
must not blindly retry. Only fixed HTTPS provider URLs are used. There is no fake/test
provider mode in deployment; upstream mocking exists exclusively in tests.

## Credentials and evidence privacy

Only environment `GNANI_API_KEY` supplies the vendor credential, sent as
`X-API-Key-ID`. No `.env` auto-loader exists in code. Shell loading is explicit:

```sh
set -a
source .env
set +a
```

Never expose `.env` or print the key. Provider key is distinct from the adapter's inbound
`GNANI_MCP_AUTH_TOKEN`. Public binding requires an inbound random token of at least 32
printable ASCII characters. The caller sends `Authorization: Bearer <adapter-token>`;
it never receives the provider key.

No raw upstream error bodies/messages, authentication headers or audio base64 are logged.
Evidence removes configured secret values and redacts transcript/text content containing
credential terms (OTP/PIN/CVV/password/passcode/key/token/secret). Treat remaining evidence
as private household data: redact names/other personal data before sharing recordings.
Evidence containing credentials may omit the text/transcript instead of reproducing it.
No request/body debug logging is enabled. Journal file is created with mode 0600, writes
are serialized within the single process, flushed and fsynced. A journal write failure
preserves the actual paid conversion receipt with `journal_status=unavailable`, not a
fabricated failure/success. Without a path, evidence is returned inline.

## Local launch and tests

From repository root, existing verified Python 3.13.7 environment:

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m pip install -r integrations/gnani_voice/requirements.txt
# After explicitly loading GNANI_API_KEY into the environment:
GNANI_EVIDENCE_PATH=/tmp/gnani-voice/calls.jsonl /tmp/steward-mcp-phase1-venv/bin/python -B -m integrations.gnani_voice.server
```

Default endpoint `http://127.0.0.1:8002/mcp`; public liveness `/healthz` includes provider,
tool count and credential-presence boolean. Health does not consume credits or prove
upstream readiness. Port 8002 is separate from Python API 8000 and Steward MCP 8001.

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m unittest tests.test_gnani_voice tests.test_gnani_transport -v
/tmp/steward-mcp-phase1-venv/bin/python -B -m unittest discover -s tests -v
npm test
npm run build
git diff --check
```

Unit/upstream tests use only `httpx.MockTransport`, fake test keys and temporary evidence.
Transport tests launch a real local HTTP MCP service using a mocked upstream; normal
tests cannot accidentally call/pay Gnani even when a real key is loaded.

## Explicit paid smoke test

Only run intentionally after checking credentials/credits and request-construction tests.
Use a fresh output directory; previous receipts are not overwritten. Prepare a <30 s
actual speech WAV (16 kHz mono PCM is suitable). Current run uses macOS `say` speech,
not a microphone recording; this is genuine speech audio but not a human-voice/accent test.

```sh
/tmp/steward-mcp-phase1-venv/bin/python -B -m integrations.gnani_voice.smoke --audio /path/to/short-speech.wav --output-dir /tmp/gnani-smoke-new-run
```

At most one STT and one TTS per invocation, no retries. An auth/rate/network/timeout STT
blocker skips TTS. Successful TTS saves validated `reply.wav`. Provider WAV candidates
are preserved before parsing as `provider-response.wav` for offline debugging; their
existence is **not** a PASS assertion. Safe provider STT fields are preserved separately.
`smoke-evidence.json` and redacted `calls.jsonl` contain non-secret evidence. Exit nonzero
if either conversion is not PASS. It does not invoke Pine or claim a generated decision;
TTS uses the harmless fixed sentence “Your washing machine repair case is still active.”
See `docs/GNANI_ROUND3_IMPLEMENTATION.md` for this run's exact live outcomes and call count.

## Render deployment and AgenticOrg registration — pending

Root `render.yaml` adds the separate native-Python **gnani-voice-rail** service. Steward's
service entry is unchanged. Deploy neither automatically; creating a Render Blueprint
will create/deploy services, so review paid resources first. Automatic deploy triggers off.

| Hosting setting | Exact value |
| --- | --- |
| Root | Repository root; leave rootDir blank |
| Build | `python -m pip install -r integrations/gnani_voice/requirements.txt` |
| Start | `python -B -m integrations.gnani_voice.server` |
| Python | `PYTHON_VERSION=3.13.7` |
| Host | `GNANI_VOICE_HOST=0.0.0.0` |
| Port | Platform `PORT`, local fallback `GNANI_VOICE_PORT=8002` |
| MCP / health | `/mcp` / `/healthz` |
| Journal disk | 1 GB at `/var/data/gnani_voice` |
| Journal path | `GNANI_EVIDENCE_PATH=/var/data/gnani_voice/calls.jsonl` |
| Vendor secret | **Render Dashboard → gnani-voice-rail → Environment → GNANI_API_KEY** |
| Adapter secret | Same dashboard: **GNANI_MCP_AUTH_TOKEN**, independent random token |
| Public hostname | Render supplies `RENDER_EXTERNAL_HOSTNAME`; optional `GNANI_PUBLIC_HOST` override |

No secret values in YAML. One process/instance; persistent disk limits scaling and
zero-downtime deployment. Public Host/Origin allowlists are restrictive, no wildcards.
Render terminates HTTPS; actual Linux/HTTPS deployment still requires verification.

Manual actions: review and commit intended source when ready (not done here), push only
when authorized, create/configure the Render service/disk/secrets and manually deploy.
Verify health and authenticated discovery without paid calls first. Register a **separate**
AgenticOrg connector:

| Registration field | Value |
| --- | --- |
| Name | `GNANI Voice Rail` |
| Endpoint | `https://<gnani-voice-host>/mcp` |
| Transport | Streamable HTTP |
| Auth | `custom`, only if it supports arbitrary headers |
| Header | `Authorization` |
| Header value | `Bearer <GNANI_MCP_AUTH_TOKEN>` |
| Tools | `transcribe_voice_input`, `synthesize_voice_reply` |

An `api_key` choice is usable only if it can send the exact inbound header/value above.
Do not send the vendor key to this connector form, select unauthenticated public access,
or merge these tools into Steward MCP. Vendor credentials go only in Render's environment.
AgenticOrg header support, base64 payload/response limits, and actual tool invocation remain
unverified remotely. Pine must receive STT transcript, reason itself, produce response
text, then call TTS. The playback client decodes returned base64 into a WAV Blob/file;
no frontend/Pine endpoint or automatic event routing is fabricated in this implementation.

Official references: [STT REST](https://docs.gnani.ai/api/STT/speech-to-text),
[TTS REST](https://docs.gnani.ai/api/TTS/tts-inference),
[voice catalog](https://docs.gnani.ai/api/TTS/available-voices).
