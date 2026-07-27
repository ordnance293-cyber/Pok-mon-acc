"""Dependency-free browser runner for the browser helper contracts."""

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
TEST_PATHS = (
    "/tests/trainer-team.test.html",
    "/tests/smart-hundo.test.html",
)
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
    try:
        browser = find_browser()
        summaries = []
        for test_path in TEST_PATHS:
            url = f"http://127.0.0.1:{server.server_port}{test_path}"
            with tempfile.TemporaryDirectory(prefix="browser-contract-") as profile_dir:
                completed = subprocess.run(
                    [
                        browser,
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
            stdout = completed.stdout.decode("utf-8", errors="replace")
            stderr = completed.stderr.decode("utf-8", errors="replace")
            output = stdout + stderr
            if completed.returncode != 0:
                print(f"{test_path} exited {completed.returncode}\n{output}", file=sys.stderr)
                return completed.returncode
            try:
                status, passed_groups, failed_groups = parse_test_summary(stdout)
            except ValueError as error:
                print(f"Browser harness result error for {test_path}: {error}\n{output}", file=sys.stderr)
                return 1
            summaries.append((test_path, status, passed_groups, failed_groups, output))
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(f"Browser harness error: {error}", file=sys.stderr)
        return 2
    finally:
        server.shutdown()
        server.server_close()

    total_passed = sum(passed for _path, _status, passed, _failed, _output in summaries)
    total_failed = sum(failed for _path, _status, _passed, failed, _output in summaries)
    failures = [
        (path, status, passed, failed, output)
        for path, status, passed, failed, output in summaries
        if status != "pass" or passed <= 0 or failed != 0
    ]
    if failures:
        for path, status, passed, failed, output in failures:
            print(
                f"Browser tests for {path} reported status={status!r}, passed={passed}, failed={failed}\n{output}",
                file=sys.stderr,
            )
        return 1
    print(
        "Browser helper tests passed: "
        f"{total_passed} test groups; failed test groups: {total_failed}; "
        "OpenAI requests: 0 (mocked)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
