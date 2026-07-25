# Smart Hundo State Pipeline V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable dedicated Pokémon GO smart-hundo pipeline that routes only the exact normalized hundo query, extracts count and cards independently, validates five state dimensions from strict evidence, merges multiple screenshots safely, and preserves all ordinary scanner behavior.

**Architecture:** Put normalization, legacy adaptation, evidence validation, display conversion, count voting, completeness checks, overlap detection, and diagnostics shaping in `smart-hundo-helpers.js`. Keep schemas, prompts, image preparation, OpenAI transport, scan-session ownership, form writes, and status rendering in `index.html`. Stage V2 beside the current production request until every pure/helper and browser contract is green, then perform one final production cutover and remove V1 transitional code.

**Tech Stack:** Browser JavaScript, one HTML module, strict OpenAI Chat Completions JSON Schema, dependency-free Python browser harness, headless Edge/Chrome, static Python regression checks, Git.

## Global Constraints

- Branch: `feat/smart-hundo-state-pipeline-v2`; base: latest `origin/main`.
- Keep `OPENAI_MODEL = 'gpt-4.1-mini'`, the OpenAI endpoint, API-key storage, ordinary 1000px/JPEG 0.7 compression, and ordinary `detail: 'auto'`.
- Card/state extraction uses the complete untouched original image and `detail: 'high'`.
- Count extraction uses a lossless native-resolution top-region PNG and `detail: 'high'`; approximately 42% is input focus, never a fixed coordinate rule.
- Exactly one logical count operation and one logical card/state operation per matching screenshot; never one request per Pokémon.
- The V2 card schema never contains `hundo_leg`.
- No external dependencies and no paid live OpenAI request in automated tests.
- Do not change Firebase schema/paths, GAS payload, generated copywriting, manual save, special-survey checkboxes, Fusion/Mega fields, or non-hundo form fields.
- Never log API keys, Authorization/Bearer values, image data URLs, uploaded `File` objects, Firebase/GAS credentials, or account/password values.
- `global`, `global_background`, and `全球背卡` are invalid in the V2 path and never map to commemorative.
- Raw model states never directly create display prefixes; only JavaScript-validated `effective_*` states do.
- A structural retry replaces the first result; two rounds of `cards[]` are never appended.
- Do not merge the final PR automatically.

---

## File Responsibility Map

- `smart-hundo-helpers.js`
  - Pure V2 contracts and constants.
  - Query canonicalization and job partitioning.
  - Card/root normalization and legacy Rocket adapter.
  - Evidence validators and effective state derivation.
  - Display names, grouping, manual-review summaries.
  - Count evidence validation/voting.
  - Structural completeness and overlap merge.
  - Safe diagnostics projection.
- `index.html`
  - V1 staging schema during early tasks, final V2 schemas.
  - Count/card prompts.
  - Original/count-region image preparation.
  - OpenAI response metadata and controlled retry.
  - Smart scan session/provenance and form integration.
  - Safe user-facing status.
- `tests/smart-hundo.test.html`
  - Pure helper contracts and real-page-module browser tests.
  - Mocked OpenAI-shaped responses only.
- `tests/verify_regressions.py`
  - Static locks for ordinary scanning, persistence, prompts, payloads, model/endpoint, and safe logging.
- `docs/manual-tests/smart-hundo-state-pipeline-v2.md`
  - Real-screenshot acceptance cases A–E and redaction instructions.

---

### Task 1: Five-Dimension State Contract and Legacy Adapter

**Files:**
- Modify: `tests/smart-hundo.test.html:107-283`
- Modify: `smart-hundo-helpers.js:4-163`
- Modify: `index.html:696-735,1683-1699`

**Interfaces:**
- Produces `adaptLegacyRocketState(card): "normal" | "shadow" | "purified" | "uncertain"`.
- Produces `normalizeSmartHundoCard(card, normalizeOfficialName, options): NormalizedHundoCard`.
- Produces V2 `normalizeSmartHundoResult(result, normalizeOfficialName, options): NormalizedHundoScreenshot`.
- Produces temporary `normalizeLegacySmartHundoResult()` and `legacySmartHundoCardsToPokemonList()` used only by the V1 production call until Task 8.
- Produces staged `HUNDO_SMART_SCHEMA`; renames the live schema to `HUNDO_SMART_SCHEMA_V1` and leaves the live request on V1 until Task 8.

- [ ] **Step 1: Add failing contract tests**

Replace the old card fixture with a complete V2 raw-card fixture. Define one explicit absent-evidence factory per schema shape so every strict property is present:

