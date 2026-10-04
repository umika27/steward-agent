# Gnani Round 3 implementation — 2026-10-04

Implemented a separate **GNANI Voice Rail MCP** connector. Existing Steward MCP's five
tools and semantics are unchanged. Pine remains the only reasoning/orchestration brain.
GNANI provides speech conversion only; no Gnani Agent Builder agent, case manager,
authority policy, repair/replacement, recovery, provider decisions or closure logic added.
No frontend or existing business logic was changed; **VISIBLE UI CHANGE: NONE**.

## Implemented files and public interface

Added `integrations/gnani_voice/{__init__,config,schemas,evidence,adapter,server,smoke}.py`,
`requirements.txt`, `README.md`; `tests/test_gnani_voice.py`, `test_gnani_transport.py`,
`test_gnani_smoke.py`; this report and `evidence/gnani_round3_voice_smoke.json`.
Modified only root `render.yaml`, `.gitignore` and the existing commit-review manifest.
Other dirty/untracked work predates this task and was preserved.

Public service `gnani-voice-rail` uses official MCP SDK stateless Streamable HTTP at
`/mcp`, separate port/process (local 8002), and public non-billable `/healthz`.
Exactly `transcribe_voice_input` and `synthesize_voice_reply`; neither makes decisions.
STT takes a bounded base64 audio clip, basename and default `en-IN`; returns actual
transcript/request ID/provider timestamp if supplied/provenance. TTS takes Pine-produced
text and returns bounded, validated actual PCM WAV as base64 plus audio metadata.
Vendor header `X-API-Key-ID` is server-side only, sourced from environment `GNANI_API_KEY`.
No URL fetching, arbitrary file access, credential constructor argument or fake provider
mode. No redirects or automatic retries. Shared requirements pin transport dependencies
without importing Steward application code. Exact contracts/configuration:
[integrations/gnani_voice/README.md](../integrations/gnani_voice/README.md).

Flow prepared: real audio → GNANI STT → transcript boundary → **Pine** → response-text
boundary → GNANI TTS → audio boundary. Actual Pine event transport and frontend audio
capture/playback wiring are not fabricated or claimed. Existing approved microphone
behavior remains browser recognition → transcript input → Send.

## Real STT: PASS, with precise qualification

- Genuine Gnani REST request: `POST https://api.vachana.ai/stt/v3`.
- Input: 2.013 s, 64,488-byte mono 16 kHz/16-bit WAV; generated using macOS `say` then
  ffmpeg. Real speech audio, not a live microphone or Indian-accent test.
- Language `en-IN`, format `transcribe`, native numerals false; no substitutions/boosting.
- HTTP **200**, latency **392.26 ms** on captured diagnostic call.
- Actual transcript: **“my washing machine is not draining”**.
- Actual request ID: **`01a10478-6479-7a27-889b-6ceecc8265ba`**.
- Observed UTC **2026-10-04 01:12:41.164560**, local **06:42:41.164560 IST**.
- Gnani omitted the documented timestamp field. Original strict parser returned FAIL;
  this genuine API variation was fixed to preserve `timestamp=null` and explicitly mark
  `provider_timestamp_status=not_supplied`. Local observation time is not substituted.
- Corrected parser accepted the captured real response in an **offline replay**. No
  further paid STT call was used to claim that validation. Missing request ID or transcript,
  false success, malformed supplied timestamp remain errors; no transcript fabricated.

## Real TTS: FAIL — playable audio not proven

Requested harmless sentence: “Your washing machine repair case is still active.”
REST endpoint `https://api.vachana.ai/api/v1/tts/inference`; **Kaveri**, **timbre-v2.5**,
`en-IN`, speed 1.0, requested 48 kHz mono 16-bit PCM WAV.

Initial request returned HTTP **429**. One controlled cooldown retry returned HTTP **200**,
`audio/wav`, **238,124 bytes**, latency **1187.36 ms**, but the original strict WAV validator
rejected it. That diagnostic did not retain the returned binary, so its actual PCM/header
format and playback cannot be asserted. The validator was corrected to accept and
accurately report other valid supported PCM rates rather than demand the requested rate;
it still rejects empty, truncated or malformed WAV. The exact original binary mismatch
remains undiagnosed. The smoke runner now preserves provider WAV candidates before
validation, allowing future debugging without another paid request.

Final controlled validation attempt returned HTTP **429**, **281.16 ms**, `application/json`:
`RATE_LIMITED`, “Rate limit exceeded”. Observed UTC **2026-10-04 01:17:40.398363**,
local **06:47:40.398363 IST**. No numeric Retry-After value was captured. Full response
headers were not preserved, and the capture ignored HTTP-date Retry-After values;
therefore header absence or a rate-limit reset time cannot be established. No playable returned WAV
was saved; output audio path is **null**. This is not a successful synthesis assertion.

