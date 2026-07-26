# Smart Hundo Crop Form Verifier V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 對帝牙盧卡、帕路奇亞與奈克洛茲瑪加入以原圖本體裁切、放大 contact sheet、有限候選 Structured Output 與 deterministic body-evidence tuple 驗證構成的第二階段型態複核。

**Architecture:** Stage 1 繼續負責全圖分類、card enumeration、base species、primary form 與五維 state；每張 card 另回傳 0–1000 `card_bbox`／`pokemon_bbox`。純 helper 規劃 target candidates、六張一批、驗證 Stage 2 結果並 fail closed merge；`index.html` 只負責原圖 canvas、PNG contact sheet、API request 與 session-safe orchestration。三個 target family 以 Stage 2 為 final form authority，非 target family 完全沿用 PR #35。

**Tech Stack:** browser JavaScript、classic-script UMD helpers、HTML Canvas 2D、OpenAI Chat Completions Structured Outputs、dependency-free Python headless Edge/Chrome runner、static Python regression checks、Git/GitHub Draft PR。

## Global Constraints

- 基線必須是 `origin/main` `81fc3abcd6e4c43db0beef31cded90b444c0f1c1`；其 tree 必須等於 PR #35 tree `d2aea23557ed99e87632bf4393b0a8d9d98a3bed`。
- 只在 `feat/smart-hundo-crop-form-verifier-v2` 隔離 worktree 開發；不得修改或合併 `main`，不得啟用 auto-merge。
- `const OPENAI_MODEL = 'gpt-4.1-mini';` 不變；新增 `const HUNDO_FORM_VERIFY_MODEL = 'gpt-4.1-mini';`。
- verifier 固定 `detail: high`、`temperature: 0.1`、Structured Outputs，不帶 `reasoning_effort`。
- 只處理帝牙盧卡、帕路奇亞、奈克洛茲瑪；Galarian birds、Zacian、Zamazenta、Zygarde、Kyurem 沿用 PR #35。
- canonical names、state-prefix order、query routing、Hundo count、Stage 1 enumeration/state recognition、ordinary scan、trainer team、Firebase、GAS、copywriting、manual save、API-key storage、endpoint、ordinary compression、special survey、Fusion、Mega 不變。
- 不新增 external dependency、OpenCV、web search、per-card request 或 local reference-image library。
- 每個 contact sheet 最多六張；request count 必須是 `ceil(target_candidate_count / 6)`。
- structural verifier retry 每張 sheet 最多一次，只能因 missing、duplicate、truncated 或 structurally incomplete；低信心與 uncertain 不重試。
- 全部自動測試只用 synthetic images 與 mocked API；live OpenAI request 必須是 0。
- 私人截圖與 derived crop 不得加入 git、文件、log 或 diagnostics；未實測不得宣稱 real-image PASS。
- 所有 production behavior 先有正確失敗的 test，再做最小實作；每個 task 完成後執行 scoped tests、self-review、commit 與獨立 task review。

---

### Task 1: Pure verifier contracts、bbox validation 與 batching

**Files:**

- Create: `smart-hundo-form-verifier.js`
- Create: `tests/smart-hundo-form-verifier.test.html`
- Modify: `tests/run_browser_tests.py:17-20`
- Create: `docs/superpowers/specs/2026-07-26-smart-hundo-crop-form-verifier-v2-design.md`
- Create: `docs/superpowers/plans/2026-07-26-smart-hundo-crop-form-verifier-v2.md`

**Interfaces:**

- Produces global/module API `SmartHundoFormVerifier`.
- Produces immutable constants:
  `TARGET_HUNDO_FORM_BASE_SPECIES`,
  `VERIFIED_FORM_IDS_BY_BASE_SPECIES`,
  `REQUIRED_VERIFIED_FORM_EVIDENCE`,
  `HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD`,
  `HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD`,
  `HUNDO_FORM_VERIFY_PARTIAL_THRESHOLD`,
  `HUNDO_FORM_VERIFY_BATCH_SIZE`,
  `HUNDO_FORM_MIN_SOURCE_PIXELS`,
  `HUNDO_FORM_VERIFIER_REVIEW_REASON_MESSAGES`.
- Produces pure functions:
  `normalizeHundoBoundingBox(value)`,
  `normalizeHundoBboxContract(card)`,
  `isTargetHundoFormBaseSpecies(value)`,
  `planTargetHundoFormCandidates(cards, options)`,
  `planHundoFormVerificationBatches(candidates)`,
  `markHundoFormVerificationFailure(cards, cardIds, reason, status)`.
