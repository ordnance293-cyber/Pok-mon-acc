"""Dependency-free browser runner for the smart hundo helper contract."""

from __future__ import annotations

import http.server
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import tempfile


ROOT = Path(__file__).resolve().parents[1]
TEST_PATH = "/tests/smart-hundo.test.html"
BROWSER_CANDIDATES = (
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


def find_browser() -> str:
    for candidate in BROWSER_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    for executable in ("msedge", "chrome", "google-chrome"):
        discovered = shutil.which(executable)
        if discovered:
            return discovered
    raise RuntimeError("No supported local Chrome or Edge executable was found.")


def main() -> int:
    os.chdir(ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}{TEST_PATH}"

    try:
        with tempfile.TemporaryDirectory(prefix="smart-hundo-browser-") as profile_dir:
            completed = subprocess.run(
                [
                    find_browser(),
                    "--headless=new",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--no-first-run",
                    f"--user-data-dir={profile_dir}",
                    "--dump-dom",
                    url,
                ],
                capture_output=True,
                timeout=30,
                check=False,
            )
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(f"Browser harness error: {error}", file=sys.stderr)
        return 2
    finally:
        server.shutdown()
        server.server_close()

    stdout = completed.stdout.decode("utf-8", errors="replace")
    stderr = completed.stderr.decode("utf-8", errors="replace")
    output = stdout + stderr
    if completed.returncode != 0:
        print(output, file=sys.stderr)
        return completed.returncode
    if 'data-test-status="pass"' not in stdout:
        print(output, file=sys.stderr)
        return 1

    passed = stdout.count("PASS ")
    print(f"Smart hundo browser tests passed: {passed} assertions groups; OpenAI requests: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
