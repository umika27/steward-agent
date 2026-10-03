"""Real localhost Streamable HTTP discovery and calls using the official SDK."""
import asyncio
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from integrations.steward_mcp.config import REPO_ROOT
from tests.test_mcp_memory import PROVIDER, SLOT, evidence

EXPECTED_TOOLS = {"get_machine_memory", "update_machine_memory", "request_service_quote",
                  "request_service_appointment", "get_service_status"}


class HTTPServerFixture(unittest.TestCase):
    token = None
    scenario = "normal"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.directory = tempfile.TemporaryDirectory(prefix="steward-mcp-http-")
        cls.addClassCleanup(cls.directory.cleanup)
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            cls.port = reservation.getsockname()[1]
        cls.url = f"http://127.0.0.1:{cls.port}/mcp"
        env = {key: value for key, value in os.environ.items() if not key.startswith("STEWARD_MCP_")}
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        if cls.token:
            env["STEWARD_MCP_BEARER_TOKEN"] = cls.token
        cls.logs = tempfile.TemporaryFile(mode="w+")
        cls.addClassCleanup(cls.logs.close)
        cls.process = subprocess.Popen([sys.executable, "-B", "-m", "integrations.steward_mcp.server",
            "--port", str(cls.port), "--scenario", cls.scenario,
            "--database", str(Path(cls.directory.name) / "runtime.sqlite3")],
            cwd=REPO_ROOT, env=env, stdout=cls.logs, stderr=cls.logs)
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if cls.process.poll() is not None:
                break
            try:
                if httpx.get(cls.url.replace("/mcp", "/healthz"), timeout=0.5, trust_env=False).status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.05)
        cls.logs.seek(0)
        raise AssertionError("MCP server failed to start: " + cls.logs.read())

    @classmethod
    def stop_server(cls):
        if cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)

    async def with_session(self, operation):
        headers = {"Authorization": "Bearer " + self.token} if self.token else {}
        async with httpx.AsyncClient(headers=headers, trust_env=False, timeout=5) as client:
            async with streamable_http_client(self.url, http_client=client) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    return await operation(session)


