# Smart Hundo All-Family Form Verifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conditional Stage 2 crop-and-contact-sheet form verifier for all 10 supported Smart Hundo form families without changing non-form card data.

**Architecture:** Stage 1 remains the existing full-image extraction and validation path. New pure helpers select unresolved whitelist cards, validate normalized bounding boxes, batch candidates in groups of six, validate Stage 2 responses against species-specific candidates, and immutably apply only validated form fields. `index.html` owns image cropping, contact-sheet construction, the Stage 2 API request, orchestration, diagnostics, and fail-closed recovery.

**Tech Stack:** Browser JavaScript, Canvas API, OpenAI Chat Completions Structured Outputs, Node assertion tests, browser test harness, Python source regression checks.

## Global Constraints

- Preserve GPT-5.4-mini Stage 1 routing, endpoint, reasoning effort, Firebase/GAS behavior, and non-Smart-Hundo requests.
- Stage 2 may modify only form fields and canonical display name.
- Use original image data for crops; never classification JPEG.
- Maximum six candidates per contact sheet.
- Never silently fallback to standard/base.
- Do not log image data URLs, API keys, authorization headers, or raw model responses.
- Real-image acceptance must remain NOT RUN unless actually executed.

---

### Task 1: Stage 1 bounding-box contract

**Files:**
- Modify: `index.html` Smart Hundo schema and prompt
- Modify: `smart-hundo-helpers.js` normalization and diagnostics
- Test: `tests/smart-hundo.test.html`
- Test: `tests/verify_regressions.py`

**Interfaces:**
- Produces `card_bbox` and `pokemon_bbox` objects shaped as `{x:number,y:number,width:number,height:number}` with normalized 0..1 coordinates.
- Produces `normalizeHundoBoundingBox(value)` and `isUsableHundoBoundingBox(value)`.

- [ ] Add failing tests proving valid normalized boxes are preserved and malformed/out-of-range boxes normalize to an unusable safe value.
- [ ] Run browser/source tests and confirm the new assertions fail.
- [ ] Add both required bbox fields to `HUNDO_SMART_SCHEMA`; update the prompt to require card-relative boxes for every card and forbid invented boxes.
- [ ] Implement pure bbox normalization and safe diagnostic shaping.
- [ ] Run tests and commit with `feat: add Smart Hundo form crop coordinates`.

### Task 2: Candidate selection and batching helpers

**Files:**
- Modify: `smart-hundo-helpers.js`
- Test: `tests/smart-hundo-form-verifier.test.js`

**Interfaces:**
- Produces `selectHundoFormVerificationCandidates(cards)`.
- Produces `chunkHundoFormVerificationCandidates(candidates, batchSize = 6)`.
- Candidate shape: `{card_id, base_species, cp, allowed_form_ids, card_bbox, pokemon_bbox, stage1_form_id, stage1_form_confidence}`.

- [ ] Write failing Node tests for all 10 whitelist families, exclusion of resolved/non-whitelist cards, unusable bbox exclusion, stable order, 0/1/6/7/12 batching, and immutability.
- [ ] Run `node tests/smart-hundo-form-verifier.test.js` and verify failure.
- [ ] Implement minimal pure helpers using `HUNDO_FORMS_BY_BASE_SPECIES` as the sole candidate source.
- [ ] Re-run the Node test and commit with `feat: select Smart Hundo form verifier candidates`.

### Task 3: Stage 2 response schema and deterministic validation

**Files:**
- Modify: `index.html` Stage 2 JSON schema and prompt builder
- Modify: `smart-hundo-helpers.js`
- Test: `tests/smart-hundo-form-verifier.test.js`
- Test: `tests/smart-hundo.test.html`

**Interfaces:**
- Produces `normalizeHundoFormVerificationResult(result)`.
- Produces `validateHundoFormVerificationBatch(candidates, result)` returning `{accepted_by_card_id, review_reasons, structurally_complete}`.
- Accepted item contains only `{form_id, form_confidence, form_evidence}`.

- [ ] Add failing tests for valid results, form outside the species whitelist, confidence below 0.90, non-clear visibility, non-direct basis, false key features, signature mismatch, missing IDs, duplicate IDs, and unexpected IDs.
- [ ] Run tests and verify failure.
- [ ] Add a strict Stage 2 schema with `card_id`, `form_id`, `form_confidence`, and the existing five-field `form_evidence` contract.
- [ ] Build a prompt that lists each contact-sheet cell's exact card ID, base species, and allowed IDs; forbid changes to species/CP/states.
- [ ] Implement normalization and fail-closed batch validation.
- [ ] Run tests and commit with `feat: validate Smart Hundo Stage 2 forms`.

### Task 4: Contact-sheet construction

**Files:**
- Modify: `index.html`
- Test: `tests/smart-hundo.test.html`
- Test: `tests/verify_regressions.py`

**Interfaces:**
- Produces `buildHundoFormVerificationContactSheet(originalDataUrl, candidates)` returning a PNG data URL and cell metadata.
- Consumes batches of 1..6 candidates.