```js
const sparkleEvidence = (overrides = {}) => ({
  present: false,
  region_visibility: 'clear',
  position: 'none',
  color: 'none',
  shape: 'none',
  ...overrides
});
const appearanceEvidence = (overrides = {}) => ({
  present: false,
  region_visibility: 'clear',
  position: 'none',
  appearance: 'none',
  ...overrides
});
const backgroundEvidence = (overrides = {}) => ({
  present: false,
  region_visibility: 'clear',
  position: 'none',
  badge_type: 'none',
  appearance: 'none',
  ...overrides
});
```

The `card(overrides)` fixture must include CP, five raw state fields, five confidence fields, five evidence objects, and the existing species/position fields.

Add named browser groups that assert:

```js
test('expresses seven features through five state dimensions', () => {
  const normalized = normalizeSmartHundoCard(card({
    shiny_state: 'yes',
    lucky_state: 'yes',
    favorite_state: 'yes',
    rocket_state: 'purified',
    background_type: 'special'
  }), normalizeName, { screenshotIndex: 4 });
  equal(normalized.shiny_state, 'yes');
  equal(normalized.lucky_state, 'yes');
  equal(normalized.favorite_state, 'yes');
  equal(normalized.rocket_state, 'purified');
  equal(normalized.background_type, 'special');
  equal(normalized.effective_shiny_state, 'uncertain');
  equal(normalized.card_id, '4:1:1:1');
});

test('adapts legacy shadow and purified into one rocket state', () => {
  equal(adaptLegacyRocketState({ shadow_state: 'yes', purified_state: 'no' }), 'shadow');
  equal(adaptLegacyRocketState({ shadow_state: 'no', purified_state: 'yes' }), 'purified');
  equal(adaptLegacyRocketState({ shadow_state: 'yes', purified_state: 'yes' }), 'uncertain');
  equal(adaptLegacyRocketState({ shadow_state: 'no', purified_state: 'no' }), 'normal');
  equal(adaptLegacyRocketState({ shadow_state: 'yes' }), 'uncertain');
});

test('rejects global without converting it to commemorative', () => {
  const normalized = normalizeSmartHundoCard(card({ background_type: 'global' }), normalizeName);
  equal(normalized.raw.states.background, 'global');
  equal(normalized.background_type, 'uncertain');
  equal(normalized.effective_background_type, 'uncertain');
});
```

Assert V2 schema root keys are exactly `detected_card_count`, `scan_complete`, `bottom_edge_checked`, `enumeration_confidence`, `cards`; assert it has no `hundo_leg`, `shadow_state`, `purified_state`, or `global`. Assert every evidence object has `additionalProperties: false`, required `region_visibility`, and all properties required.

- [ ] **Step 2: Run browser tests and confirm RED**

Run:

```text
python tests/run_browser_tests.py
```

Expected: FAIL because `normalizeSmartHundoCard`, `adaptLegacyRocketState`, and the five-dimension schema do not exist.

- [ ] **Step 3: Implement the normalized data contract**

Add exact enum sets:

```js
const INDEPENDENT_STATE_VALUES = new Set(['yes', 'no', 'uncertain']);
const ROCKET_STATE_VALUES = new Set(['normal', 'shadow', 'purified', 'uncertain']);
const BACKGROUND_TYPE_VALUES = new Set(['none', 'commemorative', 'special', 'uncertain']);
const EFFECTIVE_STATE_DEFAULTS = Object.freeze({
  shiny: 'uncertain',
  lucky: 'uncertain',
  favorite: 'uncertain',
  rocket: 'uncertain',
  background: 'uncertain'
});
```

Normalize the exact raw value into `raw.states`, clamp normalized confidences without losing raw values in `raw.confidences`, deep-normalize evidence enums into `raw.evidence`, and initialize every effective field to `uncertain`. For legacy-only inputs, call `adaptLegacyRocketState`; missing lucky/favorite/background remain `uncertain`.

Define `card_id` as `${screenshot_index}:${order}:${row}:${column}`. Duplicate coordinates within one screenshot are preserved long enough for the structural validator to reject them.

In `index.html`, rename the current schema to `HUNDO_SMART_SCHEMA_V1`, add the strict V2 `HUNDO_SMART_SCHEMA`, and keep `requestSmartHundoExtractionV1()` wired to V1. Do not wire V2 into `autoScan()`.

- [ ] **Step 4: Run focused and regression tests for GREEN**

Run:

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Expected: all current and new groups pass; regression checks remain 7/7 or increase only through new explicit locks.

