# Smart Hundo Original Image Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route only exact Pokémon GO 4-star legendary screenshots to one original-image, high-detail, structured per-card vision extraction while preserving every ordinary scan and persistence behavior.

**Architecture:** Keep Firebase, GAS, form behavior, OpenAI transport, and orchestration in `index.html`. Add one browser/CommonJS-compatible pure helper module for normalized classification routing, structured-card normalization, deterministic card conversion, and multi-image merge; exercise the real page module through a dependency-free browser harness with mocked OpenAI responses.

**Tech Stack:** HTML5, browser JavaScript, OpenAI Chat Completions JSON Schema, Python 3 standard library test launcher, Microsoft Edge/Google Chrome headless.

## Global Constraints

- Keep `gpt-4.1-mini`, the Chat Completions endpoint, API-key storage/UI, Firebase paths/fields, GAS synchronization, generated copywriting, and manual-save behavior unchanged.
- Classification and all ordinary extraction continue to use max 1000px JPEG quality 0.7 and `detail: 'auto'`.
- Only an exact normalized `HUNDO_LEGENDARY_SCREEN` + `傳說的寶可夢,幻,究極異獸&4*` uses the untouched original PNG/JPEG/GIF/WebP data URL and `detail: 'high'`.
- Never crop cards, call once per Pokémon, add dependencies, fallback to old `pokemon_list`, log secrets/image data, or automatically persist scan results.
- A smart request is one logical `smartHundoScan()` per matching screenshot; existing 429/5xx retry behavior remains inside the shared request wrapper.

## File Structure

- Create `smart-hundo-helpers.js`: pure normalization, routing, structured-card conversion, and multi-image result merge.
- Modify `index.html`: load helper, define strict schema/prompt/original reader/request adapter, route jobs after classification, and surface audit/status.
- Create `tests/smart-hundo.test.html`: deterministic browser tests that load the real helper and evaluate the real page module with Firebase/OpenAI mocks.
- Create `tests/run_browser_tests.py`: start a loopback HTTP server, launch a local headless browser, and fail on any assertion or console error.
- Create `tests/verify_regressions.py`: exact source invariants for Firebase `newItem`, `generateText()`, API settings, model, and removed production full-scan calls.
- Create `docs/manual-tests/smart-hundo-original-image-scan.md`: reproducible manual acceptance checklist and expected evidence.

---

### Task 1: Pure smart-hundo contract

**Files:**
- Create: `tests/smart-hundo.test.html`
- Create: `tests/run_browser_tests.py`
- Create: `smart-hundo-helpers.js`

**Interfaces:**
- Produces: `normalizeSearchQuery(value)`, `isSmartHundoClassification(classification)`, `partitionImageJobs(jobs)`, `normalizeSmartHundoResult(result, normalizeNumber, normalizeOfficialName)`, `smartHundoCardsToPokemonList(cards, normalizeOfficialName, normalizePokemonList)`, and `mergeSmartHundoScanResults(results, ...)`.
- Returns: conversion `{ pokemon_list, uncertain_count, recognized_count }`; merge `{ hundo_leg, cards, pokemon_list, uncertain_count, recognized_count, detected_card_count, hundo_leg_conflict }`.

- [ ] **Step 1: Write failing browser assertions**

Add table-driven tests for the three required query variants; exact/inexact route partitioning; purified-only, shiny+purified, shadow, shiny+shadow, duplicates; empty `official_name`; uncertain recognition/status; exact-position duplicate removal; and multi-result `hundo_leg` conflict. Use assertions equivalent to:

```js
equal(normalizeSearchQuery('傳說的寶可夢，幻，究極異獸＆4＊'), '傳說的寶可夢,幻,究極異獸&4*');
deepEqual(partitionImageJobs(jobs).smartHundoJobs.map(job => job.index), [1]);
equal(smartHundoCardsToPokemonList(cards, normalizeName, normalizeList).pokemon_list, '色違暗影超夢');
equal(conversion.uncertain_count, 1);
equal(normalized.cards[0].official_name, '');
equal(merged.hundo_leg, '8');
equal(merged.hundo_leg_conflict, true);
```

- [ ] **Step 2: Run the harness and verify RED**

Run: `python tests/run_browser_tests.py`

Expected: non-zero exit with missing `SmartHundoHelpers`/function assertions; no network request to OpenAI.

- [ ] **Step 3: Implement the pure helper**

Use an IIFE that assigns `globalThis.SmartHundoHelpers` in browsers and `module.exports` in CommonJS. Normalize queries with `String(value || '').normalize('NFKC')`, explicit `，/＆/＊` punctuation mapping, and all Unicode whitespace removal. Partition only by `classification.image_type === 'HUNDO_LEGENDARY_SCREEN'` and exact canonical query.

Normalize every schema field to a predictable primitive, clamp confidences to `[0, 1]`, sort by `order/row/column`, and remove only byte-equivalent normalized cards sharing the same `order|row|column`. A card is output-usable only when `recognition_status === 'recognized'` and normalized `official_name` is non-empty; `visible_label` is never passed to any naming function. Count a card for manual review when its species is not usable or any independent state is `uncertain`.

