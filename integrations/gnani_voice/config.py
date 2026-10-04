"""Environment-only credentials; independent service configuration."""
from dataclasses import dataclass, field
import os
from pathlib import Path

@dataclass(frozen=True)
class Config:
    host: str = '127.0.0.1'
    port: int = 8002
    token: str | None = field(default=None, repr=False)
    public_host: str | None = None
    evidence_path: Path | None = None

    def __post_init__(self):
        if not 1 <= self.port <= 65535: raise ValueError('Invalid voice service port')
        if self.token is not None and (len(self.token) < 32 or not self.token.isascii() or not self.token.isprintable()):
            raise ValueError('GNANI_MCP_AUTH_TOKEN must contain at least 32 printable ASCII characters')
        if self.host not in ('127.0.0.1', 'localhost', '::1') and not self.token:
            raise ValueError('Public voice binding requires GNANI_MCP_AUTH_TOKEN')
        if self.public_host and any(c in self.public_host for c in '/:* \t\r\n'):
            raise ValueError('Public hostname must not include scheme, port or wildcards')
        if self.evidence_path:
            target = self.evidence_path.expanduser().resolve()
            root = Path(__file__).resolve().parents[2]
            for folder in ('src', 'steward', 'rails', 'tests', 'integrations', 'data', '.git'):
                protected = root / folder
                if target == protected or protected in target.parents:
                    raise ValueError('Voice evidence must be outside source and canonical data directories')
            if target.suffix != '.jsonl': raise ValueError('Evidence file must end in .jsonl')

    @classmethod
    def from_env(cls):
        evidence = os.environ.get('GNANI_EVIDENCE_PATH')
        return cls(host=os.environ.get('GNANI_VOICE_HOST', '127.0.0.1'),
                   port=int(os.environ.get('PORT', os.environ.get('GNANI_VOICE_PORT', '8002'))),
                   token=os.environ.get('GNANI_MCP_AUTH_TOKEN'),
                   public_host=os.environ.get('GNANI_PUBLIC_HOST', os.environ.get('RENDER_EXTERNAL_HOSTNAME')),
                   evidence_path=Path(evidence) if evidence else None)
