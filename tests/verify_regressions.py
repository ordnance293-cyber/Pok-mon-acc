"""Deterministic source locks for the smart-hundo scan change.

This is intentionally static: it protects existing save/copy behavior and the
production routing/persistence boundaries without requiring an API key, browser,
or network request.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
import re
import sys
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
NEW_ITEM_HASH = "5f7736d381b8c5f3914db57f5e1b9f33e358b205be918c314a3df6da6d07e2c4"
NEW_ITEM_LENGTH = 1666
GENERATE_TEXT_HASH = "9d288f3924c6a8d397546900c558f5335f0dfa5dde536249355850aff15a7eff"


def normalized_source(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")


def source_span(source: str, start: str, end: str, label: str, *, include_end: bool) -> str:
    start_index = source.find(start)
    if start_index < 0:
        raise AssertionError(f"{label}: start marker not found: {start!r}")
    end_index = source.find(end, start_index + len(start))
    if end_index < 0:
        raise AssertionError(f"{label}: end marker not found: {end!r}")
    return source[start_index:end_index + len(end) if include_end else end_index]


def assert_snapshot(name: str, value: str, expected_hash: str, expected_length: int | None = None) -> None:
    actual_length = len(value)
    actual_hash = hashlib.sha256(value.encode("utf-8")).hexdigest()
    if actual_hash != expected_hash:
        raise AssertionError(
            f"{name}: expected SHA-256 {expected_hash}, got {actual_hash} (length {actual_length})"
        )
    if expected_length is not None and actual_length != expected_length:
        raise AssertionError(f"{name}: expected length {expected_length}, got {actual_length}")


def require_fragment(source: str, fragment: str, label: str) -> None:
    if fragment not in source:
        raise AssertionError(f"{label}: missing required source fragment {fragment!r}")


def assert_forbidden(source: str, forbidden: tuple[str, ...], label: str) -> None:
    for term in forbidden:
        if term in source:
            raise AssertionError(f"{label}: forbidden source fragment {term!r} is present")


def main() -> int:
    source = normalized_source(INDEX_HTML)
    checks: list[tuple[str, Callable[[], object]]] = []

    new_item = source_span(
        source,
        "            const newItem = {",
        "\n            };",
        "newItem literal",
        include_end=True,
    )
    generate_text = source_span(
        source,
        "        window.generateText = function() {",
        "\n        window.copyInventoryText",
        "generateText function",
        include_end=False,
    )
    auto_scan = source_span(
        source,
        "window.autoScan = async function() {",
        "\n        window.analyzeMultipleImages = window.autoScan;",
        "autoScan function",
        include_end=False,
    )
    save_account = source_span(
        source,
        "window.saveAccountToInventory = async function() {",
        "\n        window.deleteAccount = async function",
        "Firebase/GAS save path",
        include_end=False,
    )

    checks.extend([
        ("newItem literal has the pre-feature snapshot", lambda: assert_snapshot(
            "newItem literal", new_item, NEW_ITEM_HASH, NEW_ITEM_LENGTH
        )),
        ("generateText has the pre-feature snapshot", lambda: assert_snapshot(
            "generateText function", generate_text, GENERATE_TEXT_HASH
        )),
        ("OpenAI model and image-processing settings remain locked", lambda: [
            require_fragment(source, "const OPENAI_MODEL = 'gpt-4.1-mini';", "OpenAI model"),
            require_fragment(source, "const AI_MAX_IMAGE_SIZE = 1000;", "maximum image size"),
            require_fragment(source, "const AI_JPEG_QUALITY = 0.7;", "JPEG quality"),
            require_fragment(source, "const AI_IMAGE_DETAIL = 'auto';", "normal image detail"),
        ]),
        ("API-key settings keep their current and legacy storage keys", lambda: [
            require_fragment(source, "elementId: 'openaiApiKey', storageKey: 'OPENAI_API_KEY'", "API-key setting"),
            require_fragment(source, "legacyStorageKeys: ['geminiApiKey']", "legacy API-key setting"),
            require_fragment(source, "localStorage.setItem(storageKey, input.value.trim())", "settings persistence"),
        ]),
        ("autoScan routes hundo screenshots only through smartHundoScan", lambda: (
            require_fragment(auto_scan, "smartHundoScan({", "smart hundo route"),
            assert_forbidden(auto_scan, ("fullHundoScan",), "autoScan"),
        )),
        ("Firebase/GAS save objects exclude smart audit and purified fields", lambda: assert_forbidden(
            save_account, ("purified", "lastSmartHundoScanResult"), "Firebase/GAS save path"
        )),
    ])

    failures: list[str] = []
    for label, check in checks:
        try:
            check()
        except AssertionError as error:
            failures.append(f"FAIL: {label}\n  {error}")
        else:
            print(f"PASS: {label}")

    # Every GAS JSON object is deliberately small and shallow. Verify none can
    # serialize the in-memory smart-audit state or a per-card purified flag.
    gas_objects = re.findall(r"body:\s*JSON\.stringify\((\{[^{}]*\})\)", source, flags=re.DOTALL)
    if not gas_objects:
        failures.append("FAIL: GAS payload audit\n  no JSON.stringify object payloads were found")
    else:
        forbidden = ("purified", "lastSmartHundoScanResult")
        leaking = [payload for payload in gas_objects if any(term in payload for term in forbidden)]
        if leaking:
            failures.append("FAIL: GAS payload audit\n  a GAS payload contains a forbidden audit/card field")
        else:
            print("PASS: GAS JSON payloads exclude smart audit and purified fields")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"Source regression checks passed: {len(checks) + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