- [ ] **Step 5: Commit the contract**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html
git commit -m "feat: define smart hundo v2 state contract"
```

---

### Task 2: Effective-State Display and Manual-Review Model

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`

**Interfaces:**
- Produces `buildHundoDisplayName(card, normalizeOfficialName): string`.
- Produces `smartHundoCardsToPokemonList(cards, normalizeOfficialName): { pokemon_list, recognized_count, review_card_count, review_reason_counts }`.
- Produces `summarizeHundoManualReview(cards, screenshotReasons): { review_card_count, review_reason_counts, manual_review_reasons }`.
- Consumes only `effective_shiny_state`, `effective_rocket_state`, and `effective_background_type` for visible prefixes.

- [ ] **Step 1: Add failing effective-state/display tests**

Define an explicit test-only validated fixture; it does not perform evidence validation:

```js
const validatedCard = (overrides = {}) => ({
  ...card(),
  screenshot_index: 0,
  card_id: '0:1:1:1',
  effective_shiny_state: 'no',
  effective_lucky_state: 'no',
  effective_favorite_state: 'no',
  effective_rocket_state: 'normal',
  effective_background_type: 'none',
  manual_review_reasons: [],
  ...overrides
});
```

Use this fixture to test display conversion independently from Task 3 evidence rules:

```js
test('builds display names only from effective states', () => {
  const modelYesButRejected = card({
    official_name: '固拉多',
    shiny_state: 'yes',
    effective_shiny_state: 'uncertain',
    effective_rocket_state: 'purified',
    effective_background_type: 'none'
  });
  equal(buildHundoDisplayName(modelYesButRejected, normalizeName), '固拉多');
});

test('keeps hidden states internal and groups by display name', () => {
  const cards = [
    validatedCard({ official_name: '固拉多', effective_rocket_state: 'normal' }),
    validatedCard({ official_name: '固拉多', effective_rocket_state: 'purified' }),
    validatedCard({ official_name: '固拉多', effective_lucky_state: 'yes' })
  ];
  equal(smartHundoCardsToPokemonList(cards, normalizeName).pokemon_list, '固拉多*3');
});

test('separates visible states in fixed prefix order', () => {
  const cards = [
    validatedCard({ official_name: '固拉多' }),
    validatedCard({ official_name: '固拉多', effective_shiny_state: 'yes' }),
    validatedCard({ official_name: '固拉多', effective_background_type: 'special' })
  ];
  equal(
    smartHundoCardsToPokemonList(cards, normalizeName).pokemon_list,
    '固拉多,色違固拉多,特別背卡固拉多'
  );
  equal(buildHundoDisplayName(validatedCard({
    official_name: '超夢',
    effective_shiny_state: 'yes',
    effective_rocket_state: 'shadow',
    effective_background_type: 'special'
  }), normalizeName), '色違暗影特別背卡超夢');
});
```

Add a no-`*1` assertion. Add one card with three review reasons and assert three reason buckets but `review_card_count === 1`.

Add a recognized Groudon with `effective_shiny_state: 'uncertain'`; assert the list still contains `固拉多`, does not contain `色違固拉多`, and includes `shiny_uncertain`. Add an uncertain/partial species with a non-empty `visible_label`; assert it is excluded and the label is never used as fallback.

- [ ] **Step 2: Run browser tests and confirm RED**

Expected failure: the display helper and deduplicated manual-review summary are absent, and the old converter reads raw state fields.

- [ ] **Step 3: Implement display and grouping**

Implement prefix order:

```js
const prefix = [
  card.effective_shiny_state === 'yes' ? '色違' : '',
  card.effective_rocket_state === 'shadow' ? '暗影' : '',
  card.effective_background_type === 'commemorative' ? '紀念背卡' : '',
  card.effective_background_type === 'special' ? '特別背卡' : ''
].join('');
```

Never inspect lucky, favorite, or purified when building the prefix. Build one display name per recognized species, then group exact display names in first-seen order. Manual reasons use stable codes and `Set(card_id)` for unique review-card totals.

- [ ] **Step 4: Run GREEN verification**

Run browser tests, regression checks, and `git diff --check`. Confirm the exact three acceptance strings:

```text
固拉多*3
固拉多,色違固拉多,特別背卡固拉多
色違暗影特別背卡超夢
```

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js tests/smart-hundo.test.html
git commit -m "feat: build hundo lists from effective states"
```

---

### Task 3: Evidence Validators and Confidence Thresholds

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`

**Interfaces:**
- Produces constants:
  - `SPECIES_CONFIDENCE_THRESHOLD = 0.80`
  - `STATE_YES_CONFIDENCE_THRESHOLD = 0.85`
  - `STATE_NEGATIVE_CONFIDENCE_THRESHOLD = 0.75`
  - `ENUMERATION_CONFIDENCE_THRESHOLD = 0.85`
