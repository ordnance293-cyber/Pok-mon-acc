# Special Research Option Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the inventory form's Special Research section from 11 to 15 options by adding 捷拉奧拉, 色違蒂安希, 蒂安希, and 色違凱路迪歐 while preserving legacy record behavior and all unrelated inventory behavior.

**Architecture:** Keep the existing single-page architecture and current `chk_sp_N` convention. Modify only the Special Research handling in `index.html` and focused regression coverage in `tests/verify_regressions.py`; do not refactor Firebase, Sheets, Smart Hundo, Mega/fusion, pricing, status, or account-management logic.

**Tech Stack:** Static HTML/JavaScript, Firebase Realtime Database, Python regression source-lock tests.

## Global Constraints

- Add exactly four Special Research options: `chk_sp_12 = 捷拉奧拉`, `chk_sp_13 = 色違蒂安希`, `chk_sp_14 = 蒂安希`, `chk_sp_15 = 色違凱路迪歐`.
- Preserve the current Special Research UI layout and styling.
- Expand all existing Special Research numeric ranges from 11 to 15 where they govern save, AI protection, and generated text.
- Restore stored boolean values before using legacy `fullText` inference.
- Legacy `色違蒂安希` must not auto-select normal `蒂安希`.
- Legacy `色違凱路迪歐` must not auto-select normal `凱路迪歐`.
- Existing `凱路迪歐` and `凱路迪歐,瑪夏多` fallback behavior must remain unchanged.
- No Firebase schema migration is required.
- Do not change unrelated behavior.
- Do not require GitHub login; work entirely in the provided Codex workspace.

---

### Task 1: Add focused regression coverage for the 15-option contract

**Files:**
- Modify: `tests/verify_regressions.py`

**Interfaces:**
- Consumes: source text from `index.html` through the existing `normalized_source(INDEX_HTML)` helpers.
- Produces: deterministic assertions that lock the new checkbox markup, the `1..15` persistence/generation ranges, AI protection coverage, and collision-safe legacy fallback logic.

- [ ] **Step 1: Add a new assertion function for the Special Research expansion**

Add a focused function such as `assert_special_research_option_expansion(source: str) -> None` near the other source-contract assertions. It must require all four exact markup fragments:

```python
for fragment in (
    'id="chk_sp_12" value="捷拉奧拉">捷拉奧拉',
    'id="chk_sp_13" value="色違蒂安希">色違蒂安希',
    'id="chk_sp_14" value="蒂安希">蒂安希',
    'id="chk_sp_15" value="色違凱路迪歐">色違凱路迪歐',
):
    require_fragment(source, fragment, "Special Research expansion")
```

Require the save loop, AI-protection range, and generated-text loop to use 15:

```python
require_fragment(
    source,
    "for(let i=1; i<=15; i++) newItem['chk_sp_'+i] = getChk('chk_sp_'+i);",
    "Special Research persistence range",
)
require_fragment(
    source,
    "...Array.from({ length: 15 }, (_, index) => `chk_sp_${index + 1}`),",
    "Special Research AI protection range",
)
require_fragment(
    source,
    "let spList = []; for(let i=1; i<=15; i++){ if(checked('chk_sp_'+i)) spList.push(document.getElementById('chk_sp_'+i).value); }",
    "Special Research generated-text range",
)
```

Require explicit restore lines for `chk_sp_12` through `chk_sp_15`. The normal-form fallbacks must explicitly exclude the corresponding shiny text:

```python
require_fragment(source, "setChk('chk_sp_12'", "Zeraora restore")
require_fragment(source, "setChk('chk_sp_13'", "shiny Diancie restore")
require_fragment(source, "setChk('chk_sp_14'", "Diancie restore")
require_fragment(source, "!txt.includes('色違蒂安希')", "Diancie legacy collision guard")
require_fragment(source, "setChk('chk_sp_15'", "shiny Keldeo restore")
require_fragment(source, "!txt.includes('色違凱路迪歐')", "Keldeo legacy collision guard")
```

Also keep assertions that the existing `chk_sp_3`/`chk_sp_11` Keldeo-Marshadow distinction remains present.

- [ ] **Step 2: Invoke the new assertion from the regression runner**

Find the main regression orchestration in `tests/verify_regressions.py` and call `assert_special_research_option_expansion(index_source)` using the same loaded `index.html` source object already used by neighboring assertions.

- [ ] **Step 3: Run the regression suite and confirm the new test fails before implementation**

Run:

```bash
python tests/verify_regressions.py
```

Expected result: FAIL because `chk_sp_12` through `chk_sp_15` and the `1..15` ranges do not yet exist.

---

### Task 2: Implement the four new Special Research options

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: existing `getChk`, `setChk`, `checked`, `fullText`, `AI_PROTECTED_INPUT_IDS`, and `generateText()` conventions.
- Produces: four new persisted booleans, edit-mode restoration, AI-protected inputs, and generated Special Research text.