Create output names with:

```js
const prefix = `${card.shiny_state === 'yes' ? '色違' : ''}${card.shadow_state === 'yes' ? '暗影' : ''}`;
return `${prefix}${officialName}`;
```

Never inspect `purified_state` when building the prefix. Delegate final duplicate formatting to the existing `normalizePokemonList` callback.

- [ ] **Step 4: Run the harness and verify GREEN**

Run: `python tests/run_browser_tests.py`

Expected: helper suite reports all assertions passed.

- [ ] **Step 5: Commit**

```powershell
git add smart-hundo-helpers.js tests/smart-hundo.test.html tests/run_browser_tests.py
git commit -m "test: define smart hundo helper contract"
```

### Task 2: Original image request and strict smart extraction

**Files:**
- Modify: `index.html` near AI constants/schemas, prompts, image readers, and request wrapper.
- Modify: `tests/smart-hundo.test.html`

**Interfaces:**
- Consumes: pure helper APIs from Task 1 and existing `extractSingleNumber()`, `normalizePokemonBaseName()`, `normalizePokemonList()`.
- Produces: `HUNDO_SMART_IMAGE_DETAIL`, `HUNDO_SMART_SCHEMA`, `buildSmartHundoPrompt()`, `fileToOriginalDataUrl(file)`, optional-detail `buildAiRequestContent()`/`requestOpenAiJsonSchema()`, `requestSmartHundoExtraction()`, and `smartHundoScan()`.

- [ ] **Step 1: Add failing runtime request tests**

Evaluate the real module after stripping only its Firebase import statements and injecting no-op Firebase functions. Mock `FileReader`, `Image`, canvas, and `fetch`. Assert:

```js
equal(await fileToOriginalDataUrl(pngFile), pngFile.dataUrl);
equal(canvasCalls, 0);
await requestOpenAiJsonSchema('test-key', 'normal', resizedUrl, schema, null);
equal(lastPayload.messages[0].content[1].image_url.detail, 'auto');
await smartHundoScan({ apiKey: 'test-key', originalDataUrl, imageIndex: 2 });
equal(lastPayload.messages[0].content[1].image_url.detail, 'high');
equal(smartRequestCount, 1);
```

Also assert unsupported MIME and reader/image errors reject with clear user-facing messages, without exposing the data URL.

- [ ] **Step 2: Run RED**

Run: `python tests/run_browser_tests.py`

Expected: failures for missing smart schema/request/original-reader interfaces.

- [ ] **Step 3: Add schema, prompt, and readers**

Load `smart-hundo-helpers.js` before the module script. Add `HUNDO_SMART_IMAGE_DETAIL = 'high'` and a strict schema containing every required field and enum, with `additionalProperties: false` on root and card objects.

Implement `fileToOriginalDataUrl(file)` using only `FileReader.readAsDataURL(file)`, a whitelist of `image/png`, `image/jpeg`, `image/gif`, `image/webp`, and `reader.onerror`. Add `reader.onerror` and `img.onerror` rejection to `fileToResizedDataUrl` without changing canvas dimensions or JPEG output.

Extend:

```js
const buildAiRequestContent = (prompt, dataUrl, imageDetail = AI_IMAGE_DETAIL) => [
  { type: 'text', text: prompt },
  { type: 'image_url', image_url: { url: dataUrl, detail: imageDetail } }
];
```

and add an optional final `options = {}` argument to `requestOpenAiJsonSchema`; existing callers omit it, while smart extraction passes `{ imageDetail: HUNDO_SMART_IMAGE_DETAIL }`.

Implement the complete prompt sections A–G from the approved spec verbatim in intent: enumerate all visible/partial cards, visual-species-first official Traditional Chinese naming, visible label secondary only, independent shiny/purified/shadow evidence, UI exclusions, conservative uncertainty, and schema-only output. The prompt states the type/query are already classified and forbids reclassification.

- [ ] **Step 4: Run GREEN and inspect request payloads**

Run: `python tests/run_browser_tests.py`

Expected: original-reader and request-detail assertions pass; captured payload contains no live key and no request reaches the internet.

- [ ] **Step 5: Commit**

```powershell
git add index.html tests/smart-hundo.test.html
git commit -m "feat: add high-detail smart hundo extraction"
```

### Task 3: Post-classification job routing and safe merging

**Files:**
- Modify: `index.html` in validation/batch/scan orchestration.
- Modify: `tests/smart-hundo.test.html`

**Interfaces:**
- Consumes: Task 1 partition/merge APIs and Task 2 `smartHundoScan()`.
- Produces: image jobs `{ index, file, classificationDataUrl, classification }`, normal-only validation, `window.lastSmartHundoScanResult`, and final UI result status.

- [ ] **Step 1: Add failing end-to-end mocked scan tests**