- `planTargetHundoFormCandidates()` returns:

```js
{
  cards: [],
  candidates: [],
  target_card_count: 0,
  target_candidate_count: 0
}
```

- Every candidate contains:

```js
{
  card_id: '0:2:1:1',
  screenshot_index: 0,
  base_species: '帝牙盧卡',
  candidate_form_ids: ['dialga_standard', 'dialga_origin', 'uncertain'],
  pokemon_bbox: { x_min: 100, y_min: 200, x_max: 400, y_max: 700 }
}
```

- Every batch contains stable `contact_sheet_id` and jobs with request-local `tile_id` `T1`–`T6`.

- [ ] **Step 1: Add the focused browser test page to the runner**

Insert `"/tests/smart-hundo-form-verifier.test.html"` into `TEST_PATHS`. The new page must install `window.error`、`unhandledrejection`、`console.error` collectors and publish explicit `data-test-status`、`data-test-passed`、`data-test-failed` values exactly like the existing harness.

- [ ] **Step 2: Write failing contract tests**

Use hand-written literal expectations. Required test groups:

```text
exports exactly three target base species
freezes every target candidate array and every evidence tuple
preserves the seven canonical names through SmartHundoHelpers
accepts a valid integer bbox pair
rejects equal/reversed/out-of-range/non-integer coordinates
rejects strings, booleans, arrays, NaN, Infinity and extra bbox properties
requires pokemon/card intersection and pokemon center inside card
accepts bbox_confidence only as a finite primitive number
selects only recognized/usable-partial target cards at species confidence 0.80
marks invalid target bbox as form_crop_missing
marks low bbox confidence or unclear bbox as form_crop_not_clear
plans zero batches for zero candidates
plans one six-job batch for six candidates
plans two batches of six and one for seven candidates
uses stable T1..T6 IDs without species/form/CP labels
```

The bbox literal that passes is:

```js
{
  card_bbox: { x_min: 50, y_min: 100, x_max: 450, y_max: 800 },
  pokemon_bbox: { x_min: 120, y_min: 220, x_max: 380, y_max: 680 },
  bbox_confidence: 0.91,
  bbox_visibility: 'clear'
}
```

- [ ] **Step 3: Run RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: the new verifier page reports failure because
`globalThis.SmartHundoFormVerifier` and its contracts do not exist. Existing 169 groups remain green; OpenAI requests remain 0.

- [ ] **Step 4: Implement immutable constants and strict bbox helpers**

Create `smart-hundo-form-verifier.js` as:

```js
(function (global) {
    'use strict';

    const TARGET_HUNDO_FORM_BASE_SPECIES = Object.freeze([
        '帝牙盧卡',
        '帕路奇亞',
        '奈克洛茲瑪'
    ]);
    const VERIFIED_FORM_IDS_BY_BASE_SPECIES = Object.freeze({
        帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin', 'uncertain']),
        帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin', 'uncertain']),
        奈克洛茲瑪: Object.freeze([
            'necrozma_base',
            'necrozma_dusk_mane',
            'necrozma_dawn_wings',
            'uncertain'
        ])
    });
```

Add the exact seven-entry `REQUIRED_VERIFIED_FORM_EVIDENCE` from the design. `normalizeHundoBoundingBox` must return `null` unless the object has exactly `x_min/y_min/x_max/y_max`, all values are finite primitive integers in 0–1000, and min is strictly below max. `normalizeHundoBboxContract` must additionally validate intersection, center containment, strict confidence and visibility.

- [ ] **Step 5: Implement candidate and batch planning**

Target preparation must snapshot:

```js
{
  primary_form_id: card.form_id,
  primary_effective_form_id: card.effective_form_id,
  primary_form_confidence: card.form_confidence,
  primary_form_evidence: card.form_evidence,
  verified_form_id: 'uncertain',
  verification_confidence: 0,
  verification_evidence: {
    crop_visibility: 'uncertain',
    body_plan: 'uncertain',
    limb_layout: 'uncertain',
    fusion_host: 'uncertain',
    decisive_feature: 'uncertain',
    key_features_visible: false
  },
  verification_status: 'pending',
  effective_form_id: 'uncertain',
  canonical_official_name: ''
}
```

Remove only superseded Stage 1 form reasons on target cards; preserve species/state/session reasons. Use `Array.prototype.slice` in six-card increments. Do not mutate input arrays or cards.

