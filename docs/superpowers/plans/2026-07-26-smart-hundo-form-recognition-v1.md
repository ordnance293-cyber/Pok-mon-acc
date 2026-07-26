# Smart Hundo Pokémon Form Recognition V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Smart Hundo State Pipeline V2 so the existing full-image card request returns a structured, evidence-backed form for exactly 10 base species and JavaScript emits exactly 23 approved canonical display names without silent standard-form fallback.

**Architecture:** Keep model-facing schema/prompt/request logic in `index.html` and pure contracts, normalization, validation, canonical naming, display/grouping, overlap, review, and safe diagnostics in `smart-hundo-helpers.js`. Every card is normalized, form-validated, state-validated, converted to a canonical display name, then grouped; unresolved whitelist forms remain diagnostic cards but never enter `pokemon_list`.

**Tech Stack:** Browser JavaScript, strict OpenAI Chat Completions JSON Schema, one HTML module, dependency-free Python headless Edge/Chrome harness, static Python regression checks, Git.

## Global Constraints

- Branch: `feat/smart-hundo-form-recognition-v1`; base: `origin/main` at `fc16deefe0c8a559d0d29596fdc56ed10e169a3b`.
- PR #33 merge commit `e2518e70edbaad9e9716e96cf0b16f97286ca35d` and PR #34 merge commit `fc16deefe0c8a559d0d29596fdc56ed10e169a3b` are required ancestors.
- Exactly 10 base species and exactly 23 supported form IDs; never add another family or form.
- Control form IDs are exactly `not_applicable`, `uncertain`, and `unsupported`.
- `FORM_CONFIDENCE_THRESHOLD = 0.85`; `FORM_PARTIAL_VISIBILITY_THRESHOLD = 0.93`; existing `SPECIES_CONFIDENCE_THRESHOLD = 0.80` remains unchanged.
- Whitelist species never use raw `official_name` or a generic `visible_label` as proof of standard form.
- No unresolved, unsupported, or mismatched whitelist form enters `pokemon_list`.
- Non-whitelist species retain the existing sanitized official-name path after validation sets `effective_form_id = 'not_applicable'`.
- Keep one count operation and one full-image card/state operation per matching screenshot, plus only the existing one controlled structural retry when structurally incomplete.
- Do not create a per-Pokémon request, a traditional computer-vision pipeline, OpenCV use, contour extraction, pixel templates, or external dependencies.
- Keep the complete original image and `detail: 'high'` for the card/state request.
- Do not change hundo-count schema, prompt, crop, extraction, validation, merge, routing, or request count.
- Do not change shiny, lucky, favorite, rocket, background, trainer-team, ordinary scan, model, endpoint, key storage, Firebase, GAS, generated copywriting, manual save, special-survey, Fusion, Mega, or ordinary compression behavior.
- Visible prefix order remains `色違` → `暗影` → `紀念背卡`/`特別背卡`; lucky, favorite, and purified remain hidden.
- Automated tests use mocks only and make zero live or paid OpenAI requests.
- Never log or persist API keys, Authorization/Bearer, image data URLs, `File`, complete API bodies, account/password, Firebase credentials, or GAS credentials.
- Do not merge or enable auto-merge.

### Exact canonical form map

```js
const HUNDO_FORM_CANONICAL_NAMES = Object.freeze({
  articuno_standard: '急凍鳥',
  articuno_galarian: '伽勒爾急凍鳥',
  zapdos_standard: '閃電鳥',
  zapdos_galarian: '伽勒爾閃電鳥',
  moltres_standard: '火焰鳥',
  moltres_galarian: '伽勒爾火焰鳥',
  zacian_standard: '蒼響',
  zacian_crowned: '蒼響劍盾型態',
  zamazenta_standard: '藏瑪然特',
  zamazenta_crowned: '藏瑪然特劍盾型態',
  dialga_standard: '帝牙盧卡',
  dialga_origin: '起源帝牙盧卡',
  palkia_standard: '帕路奇亞',
  palkia_origin: '起源帕路奇亞',
  zygarde_10: '基格爾德（10%形態）',
  zygarde_50: '基格爾德（50%形態）',
  zygarde_complete: '基格爾德（完全體形態）',
  necrozma_base: '奈克洛茲瑪',
  necrozma_dusk_mane: '奈克洛茲瑪（黃昏之鬃）',
  necrozma_dawn_wings: '奈克洛茲瑪（拂曉之翼）',
  kyurem_base: '酋雷姆',
  kyurem_white: '焰白酋雷姆',
  kyurem_black: '闇黑酋雷姆'
});
```

### Exact compatibility map

```js
const HUNDO_FORMS_BY_BASE_SPECIES = Object.freeze({
  急凍鳥: Object.freeze(['articuno_standard', 'articuno_galarian']),
  閃電鳥: Object.freeze(['zapdos_standard', 'zapdos_galarian']),
  火焰鳥: Object.freeze(['moltres_standard', 'moltres_galarian']),
  蒼響: Object.freeze(['zacian_standard', 'zacian_crowned']),
  藏瑪然特: Object.freeze(['zamazenta_standard', 'zamazenta_crowned']),
  帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin']),
  帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin']),
  基格爾德: Object.freeze(['zygarde_10', 'zygarde_50', 'zygarde_complete']),
  奈克洛茲瑪: Object.freeze([
    'necrozma_base',
    'necrozma_dusk_mane',
    'necrozma_dawn_wings'
  ]),
  酋雷姆: Object.freeze(['kyurem_base', 'kyurem_white', 'kyurem_black'])
});
```

