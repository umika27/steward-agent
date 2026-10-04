"""Redacted call evidence; never logs raw provider error bodies or credentials."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import json
import os
from pathlib import Path
import re
import threading

CREDENTIAL_WORDS = re.compile(r'\b(?:otp|one[ -]time password|pin|cvv|password|passcode|api[ _-]?key|authorization|bearer|token|secret)\b', re.I)


def timestamps():
    instant = datetime.now(timezone.utc)
    return {'timestamp_utc': instant.isoformat(), 'timestamp_local': instant.astimezone(ZoneInfo('Asia/Kolkata')).isoformat()}


def redact(value):
    if isinstance(value, dict): return {k: redact(v) for k, v in value.items()}
    if isinstance(value, list): return [redact(v) for v in value]
    if isinstance(value, str):
        for name in ('GNANI_API_KEY', 'GNANI_MCP_AUTH_TOKEN'):
            secret = os.environ.get(name)
            if secret and secret in value: return '[REDACTED]'
        if CREDENTIAL_WORDS.search(value): return '[REDACTED: credential-like content]'
    return value


class EvidenceWriter:
    def __init__(self, path: Path | None = None):
        self.path = path.expanduser() if path else None
        self.lock = threading.Lock()

    def record(self, evidence):
        safe = redact(evidence)
        if self.path:
            with self.lock:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                payload = (json.dumps(safe, ensure_ascii=False, allow_nan=False) + '\n').encode()
                descriptor = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                try:
                    with os.fdopen(descriptor, 'ab') as handle:
                        handle.write(payload)
                        handle.flush()
                        os.fsync(handle.fileno())
                except BaseException:
                    raise
        return safe