- [ ] Add browser tests using a synthetic image to assert one cell per candidate, stable card IDs, source cropping from normalized boxes, preserved aspect ratio, padding, and PNG output.
- [ ] Verify tests fail.
- [ ] Implement safe bbox-to-pixel conversion, crop expansion/clamping, fixed cell layout, labels, and aspect-ratio-preserving drawing.
- [ ] Ensure rejected image loads and invalid dimensions reject without partial output.
- [ ] Run tests and commit with `feat: build Smart Hundo form contact sheets`.

### Task 5: Immutable Stage 2 application

**Files:**
- Modify: `smart-hundo-helpers.js`
- Test: `tests/smart-hundo-form-verifier.test.js`

**Interfaces:**
- Produces `applyHundoFormVerification(cards, acceptedByCardId)`.
- Reuses `validateHundoPokemonForm` and canonical maps.

- [ ] Add failing tests proving accepted Stage 2 results replace only form fields and canonical name while preserving base species, CP, coordinates, shiny/lucky/favorite/Rocket/background states, raw Stage 1 snapshots, and card order.
- [ ] Add failure tests proving rejected/missing results leave the original card unchanged and unresolved.
- [ ] Implement immutable application with explicit Stage 1/Stage 2 audit fields.
- [ ] Run tests and commit with `feat: apply verified Smart Hundo forms safely`.

### Task 6: Stage 2 request orchestration

**Files:**
- Modify: `index.html`
- Test: `tests/smart-hundo.test.html`
- Test: `tests/verify_regressions.py`

**Interfaces:**
- Produces `requestHundoFormVerification(...)` and `runHundoFormVerification(...)`.
- Request count is exactly `ceil(candidate_count / 6)`; zero candidates means zero requests.

- [ ] Add mocked browser tests for 0, 1, 6, 7, and 12 candidates and assert exact request counts and high-detail PNG contact-sheet requests.
- [ ] Add tests for one failed batch not altering unrelated cards and for no Stage 1 retry/request routing changes.
- [ ] Implement the Stage 2 request using the existing request wrapper with a dedicated model constant and one request per contact sheet.
- [ ] Orchestrate Stage 2 after Stage 1 card validation and before screenshot merge/list conversion.
- [ ] Fail closed per batch; preserve all successful Stage 1 cards and successful Stage 2 batches.
- [ ] Run tests and commit with `feat: orchestrate Smart Hundo form verification`.

### Task 7: Diagnostics and status

**Files:**
- Modify: `smart-hundo-helpers.js`
- Modify: `index.html`
- Test: `tests/smart-hundo-form-verifier.test.js`
- Test: `tests/smart-hundo.test.html`

**Interfaces:**
- Diagnostics expose `stage1_form_id`, `stage1_form_confidence`, `stage2_used`, `stage2_reason`, `stage2_candidate_forms`, `stage2_form_id`, `stage2_form_confidence`, `stage2_validation_reasons`, and final `effective_form_id`.

- [ ] Add failing tests for successful, uncertain, crop-failed, request-failed, and validation-failed diagnostics.
- [ ] Implement controlled reason codes and safe diagnostic shaping; normalized bbox numbers are allowed, image content is forbidden.
- [ ] Update status text to distinguish Stage 2-confirmed cards from cards still requiring form review without exposing raw model responses.
- [ ] Run tests and commit with `feat: add Smart Hundo form verifier diagnostics`.

### Task 8: Regression and manual acceptance documentation

**Files:**
- Modify: `tests/verify_regressions.py`
- Modify: `tests/run_browser_tests.py` if registration is needed
- Create: `docs/manual-tests/smart-hundo-all-family-form-verifier.md`

- [ ] Register the new Node/browser suites and add source guards for request-count boundaries, original-image use, six-item batches, no standard fallback, and forbidden logging.
- [ ] Add a manual table for all 10 families, including ordinary Zamazenta CP3282 and Crowned Zamazenta; mark every real-image row `NOT RUN` initially.
- [ ] Run `node tests/smart-hundo-form-verifier.test.js`.
- [ ] Run every `tests/*.test.js` file.
- [ ] Run `python tests/verify_regressions.py`.
- [ ] Run `python tests/run_browser_tests.py` when Chrome/Edge is available; otherwise report the exact environment limitation.
- [ ] Run `node --check smart-hundo-helpers.js` and the extracted inline module syntax check.
- [ ] Run `git diff --check` and inspect the complete branch diff.
- [ ] Commit with `test: cover Smart Hundo all-family form verifier`.

### Task 9: Final verification and PR

**Files:**
- Review all changed files.

- [ ] Confirm no private screenshots, crops, hashes, data URLs, API keys, or raw model responses are committed.
- [ ] Confirm Stage 2 does not mutate CP, species, card order, or state dimensions.
- [ ] Confirm exact extra request formula and no requests for zero candidates.
- [ ] Confirm CP3282 remains `待確認` in mocked low-confidence cases and becomes `藏瑪然特` only after a valid `zamazenta_standard` Stage 2 result.
- [ ] Create a non-draft PR to `main`; do not enable auto-merge.
- [ ] Report changed files, commits, test results, PR number/URL, and real-image acceptance status.