---

## File Responsibility Map

- `smart-hundo-helpers.js`
  - Immutable form names, compatibility, enums, aliases, thresholds.
  - Base/form/evidence normalization and legacy adaptation.
  - Deterministic form validation and canonical official names.
  - Form-aware recognized-species gate, display/grouping, overlap, review summary, diagnostics.
- `index.html`
  - Existing schema extended with required form fields.
  - Existing full-image prompt extended with detailed B2/B3 form guidance.
  - Existing `smartHundoScan()` changed only to validate forms before states.
  - Existing status formatter extended with form reason codes.
- `tests/smart-hundo.test.html`
  - Literal form fixtures, helper contracts, schema/prompt and production integration.
- `tests/verify_regressions.py`
  - Narrow immutable-source snapshots and persistence/privacy locks.
- `docs/manual-tests/smart-hundo-form-recognition-v1.md`
  - Real-image acceptance record template for cases A–K.

---

### Task 1: Pure Form Contract

**Files:**
- Modify: `tests/smart-hundo.test.html:100-380`
- Modify: `smart-hundo-helpers.js:1-449,1080-1114`
- Modify: `tests/verify_regressions.py:1-280`

**Interfaces:**
- Produces immutable `HUNDO_FORM_CANONICAL_NAMES`.
- Produces immutable `HUNDO_FORMS_BY_BASE_SPECIES`.
- Produces `normalizeHundoBaseSpecies(value, normalizeOfficialName): string`.
- Produces `normalizeHundoFormId(value): FormId`.
- Produces `normalizeHundoFormEvidence(evidence): NormalizedFormEvidence`.
- Produces `adaptLegacyHundoForm(card, normalizeOfficialName): { base_species, form_id }`.
- Extends `normalizeSmartHundoCard()` with raw/normalized form fields, `effective_form_id`, and `canonical_official_name`.
- Replaces the obsolete whole-helper origin/main snapshot with narrow immutable hundo-count and trainer-team snapshots so later form work cannot weaken those boundaries.

- [ ] **Step 1: Add complete literal form fixtures and failing contract tests**

Extend the test destructuring with the six Task 1 exports. Add:

```js
const formEvidence = (overrides = {}) => ({
  region_visibility: 'clear',
  recognition_basis: 'direct_visual_match',
  visual_signature: 'moltres_galarian',
  key_features_visible: true,
  label_relationship: 'base_species_only',
  ...overrides
});

const formCard = (overrides = {}) => card({
  base_species: '火焰鳥',
  form_id: 'moltres_galarian',
  form_confidence: 0.98,
  form_evidence: formEvidence(),
  ...overrides
});
```

Add a literal table-driven mapping test:

```js
test('maps all 23 approved form IDs to exact canonical names', () => {
  const expected = {
    articuno_standard: '急凍鳥',
    articuno_galarian: '伽勒爾急凍鳥',
    zapdos_standard: '閃電鳥',
    zapdos_galarian: '伽勒爾閃電鳥',
    moltres_standard: '火焰鳥',
    moltres_galarian: '伽勒爾火焰鳥',
    zacian_standard: '蒼響',
    zacian_crowned: '蒼響劍盾型態',
    zamazenta_standard: '藏瑪然特',
    zamazenta_crowned: '藏瑪然特劍盾型態',
    dialga_standard: '帝牙盧卡',
    dialga_origin: '起源帝牙盧卡',
    palkia_standard: '帕路奇亞',
    palkia_origin: '起源帕路奇亞',
    zygarde_10: '基格爾德（10%形態）',
    zygarde_50: '基格爾德（50%形態）',
    zygarde_complete: '基格爾德（完全體形態）',
    necrozma_base: '奈克洛茲瑪',
    necrozma_dusk_mane: '奈克洛茲瑪（黃昏之鬃）',
    necrozma_dawn_wings: '奈克洛茲瑪（拂曉之翼）',
    kyurem_base: '酋雷姆',
    kyurem_white: '焰白酋雷姆',
    kyurem_black: '闇黑酋雷姆'
  };
  deepEqual(HUNDO_FORM_CANONICAL_NAMES, expected);
  equal(Object.keys(HUNDO_FORM_CANONICAL_NAMES).length, 23);
});
```

Add a compatibility exclusivity test:

```js
test('allows each supported form only for its approved base species', () => {
  equal(Object.keys(HUNDO_FORMS_BY_BASE_SPECIES).length, 10);
  const ownership = new Map();
  Object.entries(HUNDO_FORMS_BY_BASE_SPECIES).forEach(([species, ids]) => {
    equal(Object.isFrozen(ids), true);
    ids.forEach(id => {
      equal(ownership.has(id), false, `${id} has exactly one owner`);
      ownership.set(id, species);
    });
  });
  equal(ownership.size, 23);
  equal(ownership.get('moltres_galarian'), '火焰鳥');
  equal(HUNDO_FORMS_BY_BASE_SPECIES['火焰鳥'].includes('dialga_origin'), false);
});
```

Add exact alias assertions for every family, including:

