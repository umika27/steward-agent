"""Single-instance SQLite transactions for facts and persistent replay receipts."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import sqlite3

from .schemas import ToolFailure


def encode(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def fingerprint(value) -> str:
    return hashlib.sha256(encode(value).encode()).hexdigest()


class Storage:
    def __init__(self, database: Path):
        self.database = database.expanduser().resolve()
        # Config validates the path before the application creates storage.
        from .config import Config
        Config(database=self.database)
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with self.read() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS machines (
                    machine_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                    document TEXT NOT NULL, observed_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS provider_records (
                    kind TEXT NOT NULL, reference_id TEXT NOT NULL,
                    document TEXT NOT NULL, PRIMARY KEY(kind, reference_id)
                );
                CREATE TABLE IF NOT EXISTS receipts (
                    operation TEXT NOT NULL, idempotency_key TEXT NOT NULL,
                    fingerprint TEXT NOT NULL, response TEXT NOT NULL,
                    PRIMARY KEY(operation, idempotency_key)
                );
            """)

    def connect(self):
        connection = sqlite3.connect(self.database, timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout=10000")
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    @contextmanager
    def transaction(self):
        connection = self.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    @contextmanager
    def read(self):
        connection = self.connect()
        try:
            yield connection
        finally:
            connection.close()

    @staticmethod
    def machine(connection, machine_id):
        row = connection.execute("SELECT * FROM machines WHERE machine_id=?", (machine_id,)).fetchone()
        if row is None:
            raise ToolFailure("NOT_FOUND", "Machine not found")
        return row, json.loads(row["document"])

    @staticmethod
    def provider_record(connection, kind, reference_id):
        row = connection.execute(
            "SELECT document FROM provider_records WHERE kind=? AND reference_id=?", (kind, reference_id)
        ).fetchone()
        if row is None:
            raise ToolFailure("NOT_FOUND", "Provider reference not found")
        return json.loads(row["document"])

    @staticmethod
    def put_provider_record(connection, kind, reference_id, document):
        connection.execute("INSERT INTO provider_records VALUES (?, ?, ?)", (kind, reference_id, encode(document)))

    @staticmethod
    def replay(connection, operation, request):
        row = connection.execute(
            "SELECT * FROM receipts WHERE operation=? AND idempotency_key=?",
            (operation, request["idempotency_key"]),
        ).fetchone()
        if row is None:
            return None
        if row["fingerprint"] != fingerprint(request):
            raise ToolFailure("IDEMPOTENCY_CONFLICT", "Idempotency key already used with different operation arguments")
        response = json.loads(row["response"])
        response["replayed"] = True
        return response

    @staticmethod
    def receipt(connection, operation, request, response):
        connection.execute("INSERT INTO receipts VALUES (?, ?, ?, ?)",
                           (operation, request["idempotency_key"], fingerprint(request), encode(response)))