- Produces `isValidShinyEvidence`, `isValidLuckyEvidence`, `isValidFavoriteEvidence`.
- Produces `deriveRocketStateFromEvidence`, `deriveBackgroundTypeFromEvidence`.
- Produces `validateHundoCardStates(card): ValidatedHundoCard`.

- [ ] **Step 1: Add failing evidence tests**

Define:

```js
const normalizedCard = (overrides = {}) => normalizeSmartHundoCard(
  card(overrides),
  normalizeName,
  { screenshotIndex: 0 }
);
const cyanPurificationEvidence = () => ({
  present: true,
  region_visibility: 'clear',
  position: 'lower_left',
  color: 'light_cyan',
  shape: 'single_radial_sparkle'
});
```

Cover:

```js
test('validates dark teal CP-area sparkles as shiny', () => {
  const validated = validateHundoCardStates(normalizedCard({
    shiny_state: 'yes',
    shiny_confidence: 0.98,
    shiny_evidence: {
      present: true,
      region_visibility: 'clear',
      position: 'cp_area',
      color: 'dark_blue_teal',
      shape: 'multiple_four_point_sparkles'
    }
  }));
  equal(validated.effective_shiny_state, 'yes');
});

test('purified Groudon never becomes shiny from cyan radial evidence', () => {
  const validated = validateHundoCardStates(normalizedCard({
    official_name: '固拉多',
    shiny_state: 'yes',
    shiny_confidence: 0.98,
    shiny_evidence: cyanPurificationEvidence(),
    rocket_state: 'purified',
    rocket_confidence: 0.98,
    rocket_evidence: cyanPurificationEvidence()
  }));
  equal(validated.effective_shiny_state, 'uncertain');
  equal(validated.effective_rocket_state, 'purified');
  equal(buildHundoDisplayName(validated, normalizeName), '固拉多');
});
```

Also cover favorite, lucky, shadow, shiny+shadow, commemorative, special, raw/evidence contradictions, and invalid global.

For every dimension, assert `no`/`normal`/`none` becomes effective only when `region_visibility === 'clear'`, `present === false`, confidence is at least 0.75, and all evidence values are negative. Assert `partially_occluded`, `cropped`, `not_visible`, and `uncertain` produce effective `uncertain`.

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: validators and thresholds are missing.

- [ ] **Step 3: Implement validators in order**

Implement shiny, lucky, favorite, Rocket, then background. For positive states require raw state, evidence pattern, region visibility, and confidence to agree. For negative states require a clear region and explicit absence. Contradictions return `uncertain`; never infer an alternative state from contradictory raw/evidence.

`validateHundoCardStates()` copies raw data unchanged, assigns effective states, and appends only the relevant reason code once per dimension.

- [ ] **Step 4: Run GREEN verification**

Run:

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Expected exact acceptance:

```text
purified Groudon display = 固拉多
valid shiny display = 色違名稱
shiny + shadow display = 色違暗影名稱
```

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js tests/smart-hundo.test.html
git commit -m "feat: validate smart hundo state evidence"
```

---

### Task 4: Dedicated Hundo Count Contract and Semantic Merge

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`

**Interfaces:**
- Produces `HUNDO_COUNT_SCHEMA`.
- Produces `buildHundoCountPrompt()`.
- Produces `fileToHundoCountRegionDataUrl(originalDataUrl): Promise<string>`.
- Produces `normalizeHundoCountResult(result)`.
- Produces `validateHundoCountEvidence(result, classification): { hundo_leg, confidence, valid, raw_count_text, manual_review_reasons }`.
- Produces `mergeHundoCountResults(results): { hundo_leg, conflict, uncertain, candidates, manual_review_reasons }`.
- V2 components remain staged and are not called by `autoScan()` until Task 8.

- [ ] **Step 1: Add failing count/schema/prompt tests**

Assert strict schema keys/enums and prompt fragments for active Pokémon tab, semantic relationship, parentheses, color independence, egg/storage/CP/clock/battery/query/card exclusions.

Add deterministic validation:

```js
const exactHundoClassification = () => ({
  image_type: 'HUNDO_LEGENDARY_SCREEN',
  search_query: '傳說的寶可夢,幻,究極異獸&4*'
});
const validCount = (rawCountText = '(3)', hundoLeg = '3') => ({
  hundo_leg: hundoLeg,
  raw_count_text: rawCountText,
  active_tab: 'pokemon',
  count_source: 'pokemon_search_result_summary',
  relative_position: 'associated_with_active_pokemon_tab',
  has_parentheses: true,
  has_slash: false,
  confidence: 0.99
});
equal(validateHundoCountEvidence(validCount('(3)', '3'), exactHundoClassification()).hundo_leg, '3');
equal(validateHundoCountEvidence(validCount('（ 30 ）', '30'), exactHundoClassification()).hundo_leg, '30');
equal(validateHundoCountEvidence({ ...validCount(), raw_count_text: '9/12', has_slash: true }, exactHundoClassification()).hundo_leg, '');
equal(validateHundoCountEvidence({ ...validCount(), raw_count_text: '142/450' }, exactHundoClassification()).hundo_leg, '');
const missingUiContext = validateHundoCountEvidence({
  ...validCount(),
  active_tab: 'unknown',
  count_source: 'uncertain',
  relative_position: 'uncertain'
}, exactHundoClassification());
equal(missingUiContext.hundo_leg, '');
deepEqual(missingUiContext.manual_review_reasons, ['hundo_count_uncertain']);
```

Add merge assertions:

```js
const count = (hundoLeg, confidence) => ({
  hundo_leg: hundoLeg,
  confidence,
  valid: true,
  manual_review_reasons: []
});
const majority = mergeHundoCountResults([count('3', .90), count('3', .88), count('9', .99)]);
equal(majority.hundo_leg, '3');
equal(majority.conflict, true);
equal(majority.uncertain, false);
deepEqual(majority.candidates.map(candidate => candidate.value), ['3', '9']);

const unresolved = mergeHundoCountResults([count('3', .95), count('9', .95)]);
equal(unresolved.hundo_leg, '');
equal(unresolved.conflict, true);
equal(unresolved.uncertain, true);
deepEqual(unresolved.manual_review_reasons, ['hundo_count_conflict', 'hundo_count_uncertain']);
equal(mergeHundoCountResults([count('3', .91)]).hundo_leg, '3');
equal(mergeHundoCountResults([count('3', .91), count('3', .87)]).hundo_leg, '3');
```

Reorder the tied inputs and assert the same unresolved result. Assert no cards-derived field appears in the merge API.

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: no dedicated count schema/helpers exist.

- [ ] **Step 3: Implement semantic validation and tie handling**

Normalize raw count text with NFKC, match only `/^\(\s*(\d+)\s*\)$/`, standardize parsed integer with `String(Number(digits))`, and require all nine evidence conditions plus confidence >= 0.85.

Vote by frequency, then highest confidence only. If confidence remains tied, return empty count with both review reasons and all safe candidates. Never use value size, upload order, screenshot index, cards length, detected count, or visible count.

Implement a native-resolution canvas crop using full width and `Math.ceil(height * 0.42)`, output `canvas.toDataURL('image/png')`. The prompt—not the crop coordinate—defines legal evidence. Missing active-tab/summary/egg-exclusion context must normalize to uncertain.

- [ ] **Step 4: Run GREEN verification**

Run browser and regression tests. Assert ordinary JPEG compressor call count/settings remain unchanged and the count region is PNG/high detail.

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html
git commit -m "feat: add semantic hundo count extraction"
```

---

### Task 5: Complete Card Enumeration and Replacement Retry

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`

**Interfaces:**
- Produces `validateSmartHundoStructure(result, finishReason)`.
- Produces `requestOpenAiJsonSchema(..., { includeMetadata: true })` response `{ result, finish_reason }` without changing default ordinary return values.
- Produces staged `buildSmartHundoPrompt()`, `requestSmartHundoExtractionV2()`, and `requestSmartHundoWithStructuralRetry(): { result, finish_reason, structural_retry_used, structural_retry_reason }`.

- [ ] **Step 1: Add failing enumeration tests**

Test 12-card and 15-card arrays survive normalization. Test a partial card with empty official name remains in `cards`.

Test incomplete conditions independently:

```js
equal(validateSmartHundoStructure({
  detected_card_count: 15,
  scan_complete: true,
  bottom_edge_checked: true,
  enumeration_confidence: .98,
  cards: makeCards(10)
}, 'stop').structurally_complete, false);
```

Also cover `scan_complete: false`, `bottom_edge_checked: false`, duplicate coordinates, and `finish_reason: 'length'`.

Mock first response with 10/15 mismatch and second response with 15 cards. Assert exactly two logical extraction calls, returned cards equal only the second response, and no first-round card is present. Assert uncertain state alone makes one call.

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: structural validator, metadata return, and controlled replacement retry are missing.

