"""Dependency-free browser runner for the smart hundo helper contract."""

from __future__ import annotations

import http.server
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import tempfile


ROOT = Path(__file__).resolve().parents[1]
TEST_PATH = "/tests/smart-hundo.test.html"
BROWSER_CANDIDATES = (
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
)
BODY_TAG_RE = re.compile(r"<body\b(?P<attributes>[^>]*)>", re.IGNORECASE)
DATA_TEST_ATTRIBUTE_RE = re.compile(
    r"\bdata-test-(status|passed|failed)\s*=\s*(['\"])(.*?)\2",
    re.IGNORECASE,
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


def parse_test_summary(dom: str) -> tuple[str, int, int]:
    """Read explicit result attributes from the rendered body tag only."""
    body_match = BODY_TAG_RE.search(dom)
    if not body_match:
        raise ValueError("rendered DOM does not contain a body tag")
    attributes = {
        name.lower(): value
        for name, _quote, value in DATA_TEST_ATTRIBUTE_RE.findall(body_match.group("attributes"))
    }
    missing = {"status", "passed", "failed"}.difference(attributes)
    if missing:
        raise ValueError(f"rendered body is missing data-test attributes: {', '.join(sorted(missing))}")
    try:
        passed = int(attributes["passed"])
        failed = int(attributes["failed"])
    except ValueError as error:
        raise ValueError("rendered test counts must be integers") from error
    if passed < 0 or failed < 0:
        raise ValueError("rendered test counts must be non-negative")
    return attributes["status"], passed, failed


def parser_self_check() -> None:
    sample = '<body data-test-status="pass" data-test-passed="11" data-test-failed="0">PASS FAIL</body>'
    if parse_test_summary(sample) != ("pass", 11, 0):
        raise RuntimeError("browser result parser self-check failed")


def main() -> int:
    parser_self_check()
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
    try:
        status, passed_groups, failed_groups = parse_test_summary(stdout)
    except ValueError as error:
        print(f"Browser harness result error: {error}\n{output}", file=sys.stderr)
        return 1
    if status != "pass" or failed_groups != 0:
        print(
            f"Browser tests reported status={status!r}, passed={passed_groups}, failed={failed_groups}\n{output}",
            file=sys.stderr,
        )
        return 1
    print(
        "Smart hundo browser tests passed: "
        f"{passed_groups} test groups; failed test groups: {failed_groups}; "
        "OpenAI requests: 0 (mocked)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