- [ ] **Step 6: Run GREEN**

Run:

```powershell
python tests/run_browser_tests.py
node --check smart-hundo-form-verifier.js
git diff --check
```

Expected: all baseline groups plus the new contract groups pass; failed groups 0; OpenAI requests 0.

- [ ] **Step 7: Commit**

```powershell
git add smart-hundo-form-verifier.js tests/smart-hundo-form-verifier.test.html tests/run_browser_tests.py docs/superpowers/specs/2026-07-26-smart-hundo-crop-form-verifier-v2-design.md docs/superpowers/plans/2026-07-26-smart-hundo-crop-form-verifier-v2.md
git commit -m "feat: add smart hundo form verifier contracts"
```

### Task 2: Stage 1 bounding boxes

**Files:**

- Modify: `index.html:936-1083`
- Modify: `index.html:1890-2126`
- Modify: `smart-hundo-helpers.js:484-579`
- Modify: `tests/smart-hundo.test.html`
- Modify: `tests/smart-hundo-form-verifier.test.html`
- Modify: `tests/verify_regressions.py`

**Interfaces:**

- `HUNDO_SMART_SCHEMA.cards.items` gains required `card_bbox`, `pokemon_bbox`, `bbox_confidence`, `bbox_visibility`.
- `normalizeSmartHundoCard()` consumes the new pure bbox normalizer and preserves normalized values plus a private `bbox_valid` boolean.
- `buildSmartHundoPrompt()` gains `【卡片與寶可夢本體座標】`.

- [ ] **Step 1: Write failing schema tests**

Assert exact schemas:

```js
{
  type: 'object',
  additionalProperties: false,
  properties: {
    x_min: { type: 'integer', minimum: 0, maximum: 1000 },
    y_min: { type: 'integer', minimum: 0, maximum: 1000 },
    x_max: { type: 'integer', minimum: 0, maximum: 1000 },
    y_max: { type: 'integer', minimum: 0, maximum: 1000 }
  },
  required: ['x_min', 'y_min', 'x_max', 'y_max']
}
```

Assert all four new card fields are required, `bbox_confidence` is number 0–1, and visibility enum is exactly:

```js
['clear', 'partially_visible', 'cropped', 'not_visible', 'uncertain']
```

- [ ] **Step 2: Write failing prompt and normalization tests**

Assert `buildSmartHundoPrompt()` includes:

```text
【卡片與寶可夢本體座標】
完整原始圖片
0～1000 相對座標
不得跨到相鄰卡片
只框住同一卡片中的寶可夢本體
盡量排除 CP
盡量排除寶可夢名稱或暱稱
151515、96%、地名
不要使用卡片文字來擴大 pokemon_bbox
bbox_confidence
不是對寶可夢型態的信心
```

Assert normalized cards keep valid bboxes and fail closed invalid bbox/confidence values.

- [ ] **Step 3: Run RED**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: schema/prompt/normalization groups fail because Stage 1 fields are absent. The static smart-schema snapshot also fails only on the intended span.

- [ ] **Step 4: Add strict schema and exact prompt section**

Insert bbox properties before `cp` and add them to the card `required` list. Add the exact Traditional Chinese rules from the approved design before the species section. Do not change `HUNDO_COUNT_SCHEMA` or `buildHundoCountPrompt()`.

- [ ] **Step 5: Preserve normalized bbox values**

At the beginning of `normalizeSmartHundoCard()` call:

```js
const bboxContract = global.SmartHundoFormVerifier
    ? global.SmartHundoFormVerifier.normalizeHundoBboxContract(card)
    : {
        card_bbox: null,
        pokemon_bbox: null,
        bbox_confidence: 0,
        bbox_visibility: 'uncertain',
        bbox_valid: false
    };
```

Spread only the five normalized fields into the card. Do not put image data in `raw`.

- [ ] **Step 6: Update complete model fixtures and the narrow schema snapshot**

Every mock card that represents a schema-valid Stage 1 response gets literal valid bboxes. Recalculate only `SMART_HUNDO_SCHEMA_HASH` and `SMART_HUNDO_SCHEMA_LENGTH`; all count/ordinary/team/save hashes must remain unchanged.