```js
deepEqual(adaptLegacyHundoForm({ official_name: '伽勒爾火焰鳥' }, normalizeName), {
  base_species: '火焰鳥',
  form_id: 'moltres_galarian'
});
deepEqual(adaptLegacyHundoForm({ official_name: '火焰鳥' }, normalizeName), {
  base_species: '火焰鳥',
  form_id: 'uncertain'
});
equal(normalizeHundoBaseSpecies('炎白酋雷姆', normalizeName), '酋雷姆');
equal(normalizeHundoBaseSpecies('蒼響（劍之王）', normalizeName), '蒼響');
```

Add normalization tests that assert:

```js
const normalized = normalizeSmartHundoCard(formCard(), normalizeName, { screenshotIndex: 2 });
equal(normalized.base_species, '火焰鳥');
equal(normalized.form_id, 'moltres_galarian');
equal(normalized.form_confidence, 0.98);
deepEqual(normalized.form_evidence, formEvidence());
equal(normalized.effective_form_id, 'uncertain');
equal(normalized.canonical_official_name, '');
deepEqual(normalized.raw.form, {
  base_species: '火焰鳥',
  form_id: 'moltres_galarian',
  form_confidence: 0.98,
  form_evidence: formEvidence()
});
```

Also assert:

- all invalid form IDs normalize to `uncertain`;
- `unsupported` is preserved;
- outside-whitelist `base_species='超夢'` preserves raw `form_id='not_applicable'`;
- a generic whitelist base name never adapts to a standard form;
- illegal `火焰鳥 + dialga_origin` is preserved raw for Task 2 to reject;
- normalized form evidence always has exactly five keys and controlled values.

- [ ] **Step 2: Run RED**

Run:

```text
python tests/run_browser_tests.py
```

Expected: helper groups fail because form constants and normalizers are not exported. The trainer-team page must remain green. In this environment, if Edge exits with GPU/registry error before rendering, rerun the same command outside the sandbox; do not alter production or test code.

- [ ] **Step 3: Implement the minimal pure contract**

In `smart-hundo-helpers.js`, add:

```js
const FORM_CONTROL_IDS = new Set(['not_applicable', 'uncertain', 'unsupported']);
const HUNDO_SUPPORTED_FORM_IDS = new Set(Object.keys(HUNDO_FORM_CANONICAL_NAMES));
const HUNDO_FORM_ID_VALUES = new Set([...FORM_CONTROL_IDS, ...HUNDO_SUPPORTED_FORM_IDS]);
const FORM_VISUAL_SIGNATURE_VALUES = new Set([
  ...HUNDO_SUPPORTED_FORM_IDS,
  'not_applicable',
  'other',
  'uncertain'
]);
const FORM_RECOGNITION_BASIS_VALUES = new Set([
  'direct_visual_match',
  'visual_and_label',
  'label_only',
  'uncertain'
]);
const FORM_LABEL_RELATIONSHIP_VALUES = new Set([
  'exact_form',
  'base_species_only',
  'custom_nickname',
  'conflicting',
  'unreadable',
  'not_applicable',
  'uncertain'
]);
```

Use one frozen alias lookup containing exact aliases and their base/candidate form. `adaptLegacyHundoForm()` may return a candidate only for an exact legacy special-form alias. For generic whitelist base names it returns `uncertain`; for a non-whitelist legacy card it returns `not_applicable`.

Extend `normalizeSmartHundoCard()` exactly as defined in the interface. Never set `effective_form_id` from raw form data.

- [ ] **Step 4: Narrow regression source locks without weakening boundaries**

In `tests/verify_regressions.py`:

- remove the whole `smart-hundo-helpers.js` origin/main hash assertion;
- add a snapshot for the hundo-count helper span from `normalizeHundoCountResult` through the declaration before `normalizeCoordinate`;
- add snapshots for `HUNDO_COUNT_SCHEMA` and `buildHundoCountPrompt()`;
- add a whole-file snapshot for `trainer-team-helpers.js`;
- keep all ordinary, save, copywriting, model, endpoint, API-key, diagnostics and trainer-team fragment checks.

Compute the expected hashes from `git show origin/main:<path>`, never from the modified worktree.

- [ ] **Step 5: Run GREEN**

Run:

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Expected: all groups/checks pass; output still reports `OpenAI requests: 0 (mocked)`.

- [ ] **Step 6: Commit Phase 1**

```text
git add smart-hundo-helpers.js tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: define smart hundo form contract"
```

---

### Task 2: Deterministic Form Validation

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`

**Interfaces:**
- Produces `FORM_CONFIDENCE_THRESHOLD = 0.85`.
- Produces `FORM_PARTIAL_VISIBILITY_THRESHOLD = 0.93`.
- Produces `validateHundoPokemonForm(card, normalizeOfficialName): ValidatedHundoCard`.
- Produces `buildHundoCanonicalOfficialName(card, normalizeOfficialName): string`.
- Form validation appends controlled reason codes without removing state or screenshot reasons.

- [ ] **Step 1: Add failing validation tests**

Add a helper that normalizes then validates:

```js
const validatedFormCard = (overrides = {}) => validateHundoPokemonForm(
  normalizeSmartHundoCard(formCard(overrides), normalizeName, { screenshotIndex: 0 }),
  normalizeName
);
```

Add these literal cases:

```js
test('accepts clear direct visual form evidence', () => {
  const result = validatedFormCard();
  equal(result.effective_form_id, 'moltres_galarian');
  equal(result.canonical_official_name, '伽勒爾火焰鳥');
  deepEqual(result.manual_review_reasons, []);
});

