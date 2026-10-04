"""Deployment configuration preserves local compatibility and fails closed remotely."""
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from integrations.steward_mcp.config import Config

class TestDeploymentConfig(unittest.TestCase):
    def config(self, env):
        with patch.dict(os.environ, env, clear=True):
            return Config.from_env()

    def test_local_defaults_remain_loopback(self):
        c = self.config({})
        self.assertEqual((c.host, c.port, c.scenario, c.bearer_token), ('127.0.0.1', 8001, 'normal', None))

    def test_render_configuration_and_hostname(self):
        c = self.config({'PORT': '10000', 'MCP_HOST': '0.0.0.0', 'MCP_AUTH_TOKEN': 'x' * 40,
                         'MCP_DATABASE_PATH': '/var/data/steward_mcp/runtime.sqlite3',
                         'MCP_SCENARIO': 'normal', 'RENDER_EXTERNAL_HOSTNAME': 'steward-mcp.onrender.com'})
        self.assertEqual((c.host, c.port, c.public_host), ('0.0.0.0', 10000, 'steward-mcp.onrender.com'))
        self.assertEqual(c.database, Path('/var/data/steward_mcp/runtime.sqlite3'))
        self.assertNotIn('x' * 40, repr(c))

    def test_legacy_environment_remains_supported(self):
        c = self.config({'STEWARD_MCP_PORT': '8123', 'STEWARD_MCP_SCENARIO': 'no_show',
                         'STEWARD_MCP_DATABASE': '/tmp/steward-deploy-test/runtime.sqlite3',
                         'STEWARD_MCP_PUBLIC_HOST': 'legacy.example'})
        self.assertEqual((c.port, c.scenario, c.public_host), (8123, 'no_show', 'legacy.example'))

    def test_aliases_have_documented_precedence(self):
        c = self.config({'PORT': '10000', 'STEWARD_MCP_PORT': '8123', 'MCP_PUBLIC_HOST': 'custom.example',
                         'STEWARD_MCP_PUBLIC_HOST': 'legacy.example', 'RENDER_EXTERNAL_HOSTNAME': 'default.onrender.com'})
        self.assertEqual((c.port, c.public_host), (10000, 'custom.example'))

    def test_public_binding_requires_valid_token(self):
        for token in (None, '', 'short'):
            env = {'MCP_HOST': '0.0.0.0'}
            if token is not None: env['MCP_AUTH_TOKEN'] = token
            with self.assertRaises(ValueError): self.config(env)

    def test_invalid_port_and_hostname_rejected(self):
        for env in ({'PORT': '0'}, {'PORT': 'invalid'}, {'MCP_PUBLIC_HOST': 'https://bad.example'}, {'MCP_PUBLIC_HOST': '*.example'}):
            with self.assertRaises(ValueError): self.config(env)

    def test_alias_cannot_bypass_fixture_storage_protection(self):
        from integrations.steward_mcp.config import REPO_ROOT
        with self.assertRaises(ValueError):
            self.config({'MCP_DATABASE_PATH': str(REPO_ROOT / 'data/runtime.sqlite3')})