- [ ] **Step 7: Run GREEN**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
node --check smart-hundo-helpers.js
git diff --check
```

Expected: every browser group and all static checks pass; OpenAI requests 0.

- [ ] **Step 8: Commit**

```powershell
git add index.html smart-hundo-helpers.js tests/smart-hundo.test.html tests/smart-hundo-form-verifier.test.html tests/verify_regressions.py
git commit -m "feat: add smart hundo card bounding boxes"
```

### Task 3: Original-image crops and contact sheets

**Files:**

- Modify: `index.html:2176-2277`
- Modify: `tests/smart-hundo-form-verifier.test.html`

**Interfaces:**

- Produces `loadSmartHundoOriginalImage(originalDataUrl)`.
- Produces `createSmartHundoPokemonCrop(sourceImage, candidate)`.
- Produces `buildSmartHundoFormContactSheets(originalDataUrl, candidates)`.
- A successful crop returns:

```js
{
  card_id: '0:2:1:1',
  crop_canvas: HTMLCanvasElement,
  crop_data_url: 'data:image/png;base64,mocked',
  crop_source_size: { width: 256, height: 320 }
}
```

- A contact sheet returns:

```js
{
  contact_sheet_id: '0:form:1',
  contact_sheet_data_url: 'data:image/png;base64,mocked',
  verification_jobs: [{
    tile_id: 'T1',
    card_id: '0:2:1:1',
    screenshot_index: 0,
    base_species: '帝牙盧卡',
    candidate_form_ids: ['dialga_standard', 'dialga_origin', 'uncertain']
  }]
}
```

- [ ] **Step 1: Write failing coordinate/crop tests**

Use a synthetic 1000×2000 source and bbox
`{x_min:100,y_min:200,x_max:300,y_max:500}`. Assert body pixels are
`x=100,y=400,width=200,height=600`; longest-side padding is 72 px per side before clamp. Add an edge bbox and assert clamped source coordinates never leave the original image.

- [ ] **Step 2: Write failing tile tests**

Assert:

- minimum visible body 64×64 passes; 63×64 and 64×63 return `form_crop_too_small`
- tile canvas is 320×320
- draw scale uses `min(320/cropWidth, 320/cropHeight)`
- x/y offsets center the crop
- smoothing is enabled with quality `high`
- output MIME is exactly `image/png`
- no `fillText` occurs on crop canvas

- [ ] **Step 3: Write failing contact-sheet tests**

Assert 1/6/7 crops create 1/1/2 PNG sheets, maximum six tiles, 2×up-to-3 layout, stable T IDs, and every `fillText` value matches `/^T[1-6]$/`. Assert CP、visible label、species and candidate form strings are absent from all canvas text calls and no data URL enters diagnostic-shaped fixtures.

- [ ] **Step 4: Run RED**

```powershell
python tests/run_browser_tests.py
```

Expected: focused runtime tests fail because crop/contact-sheet functions are not exported.

- [ ] **Step 5: Implement image loading and exact crop math**

Use `naturalWidth || width` and `naturalHeight || height`. Compute unpadded body size for the 64×64 gate, add 12% of the longest side to each edge, clamp, preserve aspect ratio, center, enable high-quality smoothing, and encode PNG. Do not sharpen, recolor, alter hue/saturation, or draw text.

- [ ] **Step 6: Implement contact sheets**

Use 360×380 tile slots, 320×320 image area, two columns and up to three rows. Draw only tile ID in the header. Reset T IDs per sheet; keep `contact_sheet_id` unique. Drop `crop_canvas` and image data from public metrics after building the request object.

- [ ] **Step 7: Run GREEN**

```powershell
python tests/run_browser_tests.py
git diff --check
```

Expected: all crop/contact-sheet groups pass, failed groups 0, OpenAI requests 0.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/smart-hundo-form-verifier.test.html
git commit -m "feat: build enlarged form verification contact sheets"
```

### Task 4: Limited-candidate verifier schema, prompt and request

**Files:**

- Modify: `index.html:636-652`
- Modify: `index.html:936-1083`
- Modify: `index.html:2127-2175`
- Modify: `index.html:2279-2418`
- Modify: `tests/smart-hundo-form-verifier.test.html`
- Modify: `tests/smart-hundo.test.html`
- Modify: `tests/verify_regressions.py`

**Interfaces:**

- Produces `HUNDO_FORM_VERIFY_MODEL`.
- Produces strict `HUNDO_FORM_VERIFIER_SCHEMA`.
- Produces `buildSmartHundoFormVerifierPrompt(verificationJobs, options)`.
- Produces `requestSmartHundoFormVerification({ apiKey, contactSheetDataUrl, verificationJobs, statusUpdater, requestOptions })`.
- `requestOpenAiJsonSchema()` accepts optional `options.model` and
`options.retryParseErrors`; every pre-existing caller retains its current payload.

