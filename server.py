#!/usr/bin/env python3
"""BEYBOM Dev Server — static files + auto-save to state/state.json with backup rotation."""
import http.server
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
STATE_DIR = Path("state")
STATE_FILE = STATE_DIR / "state.json"
BACKUP_DIR = STATE_DIR / "backup"
MAX_BACKUPS = 20


class BeybomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/state/state.json":
            self._handle_save()
        else:
            self.send_error(404, "Not Found")

    def _handle_save(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # Validate JSON
            json.loads(body)

            # Ensure dirs exist
            STATE_DIR.mkdir(exist_ok=True)
            BACKUP_DIR.mkdir(exist_ok=True)

            # Backup current state.json if it exists
            if STATE_FILE.exists():
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = BACKUP_DIR / f"state_{ts}.json"
                shutil.copy2(STATE_FILE, backup_path)

                # Prune: keep only newest MAX_BACKUPS
                backups = sorted(BACKUP_DIR.glob("state_*.json"))
                while len(backups) > MAX_BACKUPS:
                    backups.pop(0).unlink()

            # Write new state
            STATE_FILE.write_bytes(body)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print(f"  ✓ Saved state.json ({len(body)} bytes)")

        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
        except Exception as e:
            self.send_error(500, str(e))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        if "state.json" in str(args) or "POST" in str(args):
            super().log_message(format, *args)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    server = http.server.HTTPServer(("", PORT), BeybomHandler)
    print(f"BEYBOM Dev Server on http://localhost:{PORT}")
    print(f"  State:  {STATE_FILE}")
    print(f"  Backup: {BACKUP_DIR}/ (max {MAX_BACKUPS})")
    print(f"  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
