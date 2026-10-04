"""Independent deployment settings; tokens never appear in repr."""
from dataclasses import dataclass, field
import os
from pathlib import Path

SCENARIOS = ('NORMAL_SERVICEABLE', 'EMBARGO', 'NSZ', 'SHIPMENT_CREATED',
             'NO_RIDER_OR_CAPACITY', 'TIMEOUT', 'MALFORMED_RESPONSE',
             'IN_TRANSIT', 'DELIVERED', 'DELIVERY_EXCEPTION')

@dataclass(frozen=True)
class Config:
    mock_token: str = field(repr=False)
    mcp_token: str = field(repr=False)
    database: Path = Path('tmp/delhivery_mock/shipments.sqlite3')
    host: str = '127.0.0.1'
    port: int = 8003
    public_host: str | None = None
    warehouse: str = 'Steward Mock Warehouse'
    scenario: str = 'NORMAL_SERVICEABLE'

    def __post_init__(self):
        for token in (self.mock_token, self.mcp_token):
            if len(token) < 32 or not token.isascii() or not token.isprintable():
                raise ValueError('Both Delhivery tokens require at least 32 printable ASCII characters')
        if self.mock_token == self.mcp_token: raise ValueError('Use distinct mock and MCP tokens')
        if not 1 <= self.port <= 65535: raise ValueError('Invalid port')
        if self.scenario not in SCENARIOS: raise ValueError('Invalid mock scenario')
        if not self.warehouse.strip() or len(self.warehouse) > 200: raise ValueError('Invalid warehouse')
        if self.public_host and any(c in self.public_host for c in '/:* \t\r\n'):
            raise ValueError('Public host must be a hostname without scheme, port or wildcard')
        target = self.database.expanduser().resolve()
        root = Path(__file__).resolve().parents[2]
        for folder in ('src', 'public', 'steward', 'rails', 'tests', 'integrations', 'data', '.git',
                       'tmp/steward_mcp', 'tmp/ui_runtime', 'tmp/demo_runtime', 'tmp/gnani_voice'):
            protected = root / folder
            if target == protected or protected in target.parents:
                raise ValueError('Mock database must be outside source and canonical data')
        if target.suffix not in ('.sqlite', '.sqlite3', '.db'): raise ValueError('Use a SQLite database file')

    @classmethod
    def from_env(cls):
        return cls(mock_token=os.environ.get('DELHIVERY_MOCK_TOKEN', ''),
                   mcp_token=os.environ.get('DELHIVERY_MCP_AUTH_TOKEN', ''),
                   database=Path(os.environ.get('DELHIVERY_DATABASE_PATH', 'tmp/delhivery_mock/shipments.sqlite3')),
                   host=os.environ.get('DELHIVERY_HOST', '127.0.0.1'),
                   port=int(os.environ.get('PORT', os.environ.get('DELHIVERY_PORT', '8003'))),
                   public_host=os.environ.get('DELHIVERY_PUBLIC_HOST', os.environ.get('RENDER_EXTERNAL_HOSTNAME')),
                   warehouse=os.environ.get('DELHIVERY_WAREHOUSE_NAME', 'Steward Mock Warehouse'),
                   scenario=os.environ.get('DELHIVERY_SCENARIO', 'NORMAL_SERVICEABLE'))