test('accepts strong visuals with a generic base-species label', () => {
  const result = validatedFormCard({
    visible_label: '火焰鳥',
    form_evidence: formEvidence({
      recognition_basis: 'visual_and_label',
      label_relationship: 'base_species_only'
    })
  });
  equal(result.canonical_official_name, '伽勒爾火焰鳥');
});

test('accepts a custom nickname when direct visual evidence is strong', () => {
  const result = validatedFormCard({
    visible_label: '151515',
    form_evidence: formEvidence({ label_relationship: 'custom_nickname' })
  });
  equal(result.effective_form_id, 'moltres_galarian');
});
```

Add rejection cases:

```js
test('rejects label-only whitelist form evidence', () => {
  const result = validatedFormCard({
    form_evidence: formEvidence({ recognition_basis: 'label_only' })
  });
  equal(result.effective_form_id, 'uncertain');
  equal(result.canonical_official_name, '');
  equal(result.manual_review_reasons.includes('form_label_only'), true);
});

test('rejects cropped form evidence', () => {
  const result = validatedFormCard({
    form_evidence: formEvidence({ region_visibility: 'cropped' })
  });
  equal(result.canonical_official_name, '');
  equal(result.manual_review_reasons.includes('form_region_not_clear'), true);
});

test('accepts partially occluded direct evidence at 0.93', () => {
  const result = validatedFormCard({
    form_confidence: 0.93,
    form_evidence: formEvidence({
      region_visibility: 'partially_occluded',
      recognition_basis: 'direct_visual_match'
    })
  });
  equal(result.effective_form_id, 'moltres_galarian');
});

test('rejects partially occluded evidence below 0.93', () => {
  const result = validatedFormCard({
    form_confidence: 0.92,
    form_evidence: formEvidence({
      region_visibility: 'partially_occluded',
      recognition_basis: 'direct_visual_match'
    })
  });
  equal(result.canonical_official_name, '');
  equal(result.manual_review_reasons.includes('form_confidence_low'), true);
});
```

Add tests for:

- clear confidence `0.85` accepted and `0.849` rejected;
- `visual_signature !== form_id` adds `form_signature_mismatch`;
- `base_species='火焰鳥' + form_id='dialga_origin'` adds `form_species_mismatch`;
- `form_id='uncertain'` adds `form_uncertain` and never outputs `火焰鳥`;
- `form_id='unsupported' + visual_signature='other'` adds `unsupported_form`;
- `key_features_visible=false` remains unresolved and adds `form_uncertain`;
- `recognition_basis='uncertain'` remains unresolved and adds `form_uncertain`;
- `label_relationship='conflicting'` remains unresolved and adds `form_species_mismatch`;
- species confidence `0.799` remains unresolved and adds both `species_uncertain` and `form_uncertain`;
- non-whitelist `超夢`, `固拉多`, `蓋歐卡`, `鳳王`, `哲爾尼亞斯` become `not_applicable` and keep existing canonical official names without form reasons.

- [ ] **Step 2: Run RED**

```text
python tests/run_browser_tests.py
```

Expected: failures name `validateHundoPokemonForm`, thresholds, and canonical-name builder.

- [ ] **Step 3: Implement validation in one deterministic order**

For whitelist species:

```text
unsupported
→ uncertain/control ID
→ compatibility
→ signature
→ label-only/conflicting
→ region visibility
→ species confidence
→ form confidence
→ recognition basis/key feature
→ effective form and canonical name
```

For `partially_occluded`, require all three:

```js
form_confidence >= FORM_PARTIAL_VISIBILITY_THRESHOLD
recognition_basis === 'direct_visual_match'
key_features_visible === true
```

For non-whitelist species, set:

```js
effective_form_id: 'not_applicable'
canonical_official_name: normalizeSmartHundoOfficialName(card.official_name, normalizeOfficialName)
```

Do not mutate raw form data. Deduplicate reason codes while retaining all pre-existing reasons.

Use this exact rejection-to-reason mapping:

```text
raw uncertain / missing key features / uncertain recognition basis
→ form_uncertain
species-form incompatibility / conflicting label relationship
→ form_species_mismatch
cropped / not_visible / uncertain visibility / partial-visibility rule failure
→ form_region_not_clear
clear confidence below 0.85 / partial confidence below 0.93
→ form_confidence_low
label_only
→ form_label_only
visual signature mismatch
→ form_signature_mismatch
unsupported
→ unsupported_form
species confidence below 0.80
→ species_uncertain + form_uncertain
```

- [ ] **Step 4: Run GREEN**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

- [ ] **Step 5: Commit Phase 2**

```text
git add smart-hundo-helpers.js tests/smart-hundo.test.html
git commit -m "feat: validate smart hundo form evidence"
```

---

### Task 3: Display, Grouping, Overlap, Review, and Diagnostics

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html` only for `formatSmartHundoStatus()` form-reason rendering

**Interfaces:**
- `hasUsableRecognizedSpecies()` uses validated `canonical_official_name`, recognition status, and species confidence.
- `buildHundoDisplayName()` uses only validated visible states plus `canonical_official_name`.
- `smartHundoCardsToPokemonList()` omits unresolved whitelist forms.
- Overlap signatures include `base_species`, `effective_form_id`, `canonical_official_name`.
- `HUNDO_REVIEW_REASON_MESSAGES` gains exactly seven form reasons.
- Safe diagnostic cards gain allowlisted form fields.

