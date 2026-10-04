"""Gateway transport settings; existing integrations retain their own settings."""
from dataclasses import dataclass, field
import os


@dataclass(frozen=True)
class Config:
    token: str = field(repr=False)
    host: str = '127.0.0.1'
    port: int = 8004
    public_host: str | None = None

    def __post_init__(self):
        if len(self.token) < 32 or not self.token.isascii() or not self.token.isprintable():
            raise ValueError('STEWARD_GATEWAY_MCP_AUTH_TOKEN requires at least 32 printable ASCII characters')
        if not 1 <= self.port <= 65535:
            raise ValueError('Invalid gateway port')
        if self.public_host and any(c in self.public_host for c in '/:* \t\r\n'):
            raise ValueError('Gateway public host must be a hostname without scheme, port or wildcards')

    @classmethod
    def from_env(cls):
        return cls(token=os.environ.get('STEWARD_GATEWAY_MCP_AUTH_TOKEN', ''),
                   host=os.environ.get('STEWARD_GATEWAY_HOST', '127.0.0.1'),
                   port=int(os.environ.get('PORT', os.environ.get('STEWARD_GATEWAY_PORT', '8004'))),
                   public_host=os.environ.get('STEWARD_GATEWAY_PUBLIC_HOST',
                                              os.environ.get('RENDER_EXTERNAL_HOSTNAME')))
