# Smart Hundo GPT-5 Mini Origin Dragon / Necrozma V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route only complete Smart Hundo card intelligence to `gpt-5-mini` and require deterministic body-structure evidence for the seven approved Dialga, Palkia, and Necrozma forms.

**Architecture:** Keep `requestOpenAiJsonSchema()` as the single Chat Completions structured-output boundary, with per-request named options controlling model and reasoning. Extend the existing strict `form_evidence` object and pure helper pipeline; V1 validation remains the first gate, followed by one specialized evidence validator. Production still makes one count request and one complete-card request per Smart Hundo screenshot, plus the existing at-most-once structural retry.

**Tech Stack:** Browser JavaScript in `index.html`, dependency-free pure helpers in `smart-hundo-helpers.js`, mocked browser contract tests, Python source-lock regression tests, headless Edge/Chrome.

## Global Constraints

- Start from `origin/main` commit `8e01e8f24e0c4c72cc787199f58b8d55fe29832a`, which contains merged PR #35.
- Branch is exactly `fix/smart-hundo-gpt5-origin-necrozma-v2`.
- Preserve all 10 form families, 23 canonical names, current state pipeline, trainer-team flow, persistence, copywriting, manual save, survey, Fusion/Mega fields and ordinary scanning.
- `OPENAI_MODEL = 'gpt-4.1-mini'`; only complete Smart Hundo card requests use `HUNDO_SMART_MODEL = 'gpt-5-mini'` with `HUNDO_SMART_REASONING_EFFORT = 'low'`.
- Do not change the Chat Completions endpoint, migrate to Responses API, add a verifier request, add per-card crop requests, or silently fall back between models.
- All OpenAI calls in automated tests are mocked; paid/live OpenAI requests must remain zero.
- Each phase follows RED → minimal GREEN → relevant regressions → commit.
- Private screenshots, API keys, Authorization headers, image data URLs, full payloads and raw API responses must never enter git or diagnostics.

---

### Task 1: Phase 1 — model-aware request wrapper and routing

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `tests/verify_regressions.py`
- Modify: `index.html`

**Interfaces:**
- Consumes: existing `requestOpenAiJsonSchema(apiKey, prompt, dataUrl, jsonSchema, statusUpdater, options)`
- Produces: request options `model`, `reasoningEffort`, `imageDetail`, `maxRetries`, `includeMetadata`; safe metadata fields `requested_model`, `returned_model`, `reasoning_effort`, `finish_reason`

- [ ] **Step 1: Add failing payload-routing tests**

Add browser assertions that exercise the real production wrappers through the strict fetch mock:

```js
const assertOrdinaryModelPayload = payload => {
  equal(payload.model, 'gpt-4.1-mini');
  equal(payload.temperature, 0.1);
  equal(Object.hasOwn(payload, 'reasoning_effort'), false);
};

const assertSmartModelPayload = payload => {
  equal(payload.model, 'gpt-5-mini');
  equal(payload.reasoning_effort, 'low');
  equal(Object.hasOwn(payload, 'temperature'), false);
  equal(payload.messages[0].content[1].image_url.detail, 'high');
};
```

Cover classification, ordinary extraction, hundo count, trainer-team, first Smart card request and structural retry. Assert every ordinary request satisfies `assertOrdinaryModelPayload`, every Smart card request satisfies `assertSmartModelPayload`, and the Smart request image URL is the complete original PNG.

- [ ] **Step 2: Add failing metadata and no-fallback tests**

Return a mocked top-level response model and assert:

```js
deepEqual(metadata, {
  result: expectedResult,
  requested_model: 'gpt-5-mini',
  returned_model: 'gpt-5-mini-2025-08-07',
  reasoning_effort: 'low',
  finish_reason: 'stop'
});
```

For an HTTP error, record all attempted payload models and assert every attempt is `gpt-5-mini`; no payload uses `gpt-4.1-mini`.

- [ ] **Step 3: Run the browser suite and confirm RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: new routing assertions fail because `requestOpenAiJsonSchema()` still hard-codes `OPENAI_MODEL`, includes `temperature`, omits metadata and routes Smart cards to `gpt-4.1-mini`.

- [ ] **Step 4: Implement conditional payload construction**

In `index.html`, add:

```js
const HUNDO_SMART_MODEL = 'gpt-5-mini';
const HUNDO_SMART_REASONING_EFFORT = 'low';
```

Build a plain object, set `payload.reasoning_effort` only when `requestModel === HUNDO_SMART_MODEL`, otherwise set `payload.temperature = 0.1`, then stringify exactly once for fetch.

