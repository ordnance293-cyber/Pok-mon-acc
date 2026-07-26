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
SMART_HUNDO_HELPERS = ROOT / "smart-hundo-helpers.js"
TRAINER_TEAM_HELPERS = ROOT / "trainer-team-helpers.js"
MANUAL_ACCEPTANCE_DOC = ROOT / "docs" / "manual-tests" / "smart-hundo-state-pipeline-v2.md"
CLASSIFICATION_PROMPT_HASH = "506a97e67e8505912b261e82410ef7696f9e7ba0ced045af2971d5e90fc76740"
CLASSIFICATION_PROMPT_LENGTH = 2728
EXTRACTION_PROMPT_HASH = "1b061471ee97eeb1f6e0e9061acc8d6150b386fe6b46e4350b23b658a708b669"
EXTRACTION_PROMPT_LENGTH = 4643
RESIZED_IMAGE_FUNCTION_HASH = "c4baf69d9b7a67771b356642bf549806254fe48a676952986150eb616a93daf4"
RESIZED_IMAGE_FUNCTION_LENGTH = 1276
SAVE_ACCOUNT_HASH = "3cc797671ec130054e89fb4e8ad5ef2c08d7c5d4a1da51d6b3e06be353a56d7d"
SAVE_ACCOUNT_LENGTH = 11158
NEW_ITEM_HASH = "5f7736d381b8c5f3914db57f5e1b9f33e358b205be918c314a3df6da6d07e2c4"
NEW_ITEM_LENGTH = 1666
GENERATE_TEXT_HASH = "9d288f3924c6a8d397546900c558f5335f0dfa5dde536249355850aff15a7eff"
GENERATE_TEXT_LENGTH = 4589
HUNDO_COUNT_HELPERS_HASH = "218f80f1c30bc6247f214cc62e7a2959b3c16d33b061c01af1445a669e38152d"
HUNDO_COUNT_HELPERS_LENGTH = 4332
HUNDO_COUNT_SCHEMA_HASH = "98a1d9191cf3aef23a34b2613edace96db7ae0664e9a26e422ef63c91e60eac5"
HUNDO_COUNT_SCHEMA_LENGTH = 1128
HUNDO_COUNT_PROMPT_HASH = "d93623450e28e7da3672ed22cd9b5c4b7a2f6d2cdb5609e58f4637a92e33b307"
HUNDO_COUNT_PROMPT_LENGTH = 856
TRAINER_TEAM_HELPERS_HASH = "bb34294f7f5359292add2cb930f73250b5eb91e5037f90e9fefd63e3c193aa18"
TRAINER_TEAM_HELPERS_LENGTH = 12158
SMART_HUNDO_SCHEMA_HASH = "a48c2113d70b1ef67be8f5c1bf02f258fdaae774d0e4fe982212392619f87094"
SMART_HUNDO_SCHEMA_LENGTH = 8388


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


def ordinary_function_span(source: str, start: str, label: str) -> str:
    """Return one top-level ordinary function, excluding later V2-only helpers."""
    start_index = source.find(start)
    if start_index < 0:
        raise AssertionError(f"{label}: start marker not found: {start!r}")
    end_match = re.search(r"\n        (?:const|window\.)", source[start_index + len(start):])
    if not end_match:
        raise AssertionError(f"{label}: following declaration not found")
    end_index = start_index + len(start) + end_match.start()
    return source[start_index:end_index]


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


def require_occurrences(source: str, fragment: str, minimum: int, label: str) -> None:
    actual = source.count(fragment)
    if actual < minimum:
        raise AssertionError(
            f"{label}: expected at least {minimum} occurrences of {fragment!r}, got {actual}"
        )


def assert_forbidden(source: str, forbidden: tuple[str, ...], label: str) -> None:
    for term in forbidden:
        if term in source:
            raise AssertionError(f"{label}: forbidden source fragment {term!r} is present")


def assert_forbidden_identifiers(source: str, forbidden: tuple[str, ...], label: str) -> None:
    for identifier in forbidden:
        if re.search(rf"(?<![\w$]){re.escape(identifier)}(?![\w$])", source):
            raise AssertionError(f"{label}: forbidden identifier {identifier!r} is present")


