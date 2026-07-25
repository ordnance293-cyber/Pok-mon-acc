# Trainer Team Fixed UI Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trainer team recognition depend only on validated fixed Pokémon GO UI evidence, with uncertainty, conflict, ownership, and safe diagnostics behavior.

**Architecture:** Ordinary `TRAINER_PROFILE_SCREEN` extraction retains only level and XP. A new lossless focused-image request produces strict evidence, a pure helper validates and merges it, and the page applies only validated teams with scan ownership and stale-result guards.

**Tech Stack:** HTML5 canvas, browser JavaScript IIFE helpers, OpenAI chat-completions JSON Schema, dependency-free Python/Edge browser test harness, static Python regression checks.

## Global Constraints

- Start from the latest `origin/main` on branch `fix/trainer-team-fixed-ui-evidence`.
- Do not merge automatically.
- Do not modify Smart Hundo State Pipeline V2 behavior.
- Do not change `OPENAI_MODEL`.
- Use the original uploaded profile image and emit one focused lossless PNG.
- Use `detail: high` and at most one logical dedicated team request per profile screenshot.
- Never use Buddy Pokémon, aura, avatar, reward, button, tab underline, dominant-image, central-area, or outer-background color as final team evidence.
- Never default uncertain evidence to blue or choose the first conflicting screenshot.
- Do not modify Firebase schema, GAS payloads, or generated copywriting.
- No automated test may make a paid live OpenAI request.

---

### Task 1: Add failing fixed-evidence helper tests

**Files:**
- Create: `tests/trainer-team.test.html`
- Modify: `tests/run_browser_tests.py`

**Interfaces:**
- Consumes: planned `globalThis.TrainerTeamHelpers`.
- Produces: browser assertions for `normalizeTrainerTeamResult`,
  `validateTrainerTeamEvidence`, `mergeTrainerTeamResults`, and
  `formatTrainerTeamStatus`.

- [ ] **Step 1: Add literal evidence fixtures and the required cases**

Use strict literal outcomes for:

```js
validateTrainerTeamEvidence({
  model_team_candidate: 'blue',
  model_confidence: 0.99,
  level_number: { visibility: 'clear', color: 'yellow' },
  xp_bar_fill: { visibility: 'clear', color: 'yellow' },
  xp_value_text: { visibility: 'clear', color: 'yellow' },
  profile_name_block: { visibility: 'clear', color: 'yellow' },
  arrow_or_progress_accent: { visibility: 'clear', color: 'yellow' },
  buddy_color: 'blue'
})
```

The expected result is the literal `effective_color: "yellow"`,
`effective_team: "黃隊"`, plus
`model_evidence_disagreement`. Add the other required yellow/red/green Buddy
cases, blue and red cases, primary conflict, no-primary evidence, one-primary
plus two-secondary evidence, low confidence, and multi-screenshot
agreement/conflict.

- [ ] **Step 2: Make the browser runner execute both test pages**

Use a tuple:

```python
TEST_PATHS = (
    "/tests/trainer-team.test.html",
    "/tests/smart-hundo.test.html",
)
```

Run each page in a fresh temporary browser profile, require at least one passing
group, aggregate the counts, and keep the command
`python tests/run_browser_tests.py`.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: trainer-team groups fail because
`globalThis.TrainerTeamHelpers` does not exist; Smart Hundo groups remain green.

### Task 2: Implement the pure evidence validator and merge

**Files:**
- Create: `trainer-team-helpers.js`
- Test: `tests/trainer-team.test.html`

**Interfaces:**
- Produces:
  - `normalizeTrainerTeamResult(result)`
  - `validateTrainerTeamEvidence(result, { screenshotIndex, confidenceThreshold })`
  - `mergeTrainerTeamResults(validatedResults)`
  - `formatTrainerTeamStatus(mergedResult)`
  - `TRAINER_TEAM_CONFIDENCE_THRESHOLD`

- [ ] **Step 1: Normalize only strict evidence values**

Implement exact enum normalization and confidence clamping:

```js
const normalizeEvidence = (value = {}) => ({
  visibility: VISIBILITY_VALUES.has(normalizeToken(value.visibility))
    ? normalizeToken(value.visibility)
    : 'uncertain',
  color: COLOR_VALUES.has(normalizeToken(value.color))
    ? normalizeToken(value.color)
    : 'uncertain'
});
```

- [ ] **Step 2: Implement Rules A–F**

Collect only `visibility === "clear"` sources with red/yellow/blue colors.
Reject primary conflicts before considering secondary evidence, require at
least one primary, require confidence `>= 0.85`, accept two-primary consensus,
or accept one primary only when both secondary sources agree. Record model
disagreement without changing the effective color.

- [ ] **Step 3: Merge validated screenshots without order bias**