- [ ] **Step 3: Implement completeness and replacement**

Update `requestOpenAiJsonSchema` so ordinary callers still receive the parsed result. Only `{ includeMetadata: true }` returns:

```js
{
  result: parseJsonText(parseOpenAIMessageContent(data)),
  finish_reason: String(data?.choices?.[0]?.finish_reason || '')
}
```

`requestSmartHundoWithStructuralRetry()` calls once, validates, and calls once more only for structural incompleteness/truncation. The second normalized result replaces the first. Diagnostics retain retry reason and attempt count, not first-round cards.

Prompt explicitly requires top-to-bottom, left-to-right, beyond ten cards, bottom edge, full/partial cards, no neighbor-symbol transfer, and no invented cards.

The same prompt must require official Traditional Chinese species/form identification from silhouette, head, limbs, wings, tail, horns, armor, and form-specific visual features; visible labels remain secondary and `GLO蒼響151515` may normalize only to visually supported `蒼響`. It must preserve identifiable 焰白／闇黑酋雷姆、蒼響劍王、藏瑪然特盾王、origin, and fusion forms, and leave `official_name` empty when unreliable.

Add the five evidence sections only now, after Tasks 1–3 are green:

- dark-blue/teal multiple four-point sparkles at CP area for shiny;
- large gold shimmering background behind the Pokémon for lucky;
- filled yellow five-point star at upper-right for favorite;
- light-cyan lower-side radial/starburst for purified and purple flame/smoke/aura for shadow;
- actual commemorative/location or event-special badge/background evidence for background type;
- explicit clear/occluded/cropped region visibility for every state;
- color or body color alone is never sufficient.

- [ ] **Step 4: Run GREEN verification**

Run browser/regression tests and check:

```text
12 normalized cards
15 normalized cards
second attempt cards only
uncertain status => no structural retry
```

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html
git commit -m "feat: enforce complete hundo card enumeration"
```

---

### Task 6: Cross-Screenshot Overlap and Safe Diagnostics

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`

**Interfaces:**
- Produces `detectScreenshotOverlap(left, right)`.
- Produces `mergeSmartHundoScreenshots(screenshots, normalizeOfficialName)`.
- Produces `shapeSmartHundoDiagnostics(session)`.
- Produces `normalizeVisibleLabel(value): string` using NFKC and Unicode whitespace removal.

- [ ] **Step 1: Add failing overlap and diagnostics tests**

Build screenshot A suffix `[鳳王 CP100, 超夢 CP200]` and screenshot B prefix with the same normalized signatures. Assert one sequence is removed.

Build a single matching boundary card and assert no deduplication plus `screenshot_overlap_uncertain`.

Build identical species/CP/label cards that are not a boundary sequence and assert both remain.

Serialize diagnostics and assert it contains screenshot indexes, raw/effective enum state data, overlap decisions, completeness, finish reason, safe count candidates, and final list. Assert it excludes sentinels:

```text
test-key
Authorization
Bearer
data:image/
ORIGINAL_
COUNT_CROP_
classificationDataUrl
originalDataUrl
File
firebase-api-key
gas-secret
account;password
```

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: overlap and diagnostics helpers do not exist.

- [ ] **Step 3: Implement conservative overlap**

Signature fields:

```js
[
  card.cp,
  card.official_name,
  normalizeVisibleLabel(card.visible_label),
  card.effective_shiny_state,
  card.effective_lucky_state,
  card.effective_favorite_state,
  card.effective_rocket_state,
  card.effective_background_type
]
```

Compare suffix/prefix both directions. Require at least two consecutive exact signatures. Ambiguous competing overlaps preserve all cards. Apply overlap removal before grouping and manual-review card totals.

Diagnostics are constructed by explicit allowlist, never by spreading job/request objects.

- [ ] **Step 4: Run GREEN verification**

Run browser/regression tests and serialize all captured logs/diagnostics to recheck forbidden sentinels.

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js tests/smart-hundo.test.html
git commit -m "feat: merge overlapping hundo screenshots safely"
```

---

### Task 7: Smart-Hundo Session Ownership

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `index.html:425-442,1720-1742,2068-2081,2288-2291`

**Interfaces:**
- Produces `beginSmartHundoScanSession(): sessionId`.
- Produces `markSmartHundoAiValue(inputId, value, sessionId)`.
- Produces `handleSmartHundoManualEdit(inputId)`.
- Produces `isCurrentSmartHundoSession(sessionId)`.
- Tracks only `g_hundos` and `st_hundo_leg`.

- [ ] **Step 1: Add failing session tests**

Cover:

```js
const first = beginSmartHundoScanSession();
markSmartHundoAiValue('g_hundos', '舊 AI 百神', first);
const second = beginSmartHundoScanSession();
equal(document.getElementById('g_hundos').value, '');