**Five live requests total: two STT, three TTS. No further live calls were made.**
Local import failures/empty sandbox audio generation incurred no provider calls.
Historical receipts were retained; no blind retry loop or automatic fallback exists.

Non-secret aggregate: [gnani_round3_voice_smoke.json](../evidence/gnani_round3_voice_smoke.json).
Detailed original evidence: `/tmp/steward-gnani-smoke-20261004/` (`live/smoke-evidence.json`,
`stt-diagnostic.json`, `stt-validated.json`, `tts-diagnostic.json`, `tts-final-validation.json`).
The API key was loaded via user-authorized `source .env`; never printed/logged/copied.
`.env` remains ignored and untracked. Existing manual Gnani call observations were untouched.

## Tests and preservation proof

Final Python discovery: **201 PASS = 58 Gnani + 48 existing Steward MCP + 95 backend/API**.
Gnani breakdown: 47 adapter/config/security/architecture tests, 6 real-localhost MCP
transport tests with mocked upstream, 5 smoke-runner safety tests. No unit/regression
test calls real Gnani. Tests cover exact multipart/JSON contracts, required statuses,
timeouts/network, missing credentials, malformed/empty responses, provenance, timestamp
variation, WAV integrity, actual format reporting, credential redaction, bounded inputs,
no retries/redirects, explicit business-field rejection and import separation.

Frontend **10 PASS**, including existing canonical regression suites; production build
**PASS**, 1570 modules. JS/CSS output hashes unchanged from before this task.
`git diff --check` **PASS**, MCP environment `pip check` **PASS**.
Both service entries validate against Render's official JSON Schema. Remote Linux/HTTPS
hosting and AgenticOrg registration remain unverified.

Source hashes compared against `/tmp/steward-gnani-before-20261004/hashes.json` prove
**zero frontend files, zero Steward MCP files and zero existing backend files changed**.
Final Git state: branch `ui`, 35 modified tracked files (including 24 pre-existing
bytecode changes), 137 untracked files, zero staged files. Prior dirty bytecode was
preserved; do not stage it. The combined commit-review manifest contains 148 intended
source/config/evidence files, excluding bytecode and generated runtime artifacts. No commit, staging, push, deploy,
stash, reset, merge or history rewrite was performed.

## Deployment, registration, and remaining manual actions

Root Blueprint adds one independent paid native-Python `gnani-voice-rail` service with
its own 1 GB evidence disk at `/var/data/gnani_voice`. Existing Steward service entry
remains identical. Automatic deploy triggers off; creating a Blueprint still deploys.
Do not deploy until reviewed/authorized. Python 3.13.7, platform `PORT`, host 0.0.0.0,
health `/healthz`, MCP `/mcp`, journal `/var/data/gnani_voice/calls.jsonl`.

Build: `python -m pip install -r integrations/gnani_voice/requirements.txt`.
Start: `python -B -m integrations.gnani_voice.server`.
Secrets entered in **Render Dashboard → gnani-voice-rail → Environment**:
`GNANI_API_KEY` and independent random `GNANI_MCP_AUTH_TOKEN` (at least 32 printable
ASCII characters). YAML contains only secret names with `sync:false`, not values.
Render external hostname supplies restrictive Host/Origin validation.

Manual actions:

1. Review the intended files in `docs/round3-commit-files.txt`; commit/push only when
   chosen. Do not include bytecode, generated audio, runtime evidence journals or secrets.
2. Resolve Gnani's TTS rate/access limitation with the account/provider. Then intentionally
   run **one** fresh-output smoke test, confirm real WAV decodes/plays and inspect actual
   returned sample metadata; keep provider candidates for offline debugging on failure.
3. Create/configure the separate Render service, enter secrets, mount the evidence disk,
   manually deploy and verify HTTPS health + authenticated discovery without paid calls.
4. AgenticOrg connector name **GNANI Voice Rail**, URL **https://<voice-host>/mcp**,
   transport **Streamable HTTP**. Choose **custom** only if it accepts header
   **Authorization: Bearer <GNANI_MCP_AUTH_TOKEN>**. `api_key` only if it can emit that
   exact header/value. Vendor key belongs in Render, never connector input/agent prompt.
5. Attach only the two voice tools from this separate connector. Retain Steward's original
   five-tool connector; verify AgenticOrg header and base64 payload/response support.
6. Prove actual Pine routing from transcript to its own reasoning and response text,
   then GNANI synthesis and playback. Capture true competition evidence; no fake live label.

**Next highest-priority Round 3 task:** resolve/validate the remaining live TTS blocker,
then register both independent MCP connectors in AgenticOrg and record a genuine
Pine → tool → response → audio run. Delhivery and native Plural payment evaluation follow;
do not replace Pine reasoning with a local voice/case agent to shortcut that proof.

Official contracts: [STT REST](https://docs.gnani.ai/api/STT/speech-to-text),
[TTS REST](https://docs.gnani.ai/api/TTS/tts-inference).