- [ ] **Step 1: Add failing display and grouping tests**

Create an explicit validated-form fixture:

```js
const displayFormCard = (formId, overrides = {}) => {
  const baseByForm = Object.entries(HUNDO_FORMS_BY_BASE_SPECIES)
    .find(([, ids]) => ids.includes(formId))[0];
  return {
    ...validatedCard(),
    base_species: baseByForm,
    form_id: formId,
    form_confidence: 0.99,
    form_evidence: formEvidence({
      visual_signature: formId,
      label_relationship: 'exact_form'
    }),
    effective_form_id: formId,
    canonical_official_name: HUNDO_FORM_CANONICAL_NAMES[formId],
    official_name: baseByForm,
    ...overrides
  };
};
```

Add mandatory outputs:

```js
equal(effectiveSmartHundoCardsToPokemonList([
  displayFormCard('articuno_standard'),
  displayFormCard('articuno_galarian')
], normalizeName).pokemon_list, '急凍鳥,伽勒爾急凍鳥');

equal(effectiveSmartHundoCardsToPokemonList([
  displayFormCard('zapdos_standard'),
  displayFormCard('zapdos_galarian')
], normalizeName).pokemon_list, '閃電鳥,伽勒爾閃電鳥');

equal(effectiveSmartHundoCardsToPokemonList([
  displayFormCard('moltres_standard'),
  displayFormCard('moltres_galarian')
], normalizeName).pokemon_list, '火焰鳥,伽勒爾火焰鳥');

equal(effectiveSmartHundoCardsToPokemonList([
  displayFormCard('zacian_standard'),
  displayFormCard('zacian_crowned'),
  displayFormCard('zacian_crowned')
], normalizeName).pokemon_list, '蒼響,蒼響劍盾型態*2');
```

Add exact Zygarde, Necrozma, and Kyurem cases:

```js
'基格爾德（10%形態）,基格爾德（50%形態）,基格爾德（完全體形態）'
'奈克洛茲瑪,奈克洛茲瑪（黃昏之鬃）,奈克洛茲瑪（拂曉之翼）'
'酋雷姆,焰白酋雷姆*2,闇黑酋雷姆'
```

Add exact state cases:

```js
equal(buildHundoDisplayName(displayFormCard('moltres_galarian', {
  effective_shiny_state: 'yes',
  effective_background_type: 'special'
}), normalizeName), '色違特別背卡伽勒爾火焰鳥');

equal(buildHundoDisplayName(displayFormCard('zacian_crowned', {
  effective_shiny_state: 'yes',
  effective_rocket_state: 'shadow'
}), normalizeName), '色違暗影蒼響劍盾型態');

equal(buildHundoDisplayName(displayFormCard('kyurem_black', {
  effective_rocket_state: 'purified'
}), normalizeName), '闇黑酋雷姆');
```

Assert no `*1`, unresolved forms omitted, and the user three-card fixture yields:

```text
蒼響,奈克洛茲瑪,伽勒爾火焰鳥
```

- [ ] **Step 2: Add failing review, overlap, and diagnostic tests**

Assert exact message additions:

```js
deepEqual({
  form_uncertain: HUNDO_REVIEW_REASON_MESSAGES.form_uncertain,
  form_species_mismatch: HUNDO_REVIEW_REASON_MESSAGES.form_species_mismatch,
  form_region_not_clear: HUNDO_REVIEW_REASON_MESSAGES.form_region_not_clear,
  form_confidence_low: HUNDO_REVIEW_REASON_MESSAGES.form_confidence_low,
  form_label_only: HUNDO_REVIEW_REASON_MESSAGES.form_label_only,
  form_signature_mismatch: HUNDO_REVIEW_REASON_MESSAGES.form_signature_mismatch,
  unsupported_form: HUNDO_REVIEW_REASON_MESSAGES.unsupported_form
}, {
  form_uncertain: '型態需人工確認',
  form_species_mismatch: '物種與型態結果衝突',
  form_region_not_clear: '型態主要外觀區域看不清楚',
  form_confidence_low: '型態辨識信心不足',
  form_label_only: '型態只有文字證據，需人工確認',
  form_signature_mismatch: '型態與視覺證據不一致',
  unsupported_form: '此型態尚未納入支援範圍'
});
```

Use one card with `form_uncertain`, `form_confidence_low`, and `shiny_uncertain`; assert three reason buckets but `review_card_count === 1`.

Build two screenshots whose boundary cards have the same CP/label/states but standard and Galarian form IDs; assert `overlap_count === 0`. Build two identical Galarian cards in a two-card boundary sequence and assert the existing conservative overlap succeeds.

Shape diagnostics and assert:

```js
deepEqual(diagnostics.screenshots[0].cards[0].form_evidence, formEvidence());
equal(diagnostics.screenshots[0].cards[0].base_species, '火焰鳥');
equal(diagnostics.screenshots[0].cards[0].raw_form_id, 'moltres_galarian');
equal(diagnostics.screenshots[0].cards[0].effective_form_id, 'moltres_galarian');
equal(diagnostics.screenshots[0].cards[0].canonical_official_name, '伽勒爾火焰鳥');
```

