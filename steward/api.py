"""Small localhost JSON HTTP boundary over the existing Steward application.

Run: python3 -B -m steward.api --port 8000
No third-party dependencies; intended for the local competition demo only.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from pathlib import Path
import re
from urllib.parse import urlsplit

from steward.demo_application import DemoApplication, SCENARIOS
from steward.states import StewardStateError

LOG = logging.getLogger(__name__)
DEFAULT_RUNTIME = Path(__file__).resolve().parents[1] / "tmp" / "ui_runtime" / "machines"


class RequestError(ValueError):
    pass


def validate(body: dict, required: dict, optional: dict | None = None) -> dict:
    optional = optional or {}
    if set(body) - set(required) - set(optional):
        raise RequestError("Unexpected request fields")
    for key, kind in (required | optional).items():
        if key not in body:
            if key in required:
                raise RequestError(f"Missing field: {key}")
            continue
        if type(body[key]) is not kind:
            raise RequestError(f"{key} must be {kind.__name__}")
        if kind is str and (not body[key].strip() or len(body[key]) > 2000):
            raise RequestError(f"{key} must be non-empty and no longer than 2000 characters")
    return body


def make_server(application: DemoApplication, port: int = 8000) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            LOG.info(format, *args)

        def _reply(self, status: int, data: dict) -> None:
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(payload)

        def _body(self) -> dict:
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise RequestError("Content-Type must be application/json")
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 65536:
                    raise RequestError("JSON body must be between 1 and 65536 bytes")
                body = json.loads(self.rfile.read(size))
            except (ValueError, UnicodeDecodeError) as exc:
                raise RequestError("Invalid JSON request body") from exc
            if not isinstance(body, dict):
                raise RequestError("Expected a JSON object")
            return body

        def _dispatch(self) -> None:
            try:
                # Same-origin Vite proxy; no broad CORS or remote exposure.
                host = urlsplit("http://" + self.headers.get("Host", "")).hostname
                origin = self.headers.get("Origin")
                if host not in ("localhost", "127.0.0.1", "::1") or (origin and
                    (urlsplit(origin).hostname not in ("localhost", "127.0.0.1", "::1")
                     or urlsplit(origin).scheme != "http")):
                    self._reply(403, {"error": {"code": "LOCAL_ONLY", "message": "This demo accepts localhost requests only"}})
                    return
                path = urlsplit(self.path).path
                body = self._body() if self.command == "POST" else {}
                with application.lock:
                    status, response = self._route(path, body)
                self._reply(status, response)
            except RequestError as exc:
                self._reply(422, {"error": {"code": "INVALID_REQUEST", "message": str(exc)}})
            except (LookupError, FileNotFoundError) as exc:
                self._reply(404, {"error": {"code": "NOT_FOUND", "message": str(exc)}})
            except (StewardStateError, ValueError) as exc:
                LOG.warning("Request rejected: %s", exc)
                self._reply(409, {"error": {"code": "DOMAIN_REJECTED", "message": str(exc)}})
            except Exception:
                LOG.exception("Steward request failed")
                self._reply(500, {"error": {"code": "INTERNAL_ERROR", "message": "Backend operation failed. Refresh the case before retrying."}})

        def _route(self, path: str, body: dict) -> tuple[int, dict]:
            if self.command == "GET" and path == "/api/health":
                return 200, {"status": "ok", "mode": "local_demo", "external_rails": "mock", "scenarios": SCENARIOS}
            if self.command == "GET" and (match := re.fullmatch(r"/api/machines/([A-Za-z0-9_-]+)", path)):
                return 200, application.machine(match[1])
            if self.command == "POST" and path == "/api/cases":
                validate(body, {"machine_id": str, "issue": str}, {"scenario": str})
                if body.get("scenario", "happy") not in SCENARIOS:
                    raise RequestError("Unknown demo scenario")
                return 201, application.create(**body)
            if self.command == "POST" and path == "/api/demo/reset":
                validate(body, {"confirm": bool})
                if body["confirm"] is not True:
                    raise RequestError("Explicit confirmation is required to reset local demo memory")
                return 200, application.reset()
            match = re.fullmatch(r"/api/cases/([A-Za-z0-9_-]+)(?:/(advance-demo|approval|verification))?", path)
            if match:
                case_id, action = match.groups()
                if self.command == "GET" and action is None:
                    return 200, application.snapshot(case_id)
                if self.command == "POST" and action:
                    required = {"approved": bool} if action == "approval" else {"working": bool} if action == "verification" else {}
                    validate(body, required, {"expected_state": str})
                    method = {"advance-demo": application.advance, "approval": application.approve,
                              "verification": application.verify}[action]
                    return 200, method(case_id, **body)
            raise LookupError("API route not found")

        do_GET = _dispatch
        do_POST = _dispatch

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_RUNTIME,
                        help="Isolated demo machine memory; seeded once from canonical data")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    server = make_server(DemoApplication(args.data_dir), args.port)
    LOG.info("Steward local demo API: http://127.0.0.1:%s (external rails are MOCK)", server.server_port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