def assert_manual_acceptance_doc() -> None:
    if not MANUAL_ACCEPTANCE_DOC.is_file():
        raise AssertionError(f"manual acceptance document does not exist: {MANUAL_ACCEPTANCE_DOC}")
    document = normalized_source(MANUAL_ACCEPTANCE_DOC)
    for fragment in (
        "hundo_leg=3\npokemon_list=鳳王,哲爾尼亞斯,雷吉奇卡斯",
        "藏瑪然特*2,拉帝亞斯,蒼響,固拉多,酋雷姆",
        "鳳王*2,閃電鳥,蒼響,蓋歐卡,炎帝",
        "12+ full/partial cards all represented",
        "strong two-card overlap removed; legitimate duplicates retained",
        "固拉多*3",
        "固拉多,色違固拉多,特別背卡固拉多",
    ):
        require_fragment(document, fragment, "manual acceptance document")


def assert_script_before_module(source: str, script_name: str) -> None:
    script_marker = f'<script src="{script_name}"></script>'
    script_index = source.find(script_marker)
    module_index = source.find('<script type="module">')
    if script_index < 0:
        raise AssertionError(f"missing required script {script_marker!r}")
    if module_index < 0:
        raise AssertionError("module script marker is missing")
    if script_index >= module_index:
        raise AssertionError(f"{script_name} must load before the module script")


def assert_trainer_diagnostics_and_logging_are_safe(source: str, console_arguments: str) -> None:
    safe_error_summary = ordinary_function_span(
        source,
        "        const safeTrainerTeamErrorSummary =",
        "safe trainer-team error summary",
    )
    diagnostics_shape = source_span(
        source,
        "                    const trainerTeamDiagnostics = {",
        "\n                    publishTrainerTeamDiagnostics(",
        "trainer-team diagnostics shape",
        include_end=False,
    )
    require_fragment(
        source,
        "console.warn('Trainer team operation failed', summary);",
        "trainer-team safe logging",
    )
    assert_forbidden_identifiers(
        "\n".join((safe_error_summary, diagnostics_shape, console_arguments)),
        (
            "apiKey", "authorization", "dataUrl", "originalDataUrl",
            "classificationDataUrl", "trainerTeamEvidenceDataUrl",
            "file", "request", "response", "headers", "body", "payload",
            "credentials", "password", "firebaseConfig", "gasUrl",
        ),
        "trainer-team diagnostics/log source",
    )
    assert_forbidden(
        "\n".join((safe_error_summary, diagnostics_shape, console_arguments)),
        (
            "Authorization", "data:image/", "File",
            "credentials", "password", "firebaseConfig", "Firebase",
            "gasUrl", "GAS",
        ),
        "trainer-team diagnostics/log source",
    )
    assert_forbidden_identifiers(console_arguments, ("error",), "console arguments")