Serialize diagnostics and logs; reject `Authorization`, `Bearer`, `data:image/`, API keys, `File`, account/password, Firebase/GAS credentials, and raw request/response bodies.

- [ ] **Step 3: Run RED**

```text
python tests/run_browser_tests.py
```

Expected: display still reads raw `official_name`, overlap lacks form fields, form messages/diagnostics/status are absent.

- [ ] **Step 4: Implement canonical display and omission**

Change the recognized-species gate so the final name authority is:

```js
card.canonical_official_name
```

Do not use raw `official_name` for whitelist display. Keep effective prefix order unchanged. Count only cards with a non-empty final display name as recognized.

Extend overlap signature in this order:

```js
[
  card.cp,
  normalizeVisibleLabel(card.visible_label),
  card.base_species,
  card.effective_form_id,
  card.canonical_official_name,
  card.effective_shiny_state,
  card.effective_lucky_state,
  card.effective_favorite_state,
  card.effective_rocket_state,
  card.effective_background_type
]
```

Retain the two-card minimum and all ambiguity logic unchanged.

- [ ] **Step 5: Implement form review/status and diagnostic allowlist**

Add exactly the seven reason strings. `reviewReasonCodes()` accepts form reasons already present on the card. `formatSmartHundoStatus()` treats all seven as card reasons and emits `${count}張${message}`; `review_card_count` remains deduplicated.

The diagnostic form evidence is reconstructed from strict enum allowlists; do not spread `raw.form`.

- [ ] **Step 6: Run GREEN**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

- [ ] **Step 7: Commit Phase 3**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html
git commit -m "feat: integrate canonical hundo form names"
```

---

### Task 4: Schema and Prompt Integration

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `index.html:936-1065,1845-1911`

**Interfaces:**
- Extends existing `HUNDO_SMART_SCHEMA.cards.items`.
- Extends existing `buildSmartHundoPrompt()` with B2/B3.
- Leaves `HUNDO_COUNT_SCHEMA`, `buildHundoCountPrompt()`, `requestHundoCountExtraction()`, and card request count unchanged.

- [ ] **Step 1: Add failing strict-schema tests**

Assert card fields include the four new names and that all are required:

```js
['base_species', 'form_id', 'form_confidence', 'form_evidence'].forEach(field => {
  equal(Object.hasOwn(smartCardSchema.properties, field), true);
  equal(smartCardSchema.required.includes(field), true);
});
```

Assert exact enum:

```js
deepEqual(smartCardSchema.properties.form_id.enum, [
  'not_applicable',
  'uncertain',
  'unsupported',
  'articuno_standard',
  'articuno_galarian',
  'zapdos_standard',
  'zapdos_galarian',
  'moltres_standard',
  'moltres_galarian',
  'zacian_standard',
  'zacian_crowned',
  'zamazenta_standard',
  'zamazenta_crowned',
  'dialga_standard',
  'dialga_origin',
  'palkia_standard',
  'palkia_origin',
  'zygarde_10',
  'zygarde_50',
  'zygarde_complete',
  'necrozma_base',
  'necrozma_dusk_mane',
  'necrozma_dawn_wings',
  'kyurem_base',
  'kyurem_white',
  'kyurem_black'
]);
```

Assert `form_evidence.additionalProperties === false`, its required array equals all five properties, and every enum exactly matches the design. Assert no `cards.maxItems`.

Recursively assert every object in the complete schema remains strict:

```js
const assertStrictObjectSchemas = (schema, path = 'root') => {
  if (schema.type === 'object') {
    equal(schema.additionalProperties, false, `${path} rejects extra properties`);
    deepEqual(
      [...schema.required].sort(),
      Object.keys(schema.properties).sort(),
      `${path} requires every declared property`
    );
    Object.entries(schema.properties).forEach(([name, child]) => {
      assertStrictObjectSchemas(child, `${path}.${name}`);
    });
  }
  if (schema.type === 'array') assertStrictObjectSchemas(schema.items, `${path}[]`);
};
assertStrictObjectSchemas(HUNDO_SMART_SCHEMA.schema);
equal(Object.hasOwn(HUNDO_SMART_SCHEMA.schema.properties.cards, 'maxItems'), false);
```

- [ ] **Step 2: Add failing prompt and request-boundary tests**

Assert the prompt contains:

- `【B2. 基礎物種與型態辨識】`
- `【B3. form_evidence】`
- all ten base species names
- all 23 form IDs
- the exact Galarian Moltres example with `base_species = "火焰鳥"` and `form_id = "moltres_galarian"`
- label-only → `form_id = "uncertain"`
- unclear/cropped/occluded → no standard fallback
- unsupported Ultra Necrozma → `form_id = "unsupported"`
- complete-body structure, head, wings, tail, limbs, weapon, armor, pose, proportion, form parts, color distribution, label secondary

Use the existing request mocks to assert:

```text
card request image URL === original full-image data URL
card request detail === high
one normal card request per structurally complete screenshot
at most two card requests only on structural retry
zero per-card requests
count request payload/schema/prompt unchanged
```

Record the complete origin/main hundo-count payload fixture before modifying `index.html` and compare the post-change request’s schema name, prompt text, image detail, and image URL semantics.

- [ ] **Step 3: Run RED**

```text
python tests/run_browser_tests.py
```

Expected: strict schema lacks form fields and prompt lacks B2/B3.

- [ ] **Step 4: Extend `HUNDO_SMART_SCHEMA`**

Add required `base_species`, `form_id`, `form_confidence`, and strict `form_evidence`. Do not reorder or alter existing V2 state fields beyond inserting the four form fields after species fields. Do not add `maxItems`.

- [ ] **Step 5: Replace the old generic form paragraph with controlled B2/B3**

Include all wording and visual guidance from the approved design/spec. Use exact schema enum strings. Retain A, C–I and structural retry text unchanged except the B section split:

```text
【B. 物種】
【B2. 基礎物種與型態辨識】
【B3. form_evidence】
```

The prompt must explicitly say:

```text
若只靠 visible_label，沒有足夠圖片證據：
recognition_basis = "label_only"
form_id = "uncertain"