document.getElementById('g_hundos').value = '使用者手動值';
handleSmartHundoManualEdit('g_hundos');
beginSmartHundoScanSession();
equal(document.getElementById('g_hundos').value, '使用者手動值');
```

Assert old session results cannot write after a new session starts. Assert count and list ownership are independent. Assert unrelated fields remain unchanged. Assert session start clears old smart diagnostics and never calls `resetForm()`.

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: no session/provenance helpers exist.

- [ ] **Step 3: Implement ownership**

Use a module-local monotonic counter and a `Map` containing `{ sessionId, value }` for the two hundo inputs. A manual input event deletes that field’s marker. New sessions clear a field only when its current value still equals the marked AI value.

Before every form/audit/status write, require `isCurrentSmartHundoSession(sessionId)`.

- [ ] **Step 4: Run GREEN verification**

Run browser/regression tests. Confirm old AI values clear, manual values survive until a validated replacement, stale callbacks do nothing, and ordinary fields stay unchanged.

- [ ] **Step 5: Commit**

```text
git add index.html tests/smart-hundo.test.html
git commit -m "fix: isolate smart hundo scan sessions"
```

---

### Task 8: Canonical Routing and Production V2 Cutover

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html:1098-1123,1683-1700,1887-2053`

**Interfaces:**
- Consumes all Tasks 1–7 V2 interfaces.
- Produces final production `smartHundoScan()` and `window.lastSmartHundoDiagnostics`.
- Removes `HUNDO_SMART_SCHEMA_V1`, V1 prompt/request/normalizers, and any raw-state prefix logic.

- [ ] **Step 1: Add failing end-to-end browser tests**

Mock arbitrary upload order:

```text
PROFILE
exact HUNDO A
RESOURCE
exact HUNDO B returned as raw OTHER
SHINY_LEGENDARY
```

Assert both exact query jobs canonicalize to `HUNDO_LEGENDARY_SCREEN` and enter smart jobs; no incomplete/similar query does.

For each smart screenshot assert:

- one original full-image card request at high detail;
- one lossless PNG count-region request at high detail;
- no smart image enters ordinary extraction/validation;
- all classifications finish before extraction begins.

Mock count values 3, 3, 9 across three screenshots and assert final `st_hundo_leg = 3` with conflict diagnostic. Mock exact confidence tie 3 vs 9 and assert the field remains blank with both reasons.

Mock cards:

```text
鳳王
哲爾尼亞斯
purified 雷吉奇卡斯
```

Assert:

```text
st_hundo_leg = 3
g_hundos = 鳳王,哲爾尼亞斯,雷吉奇卡斯
```

Assert detailed status formats for fully successful, count unresolved, state-review breakdown, incomplete enumeration, overlap uncertainty, and request failure.

- [ ] **Step 2: Run tests and confirm RED**

Expected failure: production still uses V1 combined count/card extraction and raw-type routing.

- [ ] **Step 3: Perform one final cutover**

Change `normalizeAiClassification()` so exact normalized hundo query overrides an incorrect raw image type to canonical HUNDO. Partition all jobs after canonicalization.

For each smart job:

1. Read the original data URL once.
2. Derive the count-region PNG locally.
3. Run count and V2 card operations independently with `Promise.allSettled`.
4. Validate count evidence and card structure independently.
5. Attach screenshot index and safe metadata.

Merge count results, merge screenshots with overlap, validate states, build display names, group, summarize reviews, shape diagnostics, and apply only current-session validated replacements.

Set both `window.lastSmartHundoDiagnostics` and compatibility alias `window.lastSmartHundoScanResult` to the same safe allowlisted object.

Remove all V1 transitional definitions and direct raw-state conversion. Keep the ordinary HUNDO metadata only where existing classification compatibility requires it, but exact smart jobs must never reach ordinary extraction.

Replace full-error console logging with a safe `{ stage, name, httpStatus, reasonCode }` summary. Keep the existing generic user alert, never put OpenAI response text into diagnostics or console, and never log the thrown `Error` object itself.

- [ ] **Step 4: Run full GREEN verification**

Run:

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Confirm exact acceptance:

```text
hundo count: 3
pokemon_list: 鳳王,哲爾尼亞斯,雷吉奇卡斯
purified Groudon: 固拉多
hidden grouping: 固拉多*3
visible grouping: 固拉多,色違固拉多,特別背卡固拉多
```