- [ ] **Step 5: Route only the Smart wrapper**

Change only `requestSmartHundoExtractionV2()` options to:

```js
{
  model: HUNDO_SMART_MODEL,
  reasoningEffort: HUNDO_SMART_REASONING_EFFORT,
  imageDetail: HUNDO_SMART_IMAGE_DETAIL,
  includeMetadata: true
}
```

Do not supply `model` to classification, ordinary, count or trainer-team callers.

- [ ] **Step 6: Return safe metadata**

When `includeMetadata` is true, return only parsed `result`, requested model, response model string, request reasoning effort string and finish reason string. Do not retain `data`, request body or headers.

- [ ] **Step 7: Run GREEN and regressions**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: all groups pass and OpenAI requests remain `0 (mocked)`.

- [ ] **Step 8: Commit Phase 1**

```powershell
git add index.html tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: route smart hundo cards to gpt-5-mini"
```

### Task 2: Phase 2 — strict specialized evidence schema and normalization

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `REQUIRED_SPECIALIZED_FORM_EVIDENCE`, controlled sets for the four enums, extended `normalizeHundoFormEvidence(evidence)`
- Specialized evidence tuple: `{ body_plan, limb_layout, fusion_host, decisive_feature }`

- [ ] **Step 1: Add failing schema, mapping and normalization tests**

Assert all nine `form_evidence` properties are required and no extras are allowed. Assert exact enum arrays from the design amendment. Assert the seven exact tuples and:

```js
equal(Object.isFrozen(REQUIRED_SPECIALIZED_FORM_EVIDENCE), true);
Object.values(REQUIRED_SPECIALIZED_FORM_EVIDENCE).forEach(tuple => {
  equal(Object.isFrozen(tuple), true);
});
```

Normalize invalid literals:

```js
const normalized = normalizeHundoFormEvidence({
  body_plan: 'horse',
  limb_layout: 'legs',
  fusion_host: 'moon',
  decisive_feature: 'looks origin'
});
deepEqual({
  body_plan: normalized.body_plan,
  limb_layout: normalized.limb_layout,
  fusion_host: normalized.fusion_host,
  decisive_feature: normalized.decisive_feature
}, {
  body_plan: 'uncertain',
  limb_layout: 'uncertain',
  fusion_host: 'uncertain',
  decisive_feature: 'uncertain'
});
```

- [ ] **Step 2: Update API-shaped test fixtures before production**

Give every generic `formEvidence()` and `modelCard()` fixture all four fields as `not_applicable`; specialized fixtures explicitly use the exact mapping. Run the recursive schema assertion to ensure the new expected schema still fails before production changes.

- [ ] **Step 3: Run RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: mapping export and schema fields are missing; normalization omits the fields.

- [ ] **Step 4: Add controlled sets and immutable mapping**

Define one set for each exact enum and one nested `Object.freeze` mapping in `smart-hundo-helpers.js`. Do not repeat the seven tuples in validator logic.

- [ ] **Step 5: Extend normalization and raw form preservation**

Normalize only exact lowercase schema values and fall back to `uncertain`. Because `raw.form.form_evidence` stores the normalized safe object, its four specialized fields remain inspectable without retaining arbitrary raw text.

- [ ] **Step 6: Extend `HUNDO_SMART_SCHEMA`**

Add the four properties and append them to the required list. Preserve `additionalProperties: false`, all existing fields and no `maxItems`.

- [ ] **Step 7: Run GREEN and regressions**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Update only the expected Smart schema source lock after reviewing the exact intended diff; hundo-count and ordinary snapshots must remain unchanged.

- [ ] **Step 8: Commit Phase 2**

```powershell
git add index.html smart-hundo-helpers.js tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: add specialized hundo form evidence contract"
```

### Task 3: Phase 3 — deterministic specialized validator and review reasons

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `REQUIRED_SPECIALIZED_FORM_EVIDENCE`
- Produces: `validateSpecializedFormEvidence(formId, evidence) => { valid, reasons }`

- [ ] **Step 1: Add the 20 required failing helper tests**

Use literal cases for:

```text
dialga_standard exact pass
dialga_origin exact pass
dialga_standard + origin body plan fail
dialga_origin + four_standard_legs fail
dialga_origin + standard decisive feature fail
palkia_standard exact pass
palkia_origin exact pass
palkia_standard + centaur fail
palkia_origin + standard arms fail
necrozma_base + none pass
dusk mane + solgaleo pass
dusk mane + lunala fail
dawn wings + lunala pass
dawn wings + lion fail
non-specialized all-not-applicable pass
non-specialized specialized tuple fail
unknown enum normalization
multi-reason review-card dedupe
safe specialized diagnostics
secret/payload exclusion
```