不得自動退回 standard。
```

- [ ] **Step 6: Run GREEN**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Confirm browser output still reports zero OpenAI requests.

- [ ] **Step 7: Commit Phase 4**

```text
git add index.html tests/smart-hundo.test.html
git commit -m "feat: request structured hundo form evidence"
```

---

### Task 5: Production Cutover, Regressions, and Manual Acceptance

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html:2173-2325,2760-2955`
- Modify: `tests/verify_regressions.py`
- Create: `docs/manual-tests/smart-hundo-form-recognition-v1.md`

**Interfaces:**
- Existing `requestSmartHundoWithStructuralRetry()` normalizes structured form fields.
- Existing `smartHundoScan()` calls `validateHundoPokemonForm()` before `validateHundoCardStates()`.
- Existing overlap/list/status/diagnostics pipeline consumes validated form fields.
- Existing count, retry replacement, multi-image merge, session ownership, and team flow remain unchanged.

- [ ] **Step 1: Add failing production integration fixtures**

Update every mocked HUNDO card response with complete required form fields. Use:

```js
const nonWhitelistModelForm = {
  base_species: '超夢',
  form_id: 'not_applicable',
  form_confidence: 1,
  form_evidence: {
    region_visibility: 'clear',
    recognition_basis: 'direct_visual_match',
    visual_signature: 'not_applicable',
    key_features_visible: true,
    label_relationship: 'not_applicable'
  }
};
```

For whitelist fixtures, provide explicit standard/base IDs and real evidence. Never update a legacy generic whitelist fixture by silently assigning standard without evidence; instead make the fixture explicitly state why the image supports that standard form.

Add end-to-end Galarian Moltres:

```js
{
  visible_label: '火焰鳥',
  official_name: '火焰鳥',
  base_species: '火焰鳥',
  form_id: 'moltres_galarian',
  form_confidence: 0.98,
  form_evidence: {
    region_visibility: 'clear',
    recognition_basis: 'direct_visual_match',
    visual_signature: 'moltres_galarian',
    key_features_visible: true,
    label_relationship: 'base_species_only'
  }
}
```

Expected:

```text
canonical_official_name = 伽勒爾火焰鳥
pokemon_list = 伽勒爾火焰鳥
```

Add the user three-card end-to-end fixture with explicit:

```text
zacian_standard
necrozma_base
moltres_galarian whose visible_label is 火焰鳥
```

Expected:

```text
蒼響,奈克洛茲瑪,伽勒爾火焰鳥
```

Add end-to-end unresolved, mismatch, label-only, cropped, and unsupported cases. Assert they remain in diagnostics, increment the correct review reason counts, and are absent from `g_hundos`.

- [ ] **Step 2: Run RED**

```text
python tests/run_browser_tests.py
```

Expected: normalized form data exists but production `smartHundoScan()` validates only states, so canonical list outputs are missing.

- [ ] **Step 3: Perform the minimal production cutover**

Change:

```js
const validatedCards = cardResult.cards.map(card => helpers.validateHundoCardStates(card));
```

to the form-first equivalent:

```js
const validatedCards = cardResult.cards.map(card => helpers.validateHundoCardStates(
  helpers.validateHundoPokemonForm(card, normalizePokemonBaseName)
));
```

Do not change the count promise, `Promise.allSettled`, structural retry predicate/replacement, successful-screenshot filtering, overlap graph, session guards, trainer-team settlements, or form-write ownership.

Remove any transitional adapter that is not used by normalized legacy test/input support. Keep only exact aliases that cannot independently validate without visual evidence.

- [ ] **Step 4: Add manual acceptance document**

Create `docs/manual-tests/smart-hundo-form-recognition-v1.md` with:

```text
A. standard Articuno vs Galarian Articuno
B. standard Zapdos vs Galarian Zapdos
C. standard Moltres vs Galarian Moltres
D. standard Zacian vs Crowned Zacian
E. standard Zamazenta vs Crowned Zamazenta
F. standard Dialga vs Origin Dialga
G. standard Palkia vs Origin Palkia
H. all three Zygarde forms
I. all three supported Necrozma forms
J. all three Kyurem forms
K. 蒼響 / 奈克洛茲瑪 / 伽勒爾火焰鳥
```

Every case table has columns:

```text
full commit SHA
anonymized screenshot ID
visible label
base_species
raw form_id
form confidence
form evidence
effective form_id
canonical official name
final pokemon_list
pass/fail
failure summary
```

Set real-image status to `待人工執行` because no private screenshots are committed. State plainly that mocked tests do not prove real-image accuracy.

- [ ] **Step 5: Strengthen regression checks**