- [ ] **Step 5: Commit**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html
git commit -m "feat: activate smart hundo state pipeline v2"
```

---

### Task 9: Regression Locks and Manual Acceptance Documentation

**Files:**
- Modify: `tests/verify_regressions.py`
- Create: `docs/manual-tests/smart-hundo-state-pipeline-v2.md`
- Modify: `tests/smart-hundo.test.html`

**Interfaces:**
- Produces static regression checks and documented real-screenshot acceptance only.

- [ ] **Step 1: Add failing regression locks**

Add exact source-span snapshots for these unchanged production functions:

```text
buildAiClassificationPrompt() through the line before buildAiExtractionPrompt
buildAiExtractionPrompt() through the line before buildSmartHundoPrompt
fileToResizedDataUrl() through the line before buildAiRequestContent
window.saveAccountToInventory() through the line before window.deleteAccount
window.generateText() through the line before window.copyInventoryText
```

Compute expected SHA-256 values from `origin/main:index.html`, store them as named constants in `tests/verify_regressions.py`, and assert normalized LF content. Keep the existing `newItem` hash/length.

Add exact required/forbidden fragment checks proving:

- ordinary classification/extraction prompts remain unchanged outside the hundo branch;
- ordinary image compression/detail constants remain unchanged;
- endpoint/model/API storage remain unchanged;
- `newItem`, GAS payload, generated copywriting, manual save, team/resource/profile paths remain unchanged;
- V2 schema excludes `hundo_leg`, `shadow_state`, `purified_state`, `global`;
- smart diagnostics/log code does not include forbidden sensitive field names.

Run `python tests/verify_regressions.py` and confirm RED where the new manual doc/locks are absent.

- [ ] **Step 2: Create the manual acceptance document**

Document setup, redaction, request-count inspection, and cases:

```text
Case A: (3), egg 9/12, 鳳王/哲爾尼亞斯/淨化雷吉奇卡斯
        => 3; 鳳王,哲爾尼亞斯,雷吉奇卡斯
Case B: 藏瑪然特/拉帝亞斯/蒼響/淨化固拉多/藏瑪然特/酋雷姆
        => 藏瑪然特*2,拉帝亞斯,蒼響,固拉多,酋雷姆
Case C: 鳳王/鳳王/閃電鳥/蒼響/蓋歐卡/炎帝
        => 鳳王*2,閃電鳥,蒼響,蓋歐卡,炎帝
Case D: 12+ full/partial cards all represented
Case E: strong two-card overlap removed; legitimate duplicates retained
```

Mark these as manual; do not claim mock tests prove real visual accuracy.

- [ ] **Step 3: Run GREEN verification**

Run browser tests, regression checks, and `git diff --check`.

- [ ] **Step 4: Commit**

```text
git add tests/verify_regressions.py tests/smart-hundo.test.html docs/manual-tests/smart-hundo-state-pipeline-v2.md
git commit -m "test: lock smart hundo v2 regressions"
```

---

### Task 10: Final Verification, Review, Push, and Unmerged PR

**Files:**
- Review all files changed from `origin/main`.

**Interfaces:**
- Produces a verified branch and one open, unmerged PR.

- [ ] **Step 1: Run syntax validation**

Run:

```text
node --check smart-hundo-helpers.js
python tests/run_browser_tests.py
```

`node --check` parses the standalone helper. The browser harness extracts and evaluates the real `index.html` module, so a module syntax error fails the browser command. Do not install a package manager or external linter.

- [ ] **Step 2: Run the required full suite**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Record exact passed/failed totals from command output.

- [ ] **Step 3: Audit scope and secrets**

Run:

```text
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD
rg -n "TO[D]O|TB[D]|Authorization|Bearer|data:image/|originalDataUrl|classificationDataUrl" smart-hundo-helpers.js index.html tests docs
```

Classify every match; request payload construction is expected, logs/diagnostics containing those values are forbidden. Confirm no unrelated files or ordinary behavior changed.

- [ ] **Step 4: Request two-stage code review**

Use `superpowers:requesting-code-review` for specification compliance and code quality. Resolve each concrete finding with a failing regression test first, then rerun the full suite.

- [ ] **Step 5: Push and create the PR**

```text
git push -u origin feat/smart-hundo-state-pipeline-v2
```

Open a non-merged PR targeting `main` with:

```text
Title: feat: refactor smart hundo state pipeline v2
```

PR body must summarize routing, independent count/card requests, evidence validation, effective-state display, structural retry replacement, overlap, session isolation, safe diagnostics, and exact test totals. Do not merge.
