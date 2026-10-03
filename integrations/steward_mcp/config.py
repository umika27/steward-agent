"""Explicit runtime configuration; no credentials or live adapters are assumed."""
from dataclasses import dataclass, field
import os
from pathlib import Path

from .schemas import ScenarioName
from typing import get_args

REPO_ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = get_args(ScenarioName)


@dataclass(frozen=True)
class Config:
    database: Path = field(default_factory=lambda: Path.home() / ".local/share/steward_mcp/runtime.sqlite3")
    scenario: str = "normal"
    host: str = "127.0.0.1"
    port: int = 8001
    bearer_token: str | None = field(default=None, repr=False)
    public_host: str | None = None

    def __post_init__(self):
        if self.scenario not in SCENARIOS:
            raise ValueError("Unknown provider scenario")
        if not 1 <= self.port <= 65535:
            raise ValueError("Invalid port")
        if self.bearer_token is not None and len(self.bearer_token) < 32:
            raise ValueError("STEWARD_MCP_BEARER_TOKEN must be at least 32 characters")
        if self.host not in ("127.0.0.1", "localhost", "::1") and not self.bearer_token:
            raise ValueError("Non-loopback binding requires STEWARD_MCP_BEARER_TOKEN")
        if self.public_host and any(c in self.public_host for c in "/:* \t\r\n"):
            raise ValueError("public_host must be a hostname, without scheme, port or wildcards")
        target = self.database.expanduser().resolve()
        if target.suffix not in (".sqlite3", ".sqlite", ".db"):
            raise ValueError("database must use a .sqlite3, .sqlite or .db suffix")
        protected = (REPO_ROOT / "data", REPO_ROOT / "tmp/ui_runtime", REPO_ROOT / "src",
                     REPO_ROOT / "steward", REPO_ROOT / "rails", REPO_ROOT / ".git",
                     REPO_ROOT / "integrations", REPO_ROOT / "tests")
        if any(target == path or path in target.parents for path in protected):
            raise ValueError("MCP runtime storage must be isolated from source, fixtures and UI memory")
        if target.exists() and target.is_dir():
            raise ValueError("database must be a file path")

    @classmethod
    def from_env(cls):
        return cls(
            database=Path(os.environ.get("STEWARD_MCP_DATABASE", str(cls().database))),
            scenario=os.environ.get("STEWARD_MCP_SCENARIO", "normal"),
            host=os.environ.get("STEWARD_MCP_HOST", "127.0.0.1"),
            port=int(os.environ.get("STEWARD_MCP_PORT", "8001")),
            bearer_token=os.environ.get("STEWARD_MCP_BEARER_TOKEN"),
            public_host=os.environ.get("STEWARD_MCP_PUBLIC_HOST"),
        )