- [ ] **Step 1: Write failing strict-schema tests**

Recursively require all object properties and `additionalProperties: false`. Assert exact field order and exact enums from the design for form, visibility, body plan, limb layout, fusion host and decisive feature. Assert `cards` has no `maxItems` lower than six.

- [ ] **Step 2: Write failing prompt tests**

Assert the prompt excludes CP/name/state/count tasks, forbids residual text and standard fallback, makes color auxiliary only, and contains all exact Dialga/Palkia/Necrozma structure rules and required tuples. Assert each tile mapping lists only its supplied base species and limited candidates.

- [ ] **Step 3: Write failing request tests**

Intercept the official endpoint and assert:

```js
payload.model === 'gpt-4.1-mini'
payload.temperature === 0.1
payload.messages[0].content[1].image_url.detail === 'high'
payload.messages[0].content[1].image_url.url === contactSheetDataUrl
payload.response_format.json_schema.name === 'pokemon_go_smart_hundo_form_verifier_v2'
Object.hasOwn(payload, 'reasoning_effort') === false
```

Assert the original screenshot URL and individual crop URLs are absent.

- [ ] **Step 4: Run RED**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: verifier schema/prompt/request tests fail; pre-existing request-path tests remain green.

- [ ] **Step 5: Implement model constant and schema**

Place `HUNDO_FORM_VERIFY_MODEL` beside `OPENAI_MODEL`. Build the exact schema from the design, with top-level `{cards}` and all required fields. Do not add `reasoning_effort`.

- [ ] **Step 6: Implement the dedicated Traditional Chinese prompt**

Include general exclusions, body-structure authority, color rule, no-standard fallback, all seven form descriptions and required tuples, then append one text-only mapping line per job:

```text
T1 | card_id=0:2:1:1 | base_species=帝牙盧卡 | candidates=dialga_standard,dialga_origin,uncertain
```

- [ ] **Step 7: Implement request routing**

Make the existing requester choose `options.model || OPENAI_MODEL`; keep every old call unchanged. The verifier sends one contact-sheet data URL with high detail and includes metadata. Annotate JSON parse errors as `openai_json_parse_error`; when `retryParseErrors === false`, allow the semantic wrapper in Task 6 to own the single structural retry while retaining safe HTTP retry behavior.

- [ ] **Step 8: Run GREEN**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Expected: all request/schema/prompt tests pass, existing model remains `gpt-4.1-mini`, zero live OpenAI requests.

- [ ] **Step 9: Commit**

```powershell
git add index.html tests/smart-hundo-form-verifier.test.html tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: add limited-candidate form verification request"
```

### Task 5: Deterministic verifier result validation and merge

**Files:**

- Modify: `smart-hundo-form-verifier.js`
- Modify: `tests/smart-hundo-form-verifier.test.html`

**Interfaces:**

- Produces `normalizeHundoFormVerifierResult(result)`.
- Produces `validateHundoFormVerifierStructure(result, jobs, finishReason)`.
- Produces `validateHundoVerifiedForm(resultCard, job)`.
- Produces `mergeHundoFormVerificationResults(cards, jobs, result, structure, canonicalNames)`.
- Produces controlled statuses:
  `verified`、`uncertain`、`low_confidence`、`species_mismatch`、
  `evidence_mismatch`、`invalid_result`、`structural_incomplete`、
  `request_failed`.

- [ ] **Step 1: Write failing exact-tuple tests**

Use literal complete result cards for:

```text
dialga_standard
dialga_origin
palkia_standard
palkia_origin
necrozma_base
necrozma_dusk_mane
necrozma_dawn_wings
```

Each must pass only with its exact immutable body/limb/fusion/decisive tuple and `key_features_visible: true`.

- [ ] **Step 2: Write failing negative tests**

Cover:

```text
Dialga form/body mismatch
Dialga limb mismatch
Palkia arm/body mismatch
Necrozma fusion-host mismatch
moon-wing/lion/upright conflicts
cross-species verified form
numeric-string/boolean/NaN/Infinity confidence
clear 0.899 rejection and 0.90 acceptance
partial 0.949 rejection and 0.95 acceptance
cropped/not_visible/uncertain visibility rejection
uncertain result
wrong tile_id
wrong card_id
duplicate tile result
duplicate card result
missing requested card
unexpected result card
```