Group only `valid === true` results by effective color. Return one common color,
`team_conflict` for multiple colors, or insufficient evidence when there are no
valid colors.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
python tests/run_browser_tests.py
```

Expected: trainer-team helper groups pass and existing Smart Hundo groups remain
green.

### Task 3: Add failing production-integration tests

**Files:**
- Modify: `tests/smart-hundo.test.html`
- Modify: `tests/verify_regressions.py`

**Interfaces:**
- Consumes: real module source extracted from `index.html`.
- Produces: mocked integration coverage for schema, prompt, image composite,
  one-request routing, ordinary isolation, ownership, diagnostics, and stale
  results.

- [ ] **Step 1: Extend the strict mock boundary**

Allow only the new schema name
`pokemon_go_trainer_team_fixed_ui_extractor`; map composite sentinel URLs to
complete strict evidence objects. Continue rejecting every unknown URL/schema.

- [ ] **Step 2: Add schema, prompt, PNG, and request tests**

Assert:

```js
equal(TRAINER_TEAM_SCHEMA.strict, true);
equal(TRAINER_TEAM_SCHEMA.schema.additionalProperties, false);
equal(TRAINER_TEAM_SCHEMA.schema.required.length, 7);
equal(teamPayload.messages[0].content[1].image_url.detail, 'high');
equal(teamComposite.startsWith('data:image/png'), true);
```

Every nested evidence schema must have `additionalProperties: false` and both
required keys. Prompt assertions cover all required fixed sources, exclusions,
and counterexamples.

- [ ] **Step 3: Add ordinary isolation and scan tests**

Return a deliberately wrong ordinary raw `team: "藍隊"` while dedicated yellow
evidence is returned. Assert level and XP retain their existing values, team is
`黃隊`, exactly one team request occurs for each profile screenshot, and no
ordinary retry/coverage pass requests team.

- [ ] **Step 4: Add ownership, uncertainty, conflict, and redaction tests**

Assert that uncertain scans preserve manual selections, clear only unchanged
AI-owned values, manual edits during a pending request win, stale requests
cannot write, conflicting screenshots stay uncertain, and serialized
diagnostics/logs contain none of:

```js
['test-key', 'Authorization', 'data:image/', 'ORIGINAL_', 'File', 'firebaseConfig', 'gasUrl']
```

- [ ] **Step 5: Run integration tests and verify RED**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: browser integration fails because the new production schema/path and
ownership functions are absent; the extraction-prompt snapshot fails after the
test locks are adjusted for the intended contract.

### Task 4: Implement the dedicated page integration

**Files:**
- Modify: `index.html`
- Test: `tests/smart-hundo.test.html`
- Test: `tests/verify_regressions.py`

**Interfaces:**
- Consumes: `globalThis.TrainerTeamHelpers`.
- Produces:
  - `TRAINER_TEAM_SCHEMA`
  - `buildTrainerTeamPrompt()`
  - `buildTrainerTeamEvidenceImage(originalDataUrl)`
  - `requestTrainerTeamExtraction(...)`
  - `runTrainerTeamScan(...)`
  - `publishTrainerTeamDiagnostics(...)`

- [ ] **Step 1: Remove ordinary team authority**

Change profile field lists from `['level', 'team', 'xp']` to
`['level', 'xp']`; remove team from ordinary source priority, required
coverage, structured output, normalization, and autofill. Keep level/XP
normalization and ordinary image processing unchanged.

- [ ] **Step 2: Add the strict schema and dedicated prompt**

Build one strict top-level schema and five strict evidence objects with all
properties required. Implement the fixed-source and exclusion rules plus the
four explicit counterexamples from the approved design.

- [ ] **Step 3: Build the two-region native-resolution PNG**

Load the original data URL, draw the profile-name and level/XP crop defaults
onto one canvas without JPEG conversion or 1000 px resizing, and return
`canvas.toDataURL('image/png')`.

- [ ] **Step 4: Add dedicated request and per-screenshot validation**

Call the existing JSON-schema request primitive once with
`{ imageDetail: 'high' }`, normalize and validate with the helper, and retain
only safe evidence fields.

- [ ] **Step 5: Integrate the team batch with `autoScan`**

After classification, begin a trainer-team session only when profile jobs
exist. Run dedicated per-profile operations concurrently with ordinary and
Smart Hundo work, merge all settled team results deterministically, publish
safe diagnostics, and write `g_team` only for a current validated result.

- [ ] **Step 6: Add manual-confirmation UI and ownership**

Add an empty select option and `trainerTeamStatus`. Track team ownership and
manual revision independently from Smart Hundo. Never call `resetForm()` from
the team path and never reset unrelated fields.

- [ ] **Step 7: Run tests and verify GREEN**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
```

Expected: all trainer-team and existing Smart Hundo groups pass; all static
regression checks pass.

### Task 5: Manual acceptance and complete verification

**Files:**
- Create: `docs/manual-tests/trainer-team-fixed-ui-evidence.md`

**Interfaces:**
- Produces: a private-image-safe manual acceptance record template.

- [ ] **Step 1: Add the five required real-image rows**

Each row records commit SHA, anonymized screenshot ID, raw fixed evidence,
effective team, actual form value, pass/fail, and failure reason. Explicitly
state that screenshots and raw API responses are not committed.

- [ ] **Step 2: Run all required verification**

Run:

```powershell
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

Also run JavaScript syntax validation, extracted `index.html` module syntax
validation, secret/data-URL logging scan, browser console/unhandled-error
checks, and whole-branch diff review.

- [ ] **Step 3: Request whole-branch code review**

Review the complete diff from `origin/main` for requirement coverage,
unintended Smart Hundo V2 changes, privacy leakage, request multiplicity,
ownership races, and regression risk. Resolve every Critical or Important
finding and rerun its covering tests.

- [ ] **Step 4: Commit, push, and create the PR**

Stage only intended files, commit with a focused message, push
`fix/trainer-team-fixed-ui-evidence`, and open a PR against `main`. Do not merge
the PR.