Each mismatch asserts its exact controlled reason.

- [ ] **Step 2: Run RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: `validateSpecializedFormEvidence` and new reason messages are missing; V1 validator still accepts self-consistent specialized mismatches.

- [ ] **Step 3: Implement the pure validator**

For a specialized `formId`, compare all four fields against the one mapping and append each applicable mismatch in stable field order. For every other `formId`, return `form_specialized_evidence_unexpected` once if any field differs from `not_applicable`.

- [ ] **Step 4: Integrate after all V1 gates**

Extend `FORM_VALIDATION_REASON_CODES`. For supported forms, call the specialized validator only after V1 compatibility/signature/visibility/confidence/label checks and pass all returned reasons to existing `reject()`. In the non-whitelist structured control path, call it after confirming `form_id='not_applicable'` and `visual_signature='not_applicable'` but before accepting the card, so a Mewtwo or other ordinary species cannot carry specialized fields.

- [ ] **Step 5: Add reason messages and UI reason codes**

Add the five exact Traditional Chinese messages to `HUNDO_REVIEW_REASON_MESSAGES` and the five codes to `formatSmartHundoStatus()` card reasons.

- [ ] **Step 6: Extend safe diagnostics**

Allowlist and enum-normalize the four specialized fields in `diagnosticFormEvidence()`. Confirm arbitrary raw strings, API secrets, Authorization, payloads and data URLs cannot appear in serialized diagnostics.

- [ ] **Step 7: Run GREEN and regressions**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: all helper, UI, diagnostics and existing form/state/grouping tests pass.

- [ ] **Step 8: Commit Phase 3**

```powershell
git add index.html smart-hundo-helpers.js tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: validate origin dragon and necrozma evidence"
```

### Task 4: Phase 4 — detailed visual prompt rules

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `index.html`

**Interfaces:**
- Consumes: exact schema values and mapping from Tasks 2–3
- Produces: expanded `buildSmartHundoPrompt({ structuralRetry })`

- [ ] **Step 1: Add failing exact prompt-contract tests**

Slice each new section by its heading and assert the required standard/origin body proportions, arms/legs, Solgaleo/Lunala host, exact four-field tuple and uncertainty rule. Assert the negative-label section couples `帝牙盧卡`、`帕路奇亞`、`奈克洛茲瑪` to base species only.

Also assert:

```text
zamazenta_crowned → massive shield-shaped mane + frontal head/neck/chest armor
ordinary red/blue wolf without shield mane → zamazenta_standard
zapdos_galarian → orange/red + extremely long strong legs + upright running bird
label 閃電鳥 does not prove standard
```

- [ ] **Step 2: Run RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: the five dedicated headings, exact tuples, negative label rule and strengthened regressions are absent.

- [ ] **Step 3: Implement prompt sections**

Insert `B2-D1`, `B2-D2`, `B2-N1`, `B2-N2`, `B2-N3` after the existing family list and before generic `B3`. Keep all V1 visual guidance. Add the explicit non-specialized `not_applicable` rule.

- [ ] **Step 4: Run GREEN and regressions**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: prompt assertions pass; ordinary classification/extraction and hundo-count prompt snapshots remain byte-for-byte unchanged.

- [ ] **Step 5: Commit Phase 4**

```powershell
git add index.html tests/smart-hundo.test.html
git commit -m "feat: specialize origin dragon and necrozma prompts"
```

### Task 5: Phase 5 — production metadata, safe failure, diagnostics and mocked screenshot oracles

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: wrapper metadata, normalized specialized evidence and existing `shapeSmartHundoDiagnostics(session)`
- Produces: session/screenshot model diagnostics and `smart_hundo_model_request_failed`

- [ ] **Step 1: Add failing production routing and failure tests**

Through `autoScan()`, assert a typical Smart screenshot produces:

```text
classification: gpt-4.1-mini
hundo count: gpt-4.1-mini
cards: gpt-5-mini
cards reasoning_effort: low
```

Configure the strict mock to reject every Smart card attempt and assert no captured card payload model is `gpt-4.1-mini`, count replacement remains independent, the old/manual list remains preserved, diagnostics contain `smart_hundo_model_request_failed`, and the visible status contains its Chinese message.

- [ ] **Step 2: Add failing model-diagnostics safety tests**

Assert top-level model routing and per-screenshot requested/returned values. Serialize diagnostics and reject:

```text
test-key
Authorization
Bearer
data:image/
ORIGINAL_
RESIZED_
payload
raw response
```