def main() -> int:
    source = normalized_source(INDEX_HTML)
    helpers_source = normalized_source(SMART_HUNDO_HELPERS)
    trainer_helpers_source = normalized_source(TRAINER_TEAM_HELPERS)
    checks: list[tuple[str, Callable[[], object]]] = []

    classification_prompt = source_span(
        source,
        "        const buildAiClassificationPrompt =",
        "\n        const buildAiExtractionPrompt =",
        "ordinary classification prompt",
        include_end=False,
    )
    extraction_prompt = source_span(
        source,
        "        const buildAiExtractionPrompt =",
        "\n        const buildSmartHundoPrompt =",
        "ordinary extraction prompt",
        include_end=False,
    )
    resized_image_function = ordinary_function_span(
        source,
        "        const fileToResizedDataUrl =",
        "ordinary resized-image function",
    )
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
        "        window.saveAccountToInventory = async function() {",
        "\n        window.deleteAccount = async function",
        "Firebase/GAS save path",
        include_end=False,
    )
    smart_schema = source_span(
        source,
        "        const HUNDO_SMART_SCHEMA = {",
        "\n        const toggleAiActionButtons =",
        "V2 smart-hundo schema",
        include_end=False,
    )
    hundo_count_helpers = source_span(
        helpers_source,
        "    const normalizeHundoCountResult =",
        "\n    const normalizeCoordinate =",
        "hundo-count helpers",
        include_end=False,
    )
    hundo_count_schema = source_span(
        source,
        "        const HUNDO_COUNT_SCHEMA = {",
        "\n        const HUNDO_SMART_SCHEMA =",
        "hundo-count schema",
        include_end=False,
    )
    hundo_count_prompt = source_span(
        source,
        "        const buildHundoCountPrompt =",
        "\n        const fileToOriginalDataUrl =",
        "hundo-count prompt",
        include_end=False,
    )
    safe_error_summary = source_span(
        source,
        "        const safeSmartHundoErrorSummary =",
        "\n        const parseNum =",
        "safe smart-hundo error summary",
        include_end=False,
    )
    smart_diagnostics_call = source_span(
        source,
        "                    const diagnostics = helpers.shapeSmartHundoDiagnostics({",
        "\n                    publishSmartHundoDiagnostics(smartSessionId, diagnostics);",
        "smart-hundo diagnostics call",
        include_end=False,
    )
    smart_diagnostics_shape = source_span(
        helpers_source,
        "    const diagnosticCard =",
        "\n    const validateSmartHundoStructure =",
        "smart-hundo diagnostics shape",
        include_end=False,
    )
    console_arguments = "\n".join(re.findall(
        r"console\.(?:log|warn|error)\((.*?)\);",
        source,
        flags=re.DOTALL,
    ))

    checks.extend([
        ("trainer-team helper loads before the production module", lambda: assert_script_before_module(
            source,
            "trainer-team-helpers.js",
        )),
        ("hundo-count helpers have the origin/main snapshot", lambda: assert_snapshot(
            "hundo-count helpers",
            hundo_count_helpers,
            HUNDO_COUNT_HELPERS_HASH,
            HUNDO_COUNT_HELPERS_LENGTH,
        )),
        ("hundo-count schema has the origin/main snapshot", lambda: assert_snapshot(
            "hundo-count schema",
            hundo_count_schema,
            HUNDO_COUNT_SCHEMA_HASH,
            HUNDO_COUNT_SCHEMA_LENGTH,
        )),
        ("hundo-count prompt has the origin/main snapshot", lambda: assert_snapshot(
            "hundo-count prompt",
            hundo_count_prompt,
            HUNDO_COUNT_PROMPT_HASH,
            HUNDO_COUNT_PROMPT_LENGTH,
        )),
        ("whole trainer-team helper has the origin/main snapshot", lambda: assert_snapshot(
            "whole trainer-team helper",
            trainer_helpers_source,
            TRAINER_TEAM_HELPERS_HASH,
            TRAINER_TEAM_HELPERS_LENGTH,
        )),
        ("smart-hundo schema span has the origin/main snapshot", lambda: assert_snapshot(
            "smart-hundo schema span",
            smart_schema,
            SMART_HUNDO_SCHEMA_HASH,
            SMART_HUNDO_SCHEMA_LENGTH,
        )),
        ("ordinary classification prompt has the origin/main snapshot", lambda: assert_snapshot(
            "ordinary classification prompt",
            classification_prompt,
            CLASSIFICATION_PROMPT_HASH,
            CLASSIFICATION_PROMPT_LENGTH,
        )),
        ("ordinary extraction prompt has the origin/main snapshot", lambda: assert_snapshot(
            "ordinary extraction prompt",
            extraction_prompt,
            EXTRACTION_PROMPT_HASH,
            EXTRACTION_PROMPT_LENGTH,
        )),
        ("ordinary resize function has the origin/main snapshot", lambda: assert_snapshot(
            "ordinary resized-image function",
            resized_image_function,
            RESIZED_IMAGE_FUNCTION_HASH,
            RESIZED_IMAGE_FUNCTION_LENGTH,
        )),
        ("Firebase/GAS/manual save path has the origin/main snapshot", lambda: assert_snapshot(
            "Firebase/GAS/manual save path",
            save_account,
            SAVE_ACCOUNT_HASH,
            SAVE_ACCOUNT_LENGTH,
        )),
        ("newItem literal has the pre-feature snapshot", lambda: assert_snapshot(
            "newItem literal", new_item, NEW_ITEM_HASH, NEW_ITEM_LENGTH
        )),
        ("generateText has the pre-feature snapshot", lambda: assert_snapshot(
            "generateText function", generate_text, GENERATE_TEXT_HASH, GENERATE_TEXT_LENGTH
        )),
        ("ordinary prompt contracts remain explicitly locked", lambda: [
            require_fragment(classification_prompt, "你只能做第一階段分類，禁止抽取數字", "classification prompt"),
            require_fragment(extraction_prompt, "你現在只能做第二階段抽值，禁止重新分類", "extraction prompt"),
            require_fragment(extraction_prompt, "case 'TRAINER_PROFILE_SCREEN':", "profile extraction path"),
            require_fragment(extraction_prompt, "case 'RESOURCE_SCREEN':", "resource extraction path"),
        ]),
        ("trainer-team strict schema and fixed-UI prompt contracts exist", lambda: [
            require_fragment(source, "const TRAINER_TEAM_SCHEMA = {", "trainer-team schema"),
            require_fragment(
                source,
                "name: 'pokemon_go_trainer_team_fixed_ui_extractor'",
                "trainer-team schema name",
            ),
            require_fragment(source, "const buildTrainerTeamPrompt =", "trainer-team prompt"),
            require_fragment(source, "model_team_candidate", "trainer-team model candidate"),
            require_fragment(source, "arrow_or_progress_accent", "trainer-team fixed evidence"),
            require_fragment(source, "yellow UI + blue Dialga", "trainer-team prompt counterexample"),
            require_fragment(source, "red UI + blue/gold Zamazenta", "trainer-team prompt counterexample"),
            require_fragment(source, "body color never overrides fixed UI", "trainer-team prompt authority rule"),
        ]),
        ("trainer-team native PNG and one-request contracts exist", lambda: [
            require_fragment(source, "const buildTrainerTeamEvidenceImage =", "trainer-team evidence image"),
            require_fragment(source, "profile_name_block: { x: 0.02, y: 0.11, width: 0.76, height: 0.22 }", "profile-name crop"),
            require_fragment(source, "level_xp_block: { x: 0, y: 0.55, width: 1, height: 0.34 }", "level/XP crop"),
            require_fragment(source, "canvas.toDataURL('image/png')", "trainer-team lossless PNG"),
            require_fragment(source, "const requestTrainerTeamExtraction =", "trainer-team request"),
            require_fragment(source, "imageDetail: 'high'", "trainer-team high image detail"),
            require_fragment(source, "maxRetries: 1", "trainer-team one-request cap"),
            require_fragment(source, "const runTrainerTeamScan =", "trainer-team per-screenshot scan"),
        ]),
        ("trainer-team ownership stale-write and diagnostics contracts exist", lambda: [
            require_fragment(source, "const beginTrainerTeamScan =", "trainer-team scan ownership"),
            require_fragment(source, "const markTrainerTeamAiValue =", "trainer-team AI ownership"),
            require_fragment(source, "const handleTrainerTeamManualEdit =", "trainer-team manual ownership"),
            require_fragment(source, "const isCurrentTrainerTeamScan =", "trainer-team stale scan guard"),
            require_fragment(source, "const publishTrainerTeamDiagnostics =", "trainer-team diagnostics publisher"),
            require_fragment(source, "const setTrainerTeamStatus =", "trainer-team status writer"),
            require_fragment(source, "window.lastTrainerTeamDiagnostics", "trainer-team public diagnostics"),
            require_fragment(source, "id=\"trainerTeamStatus\"", "trainer-team status UI"),
        ]),
        ("ordinary profile allowed fields are exactly level and XP", lambda: require_fragment(
            source,
            "TRAINER_PROFILE_SCREEN: ['level', 'xp']",
            "ordinary profile allowed fields",
        )),
        ("ordinary profile expected and retry fields are exactly level and XP", lambda: require_occurrences(
            source,
            "TRAINER_PROFILE_SCREEN: ['level', 'xp']",
            3,
            "ordinary profile allowed/expected/retry lists",
        )),
        ("ordinary source priority and autofill give team no authority", lambda: [
            assert_forbidden(
                source_span(
                    source,
                    "        const AI_FIELD_SOURCE_PRIORITY = {",
                    "\n        const AI_FIELD_LABELS =",
                    "ordinary field source priority",
                    include_end=False,
                ),
                ("team: { TRAINER_PROFILE_SCREEN",),
                "ordinary field source priority",
            ),
            assert_forbidden(
                source_span(
                    source,
                    "        const AI_AUTOFILL_FIELD_TO_INPUT = {",
                    "\n        const AI_PROTECTED_INPUT_IDS =",
                    "ordinary autofill mapping",
                    include_end=False,
                ),
                ("team: 'g_team'",),
                "ordinary autofill mapping",
            ),
        ]),
        ("ordinary required-field coverage gives team no authority", lambda: assert_forbidden(
            source_span(
                source,
                "        const AI_REQUIRED_VALIDATION_FIELDS = [",
                "\n        const AI_REQUIRED_VALIDATION_PASSES =",
                "ordinary required-field coverage",
                include_end=False,
            ),
            ("'team'",),
            "ordinary required-field coverage",
        )),
        ("OpenAI endpoint, model, and image-processing settings remain locked", lambda: [
            require_fragment(
                source,
                "const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';",
                "OpenAI endpoint",
            ),
            require_fragment(source, "const OPENAI_MODEL = 'gpt-4.1-mini';", "OpenAI model"),
            require_fragment(source, "const AI_MAX_IMAGE_SIZE = 1000;", "maximum image size"),
            require_fragment(source, "const AI_JPEG_QUALITY = 0.7;", "JPEG quality"),
            require_fragment(source, "const AI_IMAGE_DETAIL = 'auto';", "normal image detail"),
            require_fragment(
                resized_image_function,
                "canvas.toDataURL('image/jpeg', AI_JPEG_QUALITY)",
                "ordinary JPEG conversion",
            ),
        ]),
        ("API-key settings keep their current and legacy storage keys", lambda: [
            require_fragment(source, "elementId: 'openaiApiKey', storageKey: 'OPENAI_API_KEY'", "API-key setting"),
            require_fragment(source, "legacyStorageKeys: ['geminiApiKey']", "legacy API-key setting"),
            require_fragment(source, "localStorage.setItem(storageKey, input.value.trim())", "settings persistence"),
        ]),
        ("save, GAS, team, resource, and profile paths remain explicit", lambda: [
            require_fragment(save_account, "team: getVal('g_team')", "team save path"),
            require_fragment(save_account, "stardust: getVal('g_stardust'), xp: getVal('g_xp')", "profile save path"),
            require_fragment(save_account, "rarecandy: getVal('st_rarecandy'), coin: getVal('st_coin')", "resource save path"),
            require_fragment(save_account, "update(ref(db, `inventory/${currentEditUid}`), newItem);", "manual update path"),
            require_fragment(save_account, "push(inventoryRef, newItem);", "manual insert path"),
            require_fragment(
                save_account,
                "body: JSON.stringify({ action: 'add', id: sheetId, accountId: accountId, data: decodeURIComponent(newItem.fullText) })",
                "GAS add payload",
            ),
        ]),
        ("generated copywriting paths remain explicit", lambda: [
            require_fragment(generate_text, "res.push(`${lvlStr}${v('g_team')}`);", "team copywriting"),
            require_fragment(generate_text, "res.push(`經驗 ${xpDisplay}`);", "profile copywriting"),
            require_fragment(generate_text, "res.push(`🎒寶可夢背包 ${v('st_poke_bag')}`)", "resource copywriting"),
            require_fragment(
                generate_text,
                "res.push(`✅${v('st_hundo_leg')}隻百神${listStr}`);",
                "hundo copywriting",
            ),
        ]),
        ("autoScan routes hundo screenshots only through smartHundoScan", lambda: (
            require_fragment(auto_scan, "smartHundoScan({", "smart hundo route"),
            assert_forbidden(auto_scan, ("fullHundoScan",), "autoScan"),
        )),
        ("Firebase/GAS save objects exclude V2 state and audit fields", lambda: assert_forbidden_identifiers(
            save_account,
            (
                "purified", "shadow_state", "purified_state",
                "lastSmartHundoDiagnostics", "lastSmartHundoScanResult",
                "lastTrainerTeamDiagnostics", "trainerTeamDiagnostics",
                "fixed_ui_evidence", "model_team_candidate",
                "effective_color", "validation_reasons", "conflicts",
            ),
            "Firebase/GAS save path",
        )),
        ("V2 smart schema contains only the five-dimension card contract", lambda: (
            require_fragment(smart_schema, "name: 'pokemon_go_hundo_smart_extractor_v2'", "V2 smart schema"),
            require_fragment(smart_schema, "rocket_state:", "V2 rocket dimension"),
            require_fragment(smart_schema, "background_type:", "V2 background dimension"),
            assert_forbidden_identifiers(
                smart_schema,
                ("hundo_leg", "shadow_state", "purified_state", "global"),
                "V2 smart schema",
            ),
        )),
        ("smart diagnostics and logs exclude sensitive structures", lambda: [
            require_fragment(safe_error_summary, "reasonCode:", "safe error summary"),
            require_fragment(source, "console.warn('Smart hundo operation failed', summary);", "smart warning"),
            assert_forbidden_identifiers(
                "\n".join((
                    safe_error_summary,
                    smart_diagnostics_call,
                    smart_diagnostics_shape,
                    console_arguments,
                )),
                (
                    "apiKey", "dataUrl", "originalDataUrl", "classificationDataUrl",
                    "file", "request", "response", "headers", "body", "payload",
                    "authorization", "credentials", "password",
                ),
                "smart diagnostics/log source",
            ),
            assert_forbidden_identifiers(
                console_arguments,
                ("error",),
                "console arguments",
            ),
        ]),
        ("trainer-team diagnostics and logs exclude sensitive structures", lambda: (
            assert_trainer_diagnostics_and_logging_are_safe(source, console_arguments)
        )),
        ("manual V2 acceptance document has required exact outcomes", assert_manual_acceptance_doc),
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
        forbidden = (
            "purified", "shadow_state", "purified_state",
            "lastSmartHundoDiagnostics", "lastSmartHundoScanResult",
            "lastTrainerTeamDiagnostics", "trainerTeamDiagnostics",
            "fixed_ui_evidence", "model_team_candidate",
            "effective_color", "validation_reasons", "conflicts",
        )
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