Provide arbitrary file order `PROFILE`, exact `HUNDO`, `SHINY`, `RESOURCE`. Mock classifier responses by resized image identity and extraction responses by prompt. Assert only the exact hundo job reads its original data URL and calls smart extraction, all normal jobs use resized URLs, ordinary fields merge, `g_hundos` comes only from smart cards, and no prompt from `buildAiExtractionPrompt` contains `allow_pokemon_list` for the smart job.

Add a failure scenario where smart fetch rejects after wrapper retries: ordinary fields are applied, pre-edited `g_hundos` stays unchanged, the button is enabled, and status says intelligent scan failed rather than success.

- [ ] **Step 2: Run RED**

Run: `python tests/run_browser_tests.py`

Expected: old `quickScan`/`fullHundoScan` orchestration sends hundo through compressed quick/full paths and fails assertions.

- [ ] **Step 3: Refactor production routing**

Build and classify stable jobs first, then call `partitionImageJobs`. Convert only `normalJobs` to compact `dataUrls/classifications` arrays for existing `quickScan()` and `runRequiredFieldValidation()`. This makes it structurally impossible for validation to target a smart image or old `pokemon_list` prompt.

Run every smart job once through `fileToOriginalDataUrl(job.file)` then `smartHundoScan(...)`. Use `Promise.allSettled` around the normal task and individual smart tasks so completed ordinary output remains applicable when smart work fails. Merge normal validated fields with smart `hundo_leg` and card-derived `pokemon_list`; never include any former full-scan task result.

Assign an audit object containing screenshot indexes, normalized cards, counts, conflicts, and failed indexes only. On any smart request failure, apply ordinary fields but omit smart `pokemon_list` from `applyAiResultToForm`; preserve the existing textarea and show a persistent failure status. On uncertainty, apply recognized names and show the required concise count. Always restore the scan button in `finally` without clearing the final status.

Remove `fullHundoScan()`, `getFullHundoScanTargetIndexes()`, full scan mode labels/branches, and the detailed `pokemon_list` branch in the ordinary extraction prompt if no remaining caller exists. Keep HUNDO ordinary allowed-field metadata only where classification/field naming compatibility requires it, while ensuring quick extraction returns only `hundo_leg` for non-smart/non-exact classifications.

- [ ] **Step 4: Run GREEN**

Run: `python tests/run_browser_tests.py`

Expected: arbitrary-order routing, original-vs-resized image, normal merge, failure preservation, audit, and status assertions all pass.

- [ ] **Step 5: Commit**

```powershell
git add index.html tests/smart-hundo.test.html
git commit -m "feat: route exact hundo screenshots to smart scan"
```

### Task 4: Regression locks and acceptance documentation

**Files:**
- Create: `tests/verify_regressions.py`
- Create: `docs/manual-tests/smart-hundo-original-image-scan.md`
- Modify: `tests/run_browser_tests.py` if needed to report exact totals.

**Interfaces:**
- Produces: reproducible regression and manual acceptance evidence.

- [ ] **Step 1: Add regression assertions**

Extract the `newItem` literal and `window.generateText` function from `index.html`; compare their normalized SHA-256 values to the pre-feature baseline. Assert source still contains `gpt-4.1-mini`, existing API-key settings keys, max image size `1000`, JPEG quality `0.7`, and normal detail `auto`; assert production `autoScan` contains `smartHundoScan` but not `fullHundoScan`, and no Firebase/GAS object includes `purified` or `lastSmartHundoScanResult`.

- [ ] **Step 2: Run regressions**

Run: `python tests/verify_regressions.py`

Expected: all source invariants pass.

- [ ] **Step 3: Document the 16 manual acceptance steps**

Record setup, random-order upload, classification evidence, network payload checks (redacting Authorization/data URL), structured card inspection, purified audit/output distinction, manual-save confirmation, and Firebase/GAS schema confirmation. Mark steps requiring real screenshots/key as manual rather than claiming they were executed by mocks.

- [ ] **Step 4: Run complete verification**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
git status --short
```

Expected: both test commands exit 0, browser harness reports zero console/unhandled errors, `git diff --check` has no output, and status lists only intended files.

- [ ] **Step 5: Commit**

```powershell
git add tests/verify_regressions.py docs/manual-tests/smart-hundo-original-image-scan.md tests/run_browser_tests.py
git commit -m "test: cover smart hundo scan regressions"
```

### Task 5: Independent review, final verification, and Draft PR

**Files:**
- Review all files changed from `origin/main`.

- [ ] **Step 1: Run an independent requirements review**

Review every requirement against the diff, with special attention to original image secrecy, exactly one logical smart call, validation exclusion, failure preserving `g_hundos`, and no Firebase/GAS schema changes. Fix any concrete defect using a failing test first.

- [ ] **Step 2: Run final evidence commands from a clean state**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: all pass and the worktree is clean after the final commit.

- [ ] **Step 3: Push without merging**

```powershell
git push -u origin feat/smart-hundo-original-image-scan
```

- [ ] **Step 4: Create a Draft PR**

Create a Draft PR targeting `main`, include summary/testing/manual limitations, verify the returned URL and open state, and do not merge it.