- [ ] **Step 3: Write failing merge/list/state tests**

Required literal outcomes:

```text
primary dialga_standard + verified dialga_origin 0.97 → 起源帝牙盧卡
primary necrozma_base + verified necrozma_dusk_mane 0.96 → 奈克洛茲瑪（黃昏之鬃）
primary palkia_standard + verified uncertain → no list entry + form_verifier_uncertain
shiny + verified dialga_origin → 色違起源帝牙盧卡
special background + verified necrozma_dawn_wings → 特別背卡奈克洛茲瑪（拂曉之翼）
purified + verified palkia_origin → 起源帕路奇亞
```

Assert Stage 1 states remain byte-for-byte equal and multiple reasons count one card once through existing summary helper.

- [ ] **Step 4: Run RED**

```powershell
python tests/run_browser_tests.py
```

Expected: validation and merge groups fail because the result functions are absent.

- [ ] **Step 5: Implement strict result normalization and structure validation**

Do not coerce arrays, objects, booleans or numeric strings into accepted primitives. A structurally complete result has exactly one result per requested `tile_id/card_id`, no duplicates, no unexpected pair, every required field with valid primitive type, and no `length/truncated/truncation` finish reason.

- [ ] **Step 6: Implement evidence validation**

Compare `base_species` and every tuple field with
`REQUIRED_VERIFIED_FORM_EVIDENCE[verified_form_id]`. Apply 0.90 clear and 0.95 partial thresholds. Return controlled reason codes; never substitute Stage 1 form.

- [ ] **Step 7: Implement immutable merge**

For valid result set:

```js
{
  verified_form_id: result.verified_form_id,
  verification_confidence: result.verification_confidence,
  verification_evidence: {
    crop_visibility: result.crop_visibility,
    body_plan: result.body_plan,
    limb_layout: result.limb_layout,
    fusion_host: result.fusion_host,
    decisive_feature: result.decisive_feature,
    key_features_visible: result.key_features_visible
  },
  verification_status: 'verified',
  effective_form_id: result.verified_form_id,
  canonical_official_name: canonicalNames[result.verified_form_id]
}
```

Every failure sets final form uncertain/canonical empty and appends the controlled reason once.

- [ ] **Step 8: Run GREEN**

```powershell
python tests/run_browser_tests.py
node --check smart-hundo-form-verifier.js
git diff --check
```

Expected: all seven tuples and all fail-closed cases pass; zero live OpenAI requests.

- [ ] **Step 9: Commit**

```powershell
git add smart-hundo-form-verifier.js tests/smart-hundo-form-verifier.test.html
git commit -m "feat: validate enlarged form verification evidence"
```

### Task 6: Runtime integration and structural retry

**Files:**

- Modify: `index.html:2406-2645`
- Modify: `index.html:2848-3200`
- Modify: `smart-hundo-helpers.js:585-596`
- Modify: `tests/smart-hundo-form-verifier.test.html`
- Modify: `tests/smart-hundo.test.html`

**Interfaces:**

- Produces `requestSmartHundoFormVerificationWithStructuralRetry()`.
- Produces `runSmartHundoFormVerification()`.
- `smartHundoScan()` returns final cards plus:

```js
{
  target_candidate_count: 0,
  target_verified_count: 0,
  target_review_card_count: 0,
  contact_sheet_count: 0,
  verifier_request_count: 0,
  verifier_structural_retry_count: 0,
  form_verify_model: 'gpt-4.1-mini'
}
```

- [ ] **Step 1: Write failing request-count integration tests**

With fully schema-valid Stage 1 mock cards and synthetic original images, assert:

```text
0 targets → 0 verifier endpoint calls
1 target → 1 verifier call
6 targets → 1 verifier call
7 targets → 2 verifier calls
```

Count only verifier schema requests; existing count/cards requests remain unchanged.

- [ ] **Step 2: Write failing authority/isolation tests**

Assert:

- Stage 2 starts only after final Stage 1 structural result.
- only the three target families enter Stage 2.
- Galarian/Zacian/Zamazenta/Zygarde/Kyurem results remain Stage 1 results.
- valid Stage 2 corrects wrong Stage 1.
- uncertain/low/invalid/missing/request failure never falls back.
- request failure preserves non-target cards, Hundo count and ordinary result.
- five effective states remain unchanged.
- final grouping uses verified canonical name.
- overlap identity includes `verified_form_id` in addition to final effective/canonical.

- [ ] **Step 3: Write failing structural retry tests**

For one sheet:

```text
missing T2 on first result + complete second result → exactly 2 semantic verifier calls
duplicate T1 on first + complete second → exactly 2 calls
complete uncertain result → exactly 1 call
complete low-confidence result → exactly 1 call
incomplete first + incomplete second → exactly 2 calls and all sheet jobs unresolved
```

- [ ] **Step 4: Run RED**

```powershell
python tests/run_browser_tests.py
```

Expected: runtime integration groups fail because Stage 2 is not invoked.

- [ ] **Step 5: Implement one-sheet structural retry**

Run the dedicated request, normalize and validate structure. Retry once only when structure reasons contain missing, duplicate, invalid required fields, unexpected mappings, JSON truncation or truncated finish reason. The second result fully replaces the first. Do not retry low confidence or `uncertain`.

- [ ] **Step 6: Implement per-screenshot Stage 2 orchestration**

In `smartHundoScan()`:

1. Validate Stage 1 form and states.
2. Plan target candidates.
3. If zero candidates, return immediately with zero metrics.
4. Build crops/contact sheets from `originalDataUrl`.
5. Mark crop failures without sending those cards.
6. Process contact sheets sequentially and check `isCurrentRun()` after every await.
7. Merge valid verifier results or controlled failures.
8. Return cards and metrics.

Do not union cards or change order/row/column/CP/label/state fields.

- [ ] **Step 7: Integrate final cards before overlap/list conversion**

`autoScan()` continues merging `result.card_result.cards`; these are now already Stage 2-final. Extend overlap signature with `verified_form_id` without removing any existing identity field or weakening the two-card boundary rule.

- [ ] **Step 8: Run GREEN**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Expected: all Stage 2 integration/request-count/retry tests pass; existing 169 groups remain valid; OpenAI requests 0.

- [ ] **Step 9: Commit**

```powershell
git add index.html smart-hundo-helpers.js tests/smart-hundo-form-verifier.test.html tests/smart-hundo.test.html
git commit -m "feat: integrate second-stage hundo form verification"
```

### Task 7: Safe diagnostics、status、regression locks and manual acceptance

**Files:**

- Modify: `smart-hundo-helpers.js:824-1029`
- Modify: `smart-hundo-helpers.js:1073-1094`
- Modify: `index.html:2576-2645`
- Modify: `index.html:3152-3200`
- Modify: `tests/smart-hundo-form-verifier.test.html`
- Modify: `tests/smart-hundo.test.html`
- Modify: `tests/run_browser_tests.py`
- Modify: `tests/verify_regressions.py`
- Create: `docs/manual-tests/smart-hundo-crop-form-verifier-v2.md`

**Interfaces:**

- `shapeSmartHundoDiagnostics()` allowlists target-card verifier fields and root/per-screenshot metrics.
- `formatSmartHundoStatus()` consumes verified/review/request-failure metrics.
- Manual document contains the exact three screenshot oracles and every required record column, all rows marked `NOT RUN`.

- [ ] **Step 1: Write failing diagnostics privacy tests**

Assert safe target-card fields and root/per-screenshot metrics are present. Serialize diagnostics and assert absence of:

```text
api key
Authorization
Bearer
original image data URL
crop image data URL
contact-sheet data URL
File
raw request payload
complete raw response
Firebase credentials
GAS credentials
```

Also assert `nativeFetchAttemptCount === 0` in the browser harness.

- [ ] **Step 2: Write failing review/status tests**

Assert all ten Traditional Chinese reason messages exactly. Assert multiple reasons on one card produce `review_card_count === 1`. Assert status includes:

```text
百神掃描完成：辨識7張卡片；型態複核3張
百神掃描完成：辨識6張卡片；1張型態需人工確認
百神清單已完成部分辨識；特殊型態複核失敗，請人工確認
```

- [ ] **Step 3: Write failing regression/static tests**

Add checks for:

- new helper loads before the inline module
- both models remain `gpt-4.1-mini`
- verifier request uses high detail, temperature 0.1 and no reasoning effort
- exact request-count batching constants
- exact target-family/evidence maps
- query/count/ordinary/team/Firebase/GAS/copy/manual paths unchanged
- diagnostic/log forbidden identifiers and data URL patterns
- no committed image assets
- manual V2 document contains all exact oracles and `NOT RUN`

- [ ] **Step 4: Run RED**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: diagnostics/status/manual/static groups fail because final allowlists/messages/document are absent.

- [ ] **Step 5: Implement safe diagnostics and status**

