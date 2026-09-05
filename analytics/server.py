#!/usr/bin/env python3
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOWED_KINDS = {
    "qr", "rmqr", "microqr", "datamatrix", "aztec", "pdf417",
    "ean13", "upca", "ean8", "itf14", "code128",
}
DATABASE_PATH = os.environ.get(
    "CODEFORM_ANALYTICS_DATABASE",
    "/var/lib/codeform-analytics/analytics.sqlite3",
)
LISTEN_HOST = os.environ.get("CODEFORM_ANALYTICS_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("CODEFORM_ANALYTICS_PORT", "3101"))


def connect():
    database = sqlite3.connect(DATABASE_PATH, timeout=5)
    database.row_factory = sqlite3.Row
    database.execute("PRAGMA journal_mode=WAL")
    database.execute("PRAGMA busy_timeout=5000")
    database.execute(
        """
        CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'generation')),
            barcode_kind TEXT,
            country TEXT NOT NULL,
            occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    database.execute(
        "CREATE INDEX IF NOT EXISTS analytics_events_type_time_idx "
        "ON analytics_events (event_type, occurred_at)"
    )
    return database


class AnalyticsHandler(BaseHTTPRequestHandler):
    server_version = "CodeformAnalytics"

    def log_message(self, _format, *_args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "private, no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/event":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length < 2 or length > 1024:
                raise ValueError("invalid body length")
            payload = json.loads(self.rfile.read(length))
            event_type = payload.get("event")
            barcode_kind = payload.get("barcodeKind")
            country = payload.get("country")
            if event_type not in {"visit", "generation"}:
                raise ValueError("invalid event")
            if event_type == "generation" and barcode_kind not in ALLOWED_KINDS:
                raise ValueError("invalid barcode kind")
            if event_type == "visit":
                barcode_kind = None
            if not isinstance(country, str) or len(country) != 2 or not country.isalnum():
                country = "XX"
        except (ValueError, json.JSONDecodeError, AttributeError):
            self.send_json(400, {"error": "invalid event"})
            return

        with connect() as database:
            database.execute(
                "INSERT INTO analytics_events (event_type, barcode_kind, country) VALUES (?, ?, ?)",
                (event_type, barcode_kind, country.upper()),
            )
            database.execute(
                "DELETE FROM analytics_events WHERE occurred_at < datetime('now', '-90 days')"
            )
        self.send_response(204)
        self.send_header("cache-control", "no-store")
        self.end_headers()

    def do_GET(self):
        if self.path != "/summary":
            self.send_error(404)
            return
        with connect() as database:
            totals = database.execute(
                """
                SELECT
                    SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visits,
                    SUM(CASE WHEN event_type = 'generation' THEN 1 ELSE 0 END) AS generations
                FROM analytics_events
                """
            ).fetchone()
            formats = database.execute(
                """
                SELECT barcode_kind AS barcodeKind, COUNT(*) AS count
                FROM analytics_events
                WHERE event_type = 'generation'
                GROUP BY barcode_kind
                ORDER BY count DESC, barcode_kind ASC
                """
            ).fetchall()
            visits = database.execute(
                """
                SELECT id, country, occurred_at AS occurredAt
                FROM analytics_events
                WHERE event_type = 'visit'
                ORDER BY occurred_at DESC, id DESC
                LIMIT 200
                """
            ).fetchall()
        self.send_json(200, {
            "totals": {
                "visits": totals["visits"] or 0,
                "generations": totals["generations"] or 0,
            },
            "formats": [dict(row) for row in formats],
            "visits": [dict(row) for row in visits],
        })


if __name__ == "__main__":
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), AnalyticsHandler).serve_forever()