class TestMCPTransport(HTTPServerFixture):
    def test_discovery_and_representative_invocation_of_every_tool(self):
        async def exercise(session):
            tools = (await session.list_tools()).tools
            self.assertEqual({tool.name for tool in tools}, EXPECTED_TOOLS)
            for tool in tools:
                self.assertFalse(tool.inputSchema.get("additionalProperties", True))
                self.assertTrue(tool.outputSchema)
                self.assertTrue(tool.description)
            report = {"discovered_tools": sorted(tool.name for tool in tools), "results": {}}

            async def call(name, arguments):
                result = await session.call_tool(name, arguments)
                self.assertFalse(result.isError, result.content)
                self.assertTrue(result.structuredContent["success"])
                report["results"][name] = result.structuredContent
                return result.structuredContent

            memory = await call("get_machine_memory", {"machine_id": "WM-001"})
            update = await call("update_machine_memory", {"machine_id": "WM-001", "case_id": "CASE-HTTP",
                "expected_revision": memory["revision"], "idempotency_key": "http-update", "updates": [
                    {"type": "append_failure", "record_id": "FAIL-HTTP", "date": "2026-10-03",
                     "problem": "not draining", "fault_type": "drainage", "evidence": evidence()}]})
            self.assertEqual(update["revision"], memory["revision"] + 1)
            quote = await call("request_service_quote", {"machine_id": "WM-001", "case_id": "CASE-HTTP",
                "provider_id": PROVIDER, "issue_description": "Not draining", "idempotency_key": "http-quote"})
            self.assertEqual(quote["charge_scope"], "VISITING_CHARGE")
            appointment = await call("request_service_appointment", {"machine_id": "WM-001", "case_id": "CASE-HTTP",
                "provider_id": PROVIDER, "quote_id": quote["quote_id"], "requested_slot": SLOT, "idempotency_key": "http-book"})
            self.assertEqual(appointment["booking_status"], "CONFIRMED")
            status = await call("get_service_status", {"reference": {"type": "APPOINTMENT", "id": appointment["appointment_id"]}})
            self.assertEqual(status["provider_status"], "SCHEDULED")
            self.assertNotIn("verified", status)
            if os.environ.get("STEWARD_MCP_TEST_REPORT"):
                Path(os.environ["STEWARD_MCP_TEST_REPORT"]).write_text(json.dumps(report, indent=2))
        asyncio.run(self.with_session(exercise))

    def test_malformed_inputs_return_structured_mcp_errors(self):
        async def exercise(session):
            malformed = [
                ("get_machine_memory", {}),
                ("get_machine_memory", {"machine_id": "../WM-001"}),
                ("get_machine_memory", {"machine_id": "WM-001", "extra": True}),
                ("request_service_quote", {"machine_id": "WM-001", "case_id": "CASE-X", "provider_id": PROVIDER,
                    "issue_description": "Not draining", "idempotency_key": "x", "requires_human": True}),
                ("request_service_appointment", {"machine_id": "WM-001", "case_id": "CASE-X", "provider_id": PROVIDER,
                    "quote_id": "QUOTE-X", "requested_slot": {**SLOT, "end_time": None}, "idempotency_key": "x"}),
                ("update_machine_memory", {"machine_id": "WM-001", "case_id": "CASE-X", "expected_revision": True,
                    "idempotency_key": "x", "updates": []}),
                ("get_service_status", {"reference": {"type": "CASE", "id": "CASE-X"}}),
            ]
            for name, arguments in malformed:
                result = await session.call_tool(name, arguments)
                self.assertTrue(result.isError, (name, result))
                self.assertFalse(result.structuredContent["success"])
                self.assertEqual(result.structuredContent["error"]["code"], "INVALID_ARGUMENT")
        asyncio.run(self.with_session(exercise))

    def test_not_found_and_idempotency_conflict_are_errors(self):
        async def exercise(session):
            missing = await session.call_tool("get_service_status", {"reference": {"type": "APPOINTMENT", "id": "APT-NONE"}})
            self.assertTrue(missing.isError)
            self.assertEqual(missing.structuredContent["error"]["code"], "NOT_FOUND")
            arguments = {"machine_id": "WM-001", "case_id": "CASE-CONFLICT", "provider_id": PROVIDER,
                         "issue_description": "Not draining", "idempotency_key": "conflict-key"}
            await session.call_tool("request_service_quote", arguments)
            conflict = await session.call_tool("request_service_quote", {**arguments, "issue_description": "Leaking"})
            self.assertTrue(conflict.isError)
            self.assertEqual(conflict.structuredContent["error"]["code"], "IDEMPOTENCY_CONFLICT")
        asyncio.run(self.with_session(exercise))

    def test_health_and_transport_host_origin_protection(self):
        health = httpx.get(self.url.replace("/mcp", "/healthz"), trust_env=False)
        self.assertEqual(health.json(), {"status": "ok", "provider_mode": "simulated", "tool_count": 5})
        body = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}}
        headers = {"Accept": "application/json, text/event-stream"}
        bad_origin = httpx.post(self.url, json=body, headers={**headers, "Origin": "https://untrusted.example"}, trust_env=False)
        bad_host = httpx.post(self.url, json=body, headers={**headers, "Host": "untrusted.example"}, trust_env=False)
        self.assertEqual(bad_origin.status_code, 403)
        self.assertEqual(bad_host.status_code, 421)


class TestMCPAuthentication(HTTPServerFixture):
    token = "test-only-token-012345678901234567890123456789"

    def test_missing_and_wrong_tokens_rejected(self):
        for headers in ({}, {"Authorization": "Bearer wrong-token"}):
            response = httpx.post(self.url, json={}, headers=headers, trust_env=False)
            self.assertEqual(response.status_code, 401)

    def test_authenticated_discovery(self):
        async def exercise(session):
            self.assertEqual({tool.name for tool in (await session.list_tools()).tools}, EXPECTED_TOOLS)
        asyncio.run(self.with_session(exercise))


class TestMCPFailureTransport(HTTPServerFixture):
    scenario = "ambiguous_timeout"

    def test_timeout_is_mcp_error_with_unknown_booking_and_no_invented_id(self):
        async def exercise(session):
            quote = await session.call_tool("request_service_quote", {"machine_id": "WM-001", "case_id": "CASE-TIMEOUT",
                "provider_id": PROVIDER, "issue_description": "Not draining", "idempotency_key": "timeout-quote"})
            self.assertFalse(quote.isError)
            arguments = {"machine_id": "WM-001", "case_id": "CASE-TIMEOUT", "provider_id": PROVIDER,
                "quote_id": quote.structuredContent["quote_id"], "requested_slot": SLOT, "idempotency_key": "timeout-book"}
            for _ in range(2):
                result = await session.call_tool("request_service_appointment", arguments)
                self.assertTrue(result.isError)
                self.assertFalse(result.structuredContent["success"])
                self.assertEqual(result.structuredContent["error"]["code"], "OUTCOME_UNKNOWN")
                self.assertEqual(result.structuredContent["provider_booking_status"], "UNKNOWN")
                self.assertNotIn("appointment_id", result.structuredContent)
        asyncio.run(self.with_session(exercise))
