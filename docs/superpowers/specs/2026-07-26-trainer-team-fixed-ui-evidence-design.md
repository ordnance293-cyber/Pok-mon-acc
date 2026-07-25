# Trainer Team Fixed UI Evidence Design

## Status

This design implements the user-approved requirements for
`fix/trainer-team-fixed-ui-evidence`. The user request is the approval baseline:
team recognition must be independent from ordinary trainer-profile extraction,
must use fixed UI evidence only, and must not modify Smart Hundo State Pipeline
V2, Firebase/GAS payloads, or generated copywriting.

## Root cause

The current ordinary pipeline is:

`TRAINER_PROFILE_SCREEN` classification → ordinary extraction prompt → raw
`team` string → `normalizeTeamValue()` → first-non-empty ordinary merge →
`applyAiResultToForm()` → `g_team`.

The ordinary profile prompt currently says to infer team from “background color
+ XP bar color.” It does not define a bounded background region and does not
exclude Buddy Pokémon, Shadow aura, avatar clothing, or the dominant image
color. The raw schema accepts an arbitrary string; `normalizeTeamValue()` then
uses substring matching, and the ordinary multi-image merge keeps the first
same-priority non-empty team. If extraction is empty, `applyAiResultToForm()`
leaves the select untouched while the form defaults to blue. These behaviors
allow a large blue Dialga to become an apparent AI-recognized blue team and
prevent conflicts from surfacing.

## Considered approaches

### 1. Dedicated structured evidence path — selected

Keep classification and ordinary level/XP extraction unchanged, but remove
`team` from every ordinary authority/retry/merge/apply list. Build one lossless
PNG evidence composite per trainer-profile screenshot, make one dedicated
high-detail structured request, then derive the effective team with a pure
deterministic validator.

This is selected because it prevents broad-image evidence at the input,
requires explicit evidence at the model boundary, and makes acceptance and
conflict behavior testable without paid API calls.

### 2. Tighten only the ordinary prompt

This is smaller, but the model would still return a trusted scalar team without
machine-verifiable evidence. It would also leave first-image conflict behavior,
ordinary retries, stale ownership, and default-blue ambiguity intact.

### 3. Browser-side pixel color detection

This avoids a dedicated model request but is brittle across device scaling,
anti-aliasing, UI themes, capture color profiles, and future Pokémon GO layout
changes. It would require stronger layout assumptions than the supplied
evidence supports.

## Components and boundaries

### `trainer-team-helpers.js`

A DOM-free IIFE module exposes `globalThis.TrainerTeamHelpers` and
`module.exports` with:

- `normalizeTrainerTeamResult(result)`
- `validateTrainerTeamEvidence(result, options)`
- `mergeTrainerTeamResults(validatedResults)`
- `formatTrainerTeamStatus(mergedResult)`
- `TRAINER_TEAM_CONFIDENCE_THRESHOLD`

It accepts only `yellow`, `blue`, `red`, or `uncertain` colors and `clear`,
`partial`, `hidden`, or `uncertain` visibility. Unknown or malformed values
normalize to `uncertain`; confidence clamps to `[0, 1]`.

### Dedicated production path in `index.html`

- `TRAINER_TEAM_SCHEMA`
- `buildTrainerTeamPrompt()`
- `buildTrainerTeamEvidenceImage(originalDataUrl)`
- `requestTrainerTeamExtraction(...)`
- `runTrainerTeamScan(...)`
- `publishTrainerTeamDiagnostics(...)`

The path remains inside the existing single-page module and calls the existing
OpenAI JSON-schema request primitive. It does not change `OPENAI_MODEL`.

## Focused evidence image

`buildTrainerTeamEvidenceImage()` receives the original uploaded image data
URL. It loads the original image and draws two native-resolution crop regions
onto one canvas:

1. the upper profile-name and `& Buddy name` block, cropped to exclude as much
   Buddy body as practical;
2. the level/XP block containing the large level number, level label, XP fill,
   XP numeric text, and right-side progress accent.

The composite is emitted with `canvas.toDataURL('image/png')`; it does not use
the ordinary 1000 px resize, JPEG encoding, or quality `0.7`. Crop percentages
are input-focusing defaults only. The prompt requires `uncertain` when the fixed
components are absent and forbids inferring team from crop location or image
dominance.

There is one logical dedicated request per trainer-profile screenshot. HTTP
transport retries remain those of the existing request primitive; there is no
semantic retry and no per-element request.

## Structured schema and prompt

The strict top-level object contains:

- `model_team_candidate`
- `model_confidence`
- `level_number`
- `xp_bar_fill`
- `xp_value_text`
- `profile_name_block`
- `arrow_or_progress_accent`

Every evidence object has required `visibility` and `color`, with
`additionalProperties: false`. The top-level object also has
`additionalProperties: false`, and every property is required.

The candidate and every color are restricted to `yellow`, `blue`, `red`, or
`uncertain`; visibility is restricted to `clear`, `partial`, `hidden`, or
`uncertain`.

The prompt explicitly:

- inspects only the five fixed UI sources;
- excludes Buddy species/body/outline/color, Shadow smoke/aura, shiny and
  Dynamax effects, trainer appearance, rewards, buttons, status chrome, active
  tab underline, dominant color, and the large central area;
- states that outer background/watermark is diagnostic context only;
- includes the four required counterexamples, including yellow UI with blue
  Dialga and red UI with blue/gold Zamazenta;
- states that body color can never override fixed UI evidence.

## Deterministic validation

Primary sources are `level_number`, `xp_bar_fill`, and `xp_value_text`.
Secondary sources are `profile_name_block` and
`arrow_or_progress_accent`.

The validator applies the rules in this order:

1. Confidence below `0.85` returns `uncertain`.
2. Two or more clear primary sources with different colors return
   `uncertain` and `primary_conflict`; secondary evidence cannot override it.
3. No clear primary source returns `uncertain`.
4. At least two clear primary sources of one color, with no clear primary
   conflict, accept that color.
5. Exactly one clear primary source requires both clear secondary sources to
   match that same color.
6. A different `model_team_candidate` adds
   `model_evidence_disagreement` but does not replace deterministic evidence.
7. Only a validated effective color maps to `黃隊`, `藍隊`, or `紅隊`.

The validator ignores all unknown properties, including any test fixture fields
such as `buddy_color`, `shadow_aura_color`, or `dominant_image_color`.

## Multiple screenshots

Every profile screenshot is normalized and validated independently.
`mergeTrainerTeamResults()` uses only valid effective colors:

- all valid results agree: use the common team;
- only one valid result: use it;
- conflicting valid results: return `uncertain`, add `team_conflict`, and do
  not select by upload order;
- no valid result: return `uncertain`.

## Ordinary extraction integration

`TRAINER_PROFILE_SCREEN` ordinary extraction remains responsible for `level`
and `xp` only. `team` is removed from:

- allowed, expected, and retry-required profile fields;
- ordinary required-field coverage;
- ordinary field-source priority;
- ordinary autofill mapping;
- the ordinary structured output contract and profile prompt.

Consequently, an old or malformed ordinary `team` value cannot be normalized,
merged, retried, or written to `g_team`. Level and XP normalization and form
application remain unchanged.

## Ownership, stale runs, and UI

Trainer-team ownership is independent from Smart Hundo ownership:

- beginning a new profile-team scan clears only an unchanged AI-owned team;
- a manual `g_team` change removes the ownership marker and increments a manual
  revision;
- a manual edit made while a request is pending prevents that request from
  overwriting the edit;
- uncertain results never write `g_team`;
- stale scan IDs cannot write the form, diagnostics, or team status.

The team select gains an empty manual-confirmation option so a missing team is
not visually represented as a default blue AI result. The dedicated status
element shows:

- `隊伍辨識完成：黃隊` (or the validated team);
- `隊伍需人工確認：固定 UI 證據不足`;
- a precise primary-conflict or multi-screenshot-conflict message.

## Safe diagnostics

`window.lastTrainerTeamDiagnostics` contains only:

- scan run ID;
- per-screenshot index;
- model candidate and confidence;
- normalized fixed UI evidence;
- effective color/team;
- validation reasons;
- conflicts;
- whether a validated value was applied to the form.

It never contains an API key, authorization data, an image/data URL, a `File`,
request/response bodies, or Firebase/GAS credentials.

## Verification strategy

Browser tests use real helper and page code with the existing strict mocked
OpenAI boundary. They cover all required Buddy/color counterexamples,
primary/secondary consensus, conflicts, model disagreement, low confidence,
multi-screenshot merge, PNG/high-detail request behavior, one logical request
per profile screenshot, ordinary raw-team rejection, level/XP preservation,
ownership, stale writes, diagnostics redaction, and zero live requests.

Static regressions preserve the Smart Hundo V2 schema/helper/routing, ordinary
resize behavior, Firebase/GAS save path, and generated copywriting. Manual
acceptance records real-image results without committing screenshots or raw API
responses.