- [ ] **Step 3: Add the four mocked deterministic oracle fixtures**

Build schema-valid card results for the four approved cases. Assert exact `pokemon_list`, ordinary Zamazenta versus Crowned Zamazenta, Galarian Zapdos, Origin Dialga and Dusk Mane evidence/canonical fields. These fixtures do not contain or emulate private pixels.

- [ ] **Step 4: Run RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: production does not yet propagate metadata, model diagnostics are absent, card failures still use the generic reason, and specialized production fixtures cannot validate.

- [ ] **Step 5: Propagate safe metadata**

Carry allowlisted request metadata through count and card operations, including the final replacement attempt. Add session model routing and per-screenshot returned models to the object passed into `shapeSmartHundoDiagnostics()`.

- [ ] **Step 6: Implement the model-specific failure reason**

Card settlement failures use `smart_hundo_model_request_failed`; count failures keep the existing safe request reason. Add the new reason to screenshot/session review allowlists and visible status without logging raw errors.

- [ ] **Step 7: Shape model diagnostics**

`shapeSmartHundoDiagnostics()` copies only sanitized scalar model strings and reasoning effort. It never spreads a metadata object or API response.

- [ ] **Step 8: Run GREEN and regressions**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: all production routing/oracle/safety tests pass with zero live OpenAI calls.

- [ ] **Step 9: Commit Phase 5**

```powershell
git add index.html smart-hundo-helpers.js tests/smart-hundo.test.html tests/verify_regressions.py
git commit -m "feat: expose safe smart hundo model diagnostics"
```

### Task 6: Phase 6 — manual acceptance, full regression verification and review

**Files:**
- Create: `docs/manual-tests/smart-hundo-gpt5-origin-necrozma-v2.md`
- Modify: `tests/verify_regressions.py`
- Modify only if review finds a defect: `index.html`
- Modify only if review finds a defect: `smart-hundo-helpers.js`
- Modify only if review finds a defect: `tests/smart-hundo.test.html`

**Interfaces:**
- Produces: pending real-image acceptance record, final deterministic source locks and independent review evidence

- [ ] **Step 1: Add failing manual-document regression check**

Add a deterministic parser that requires the exact columns:

```text
full commit SHA
anonymized image ID
requested model
returned model
reasoning effort
visible label
base_species
raw form_id
form confidence
body_plan
limb_layout
fusion_host
decisive_feature
effective_form_id
canonical name
final pokemon_list
pass/fail
failure summary
```

Require all four oracle sections and a statement that mocked tests do not prove visual accuracy.

- [ ] **Step 2: Run RED**

Run:

```powershell
python tests/verify_regressions.py
```

Expected: the new manual acceptance document is absent.

- [ ] **Step 3: Create the manual acceptance document**

Document all four exact cases from the approved design. Every execution field remains `待人工執行`; do not claim PASS or add screenshots.

- [ ] **Step 4: Run the full verification matrix**

Run fresh:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
python -m py_compile tests/run_browser_tests.py tests/verify_regressions.py
node --check smart-hundo-helpers.js
node --check trainer-team-helpers.js
git diff --check
git diff --check origin/main...HEAD
```

Extract the `index.html` module to a temporary `.mjs` with imports removed and run `node --check` against it. Confirm the browser harness reports no `console.error`, `window.error` or `unhandledrejection`. Run repository scans for secrets, `Authorization`, data-URL logging, raw payload logging and unintended model literals.

- [ ] **Step 5: Commit Phase 6 documentation and regression locks**

```powershell
git add docs/manual-tests/smart-hundo-gpt5-origin-necrozma-v2.md tests/verify_regressions.py
git commit -m "docs: add smart hundo v2 acceptance oracles"
```

- [ ] **Step 6: Request an independent whole-branch review**

Give the reviewer:

```text
base = 8e01e8f24e0c4c72cc787199f58b8d55fe29832a
head = current full SHA
requirements = this plan plus the design amendment
scope = origin/main...HEAD
```

The review is read-only. Fix every Critical and Important finding with a covering failing test, rerun relevant tests, commit the fix, and request a scoped re-review.

- [ ] **Step 7: Re-run all verification after review fixes**

Repeat every command from Step 4 against the final tree. Review `git diff --stat origin/main...HEAD`, `git diff origin/main...HEAD`, commit history, and `git status --short`.

- [ ] **Step 8: Push and create a draft PR**

```powershell
git push -u origin fix/smart-hundo-gpt5-origin-necrozma-v2
```

Create a draft pull request targeting `main`. Do not merge and do not enable auto-merge. Return the full commit SHA and PR URL.