Reuse diagnostic primitive sanitizers. Shape bbox coordinates and crop source dimensions as nonnegative finite integers; shape confidence as finite 0–1 numbers; enum every evidence field. Never spread raw verifier objects. Aggregate metrics by summing per-screenshot counts and set `form_verify_model` from the named constant.

If any `form_verification_request_failed` occurs, use the exact partial-failure status. Otherwise append verified count and unique target-review-card count to the existing successful status without blocking count or non-target results.

- [ ] **Step 6: Create the manual acceptance document**

Use the required columns:

```text
full commit SHA
anonymized image ID
CP locator
base species
primary form
primary confidence
bbox
bbox confidence
tile ID
verified form
verification confidence
body plan
limb layout
fusion host
decisive feature
final effective form
canonical name
pass/fail
failure summary
```

Include exact Necrozma CP 4634/2914/2624 and lower upright cards, Dialga Origin 2882/2311/2823 and standard 4624/4565/2237/2274/2291/2245, Palkia Origin 2223/2225/2255 and standard 2301/2345/2353/2310/2317/2913. State CP is locator only. Every result field is `NOT RUN`; no image/hash/data URL.

- [ ] **Step 7: Run GREEN and full regression verification**

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
python -m py_compile tests/run_browser_tests.py tests/verify_regressions.py
node --check smart-hundo-form-verifier.js
node --check smart-hundo-helpers.js
git diff --check
```

Expected: every browser group and source check passes; failed groups 0; native/live OpenAI requests 0.

- [ ] **Step 8: Commit**

```powershell
git add smart-hundo-helpers.js index.html tests/smart-hundo-form-verifier.test.html tests/smart-hundo.test.html tests/run_browser_tests.py tests/verify_regressions.py docs/manual-tests/smart-hundo-crop-form-verifier-v2.md
git commit -m "test: lock smart hundo form verifier regressions"
```

## Final verification and delivery

- [ ] Run the complete final commands:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
python -m py_compile tests/run_browser_tests.py tests/verify_regressions.py
node --check smart-hundo-form-verifier.js
node --check smart-hundo-helpers.js
git diff --check
git diff --check origin/main...HEAD
```

- [ ] Extract the inline module source from `index.html`, remove static imports if present, save only to the plan’s ignored SDD workspace, and run `node --check` on that temporary `.mjs`.

- [ ] Confirm headless browser output contains no console error or unhandled rejection and reports native/live OpenAI requests 0.

- [ ] Scan production/log/diagnostic source for API key、Authorization、Bearer、image data URL、raw request/response logging.

- [ ] Review `git diff --stat origin/main...HEAD` and every hunk in `git diff -U10 origin/main...HEAD`.

- [ ] Scan `git diff --name-only --diff-filter=A origin/main...HEAD` and reject PNG/JPEG/WebP/GIF/BMP/TIFF/AVIF/SVG/PDF/HAR/private crop assets.

- [ ] Request independent whole-branch code review on the complete diff package with the most capable reviewer. Fix every Critical and Important finding with a failing regression test first, then run one scoped re-review.

- [ ] Re-run the complete final commands after all review fixes.

- [ ] Confirm:

```powershell
git status --short
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
git rev-parse HEAD
```

- [ ] Push without force:

```powershell
git push -u origin feat/smart-hundo-crop-form-verifier-v2
```

- [ ] Create a Draft PR targeting `main` titled:

```text
feat: add smart hundo crop form verifier v2
```

The PR body records architecture, exact test totals, zero live OpenAI requests, `NOT RUN` real-image status, privacy boundary, known limitations, `merged = false`, and no auto-merge.

## Plan self-review

- Spec coverage: all three species、seven forms、bbox、crop、contact sheet、request count、schema/prompt、tuple validation、merge、state/grouping/overlap、reasons、diagnostics/status、tests/manual/Git delivery are assigned to a task.
- Placeholder scan: the plan contains no deferred implementation marker; every task names concrete files, APIs, literal expectations, commands and commit messages.
- Type consistency: Stage 1 uses integer 0–1000 bbox; runtime candidate jobs and verifier mappings use exact `card_id`/`tile_id`; Stage 2 normalized result fields match schema and final diagnostic fields.
- Authority check: target final form comes only from valid Stage 2; every missing/uncertain/invalid/request-failure path clears effective/canonical and cannot use Stage 1 fallback.
- Scope check: non-target families and protected ordinary/count/team/persistence paths are explicitly locked.