- [ ] **Step 1: Add the four checkbox inputs to the existing Special Research block**

Immediately after the existing `chk_sp_11` option, add:

```html
<label class="flex items-center gap-1"><input type="checkbox" id="chk_sp_12" value="捷拉奧拉">捷拉奧拉</label>
<label class="flex items-center gap-1"><input type="checkbox" id="chk_sp_13" value="色違蒂安希">色違蒂安希</label>
<label class="flex items-center gap-1"><input type="checkbox" id="chk_sp_14" value="蒂安希">蒂安希</label>
<label class="flex items-center gap-1"><input type="checkbox" id="chk_sp_15" value="色違凱路迪歐">色違凱路迪歐</label>
```

Do not change the surrounding grid classes or visual design.

- [ ] **Step 2: Expand persistence from 11 to 15**

Change:

```javascript
for(let i=1; i<=11; i++) newItem['chk_sp_'+i] = getChk('chk_sp_'+i);
```

to:

```javascript
for(let i=1; i<=15; i++) newItem['chk_sp_'+i] = getChk('chk_sp_'+i);
```

- [ ] **Step 3: Add backward-compatible edit/load restoration**

After the existing `chk_sp_11` restore line, add exact-field-first restoration using the established pattern:

```javascript
setChk('chk_sp_12', item.chk_sp_12 !== undefined ? item.chk_sp_12 : txt.includes('捷拉奧拉'));
setChk('chk_sp_13', item.chk_sp_13 !== undefined ? item.chk_sp_13 : txt.includes('色違蒂安希'));
setChk('chk_sp_14', item.chk_sp_14 !== undefined ? item.chk_sp_14 : (txt.includes('蒂安希') && !txt.includes('色違蒂安希')));
setChk('chk_sp_15', item.chk_sp_15 !== undefined ? item.chk_sp_15 : txt.includes('色違凱路迪歐'));
```

Also update the existing normal Keldeo fallback so `色違凱路迪歐` does not make `chk_sp_3` true. Preserve the current `凱路迪歐,瑪夏多` exclusion. The final condition must require normal `凱路迪歐` text while excluding both the combo form and `色違凱路迪歐`.

Do not change the stored-field precedence for `chk_sp_3` or `chk_sp_11`.

- [ ] **Step 4: Expand AI protection from 11 to 15**

Change:

```javascript
...Array.from({ length: 11 }, (_, index) => `chk_sp_${index + 1}`),
```

to:

```javascript
...Array.from({ length: 15 }, (_, index) => `chk_sp_${index + 1}`),
```

- [ ] **Step 5: Expand generated text from 11 to 15**

Change the Special Research list loop in `generateText()` from `i<=11` to `i<=15`. Keep the existing comma-separated output format and `🔥...特殊調查🔥` wrapper unchanged.

- [ ] **Step 6: Run the focused regression suite**

Run:

```bash
python tests/verify_regressions.py
```

Expected result: either PASS, or only existing source-hash snapshot failures for deliberately modified spans.

---

### Task 3: Reconcile existing source-lock snapshots and verify no regressions

**Files:**
- Modify only if required by legitimate failures: `tests/verify_regressions.py`

**Interfaces:**
- Consumes: the final `index.html` implementation from Task 2.
- Produces: updated deterministic source locks matching only the intended Special Research changes.

- [ ] **Step 1: Inspect any snapshot failures**

If `python tests/verify_regressions.py` reports hash/length mismatches for source spans containing the intended changes, identify the exact affected constants. The current suite contains source locks including `SAVE_ACCOUNT_HASH`, `SAVE_ACCOUNT_LENGTH`, `NEW_ITEM_HASH`, `NEW_ITEM_LENGTH`, `GENERATE_TEXT_HASH`, and `GENERATE_TEXT_LENGTH`.

Do not update unrelated hashes merely to make tests green.

- [ ] **Step 2: Recompute only affected snapshot values from the final source**

Use the existing helper functions/spans in `tests/verify_regressions.py` to compute the final SHA-256 and length for each affected source lock. Replace only the constants corresponding to spans that actually changed because of this feature.

- [ ] **Step 3: Run all repository tests available in the workspace**

At minimum run:

```bash
python tests/verify_regressions.py
```

Then inspect the repository for any additional documented test command and run it if present. Do not require network access or external credentials for tests.

Expected result: all available local tests PASS.

- [ ] **Step 4: Review the final diff for scope**

The implementation diff must be limited to:

```text
index.html
tests/verify_regressions.py
```

The pre-existing design and plan docs may also be present on the branch, but implementation must not alter unrelated production files.

Verify that the final diff contains no Firebase configuration changes, no API key changes, no Smart Hundo behavior changes, no Google Sheets behavior changes, and no UI redesign.

- [ ] **Step 5: Commit the implementation**

Create one focused implementation commit after tests pass, for example:

```bash
git add index.html tests/verify_regressions.py
git commit -m "feat: add special research inventory options"
```

Do not merge to `main`.
