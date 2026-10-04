"""Atomic shipment facts and redacted call evidence, isolated from Steward."""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3

def now(): return datetime.now(timezone.utc).isoformat()
def digest(value): return hashlib.sha256(value.encode()).hexdigest()

class Conflict(Exception): pass

class Storage:
    def __init__(self, path):
        self.path = Path(path).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Create with restrictive permissions before SQLite opens the file.
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600); os.close(fd)
        os.chmod(self.path, 0o600)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS shipments (
                  order_id TEXT PRIMARY KEY, waybill TEXT UNIQUE NOT NULL,
                  payload TEXT NOT NULL, scenario TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS scans (
                  id INTEGER PRIMARY KEY, waybill TEXT NOT NULL,
                  scenario TEXT NOT NULL, observed_at TEXT NOT NULL,
                  UNIQUE(waybill, scenario));
                CREATE TABLE IF NOT EXISTS evidence (
                  id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db: yield db
        finally: db.close()

    def create(self, payload):
        canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        shipment = payload['shipments'][0]; order = shipment['order']
        # 13-digit synthetic SPS number, deterministic from unique order ID.
        waybill = shipment.get('waybill') or str(1000000000000 + int(digest(order), 16) % 9000000000000)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT * FROM shipments WHERE order_id=?', (order,)).fetchone()
            if previous:
                if previous['payload'] != canonical: raise Conflict('Conflicting duplicate order')
                return dict(previous), True
            try:
                db.execute('INSERT INTO shipments VALUES (?,?,?,?,?)',
                           (order, waybill, canonical, 'SHIPMENT_CREATED', now()))
            except sqlite3.IntegrityError: raise Conflict('Waybill already exists') from None
            db.execute('INSERT INTO scans (waybill,scenario,observed_at) VALUES (?,?,?)',
                       (waybill, 'SHIPMENT_CREATED', now()))
            return dict(db.execute('SELECT * FROM shipments WHERE order_id=?', (order,)).fetchone()), False

    def get(self, waybill):
        with self.connect() as db:
            row = db.execute('SELECT * FROM shipments WHERE waybill=?', (waybill,)).fetchone()
            return dict(row) if row else None

    def track(self, waybill, scenario):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('UPDATE shipments SET scenario=? WHERE waybill=?', (scenario, waybill))
            db.execute('INSERT OR IGNORE INTO scans (waybill,scenario,observed_at) VALUES (?,?,?)',
                       (waybill, scenario, now()))
            return [dict(row) for row in db.execute(
                'SELECT scenario,observed_at FROM scans WHERE waybill=? ORDER BY id', (waybill,))]

    def record(self, event):
        with self.connect() as db: db.execute('INSERT INTO evidence (payload) VALUES (?)', (json.dumps(event),))