In `tests/verify_regressions.py`:

- assert the manual document contains A–K and all required record fields;
- add `base_species`, `form_id`, `form_confidence`, `form_evidence`, `effective_form_id`, and `canonical_official_name` to persistence/GAS forbidden identifiers;
- snapshot or fragment-lock the unchanged hundo-count schema/prompt/request;
- hash-lock `trainer-team-helpers.js` and retain fixed-UI prompt/request/ownership checks;
- assert `OPENAI_MODEL`, endpoint, ordinary resize, ordinary prompts, save, copywriting, and API-key storage are unchanged;
- assert form fields occur in safe diagnostics but never in persistence;
- assert the final schema exact form enum count is 26 including three controls;
- assert cards have no `maxItems`.

- [ ] **Step 6: Run full GREEN before committing**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
python -m py_compile tests/run_browser_tests.py tests/verify_regressions.py
git diff --check
```

Expected:

- all browser groups pass;
- all static regressions pass;
- OpenAI requests: 0;
- JavaScript/Python syntax checks exit 0.

- [ ] **Step 7: Commit Phase 5**

```text
git add smart-hundo-helpers.js index.html tests/smart-hundo.test.html tests/verify_regressions.py docs/manual-tests/smart-hundo-form-recognition-v1.md
git commit -m "feat: activate smart hundo form recognition v1"
```

---

### Task 6: Whole-Branch Verification, Independent Review, and Open PR

**Files:**
- Review every file changed in `origin/main...HEAD`.
- Modify only files required to resolve verified Critical or Important findings.

**Interfaces:**
- Produces one fully verified branch and one open, unmerged PR targeting `main`.

- [ ] **Step 1: Run exact required verification**

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
python -m py_compile tests/run_browser_tests.py tests/verify_regressions.py
git diff --check
git diff --check origin/main...HEAD
```

The browser runner must report zero console-error groups, zero unhandled-rejection groups, and `OpenAI requests: 0 (mocked)`.

- [ ] **Step 2: Verify JavaScript and the real `index.html` module in the browser engine**

Run:

```text
python tests/run_browser_tests.py
```

This repository has no Node runtime and must not add one as a dependency. The dependency-free harness opens `tests/smart-hundo.test.html` in the installed headless Edge/Chrome engine. That page loads the real standalone `smart-hundo-helpers.js`, extracts the real `<script type="module">` body from `index.html`, strips only the static import declarations supplied by its browser mocks, evaluates the complete remaining module, and fails on syntax error, `console.error`, `window.error`, or unhandled rejection. Treat its nonzero exit as a JavaScript syntax, module syntax, or browser error failure; do not create a substitute parser.

- [ ] **Step 3: Audit secrets, request count, and scope**

Run:

```text
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD
rg -n "Authorization|Bearer|data:image/|originalDataUrl|classificationDataUrl|apiKey|firebaseConfig|gasUrl|password" smart-hundo-helpers.js index.html tests docs
rg -n "TO[D]O|TB[D]|implement\\s+later|fill\\s+in\\s+details" docs/superpowers/specs/2026-07-26-smart-hundo-form-recognition-v1-design.md docs/superpowers/plans/2026-07-26-smart-hundo-form-recognition-v1.md docs/manual-tests/smart-hundo-form-recognition-v1.md
```

Classify every match. Request construction may contain credentials/data URLs; logs, diagnostics, committed fixtures, docs, and persistence changes may not contain private values.

Review every whole-branch diff hunk and confirm:

```text
count schema/prompt/request unchanged
normal card-call count unchanged
structural retry replacement unchanged
ordinary paths unchanged
trainer-team behavior unchanged
Firebase/GAS/copywriting/manual save unchanged
special-survey/Fusion/Mega unchanged
```

- [ ] **Step 4: Request independent whole-branch code review**

Generate a review package for:

```text
BASE = git merge-base origin/main HEAD
HEAD = git rev-parse HEAD
```

Dispatch an independent reviewer with the design, plan, implementation report, test evidence, and complete diff package. Require separate verdicts for spec compliance and code quality. Fix every Critical and Important finding with a failing regression test first; run one scoped re-review of the fix range.

- [ ] **Step 5: Re-run all verification after review fixes**

Run every command from Steps 1–3 against the final tree. Do not rely on pre-review output.

- [ ] **Step 6: Confirm GitHub prerequisites and scope**

```text
gh --version
gh auth status
git status -sb
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
```

The worktree must contain no unrelated or uncommitted files. Commit any intended review fixes with a terse scoped message.

- [ ] **Step 7: Push and create an open, unmerged PR**

```text
git push -u origin feat/smart-hundo-form-recognition-v1
```

Create a draft PR targeting `main` unless the user explicitly asks for ready-for-review. Suggested title:

```text
feat: add smart hundo form recognition v1
```

The PR body includes:

- 10 base species / 23 canonical names
- structured schema and B2/B3 prompt
- deterministic evidence validation and no fallback
- canonical naming, state prefixes, grouping, overlap, review, diagnostics
- exact verification commands and totals
- zero live OpenAI requests
- real-image acceptance remains pending unless actual private screenshots were tested
- `merged = false`, no auto-merge

- [ ] **Step 8: Final delivery evidence**

Record:

```text
branch name
full final commit SHA
PR URL
PR state
merged = false
exact browser/static test totals
real-image acceptance status
```
