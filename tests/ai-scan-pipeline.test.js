const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function span(start, end) {
  const from = source.indexOf(start);
  assert.notStrictEqual(from, -1, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notStrictEqual(to, -1, `missing ${end}`);
  return source.slice(from, to);
}

// A/B/C: orchestration has one primary request and one grouped recovery request.
assert(!source.includes('AI_REQUIRED_VALIDATION_PASSES'), 'multi-pass validation must be removed');
const extraction = span('const extractSingleAiImage = async', 'const runOrdinaryRecoveryBatch = async');
assert(extraction.includes('allowInternalRetry = false'), 'ordinary extraction must disable semantic self-retry');
assert(!extraction.includes('requestSingleImageExtraction') ||
  (extraction.match(/requestSingleImageExtraction/g) || []).length === 1,
  'one invocation may issue only one semantic extraction request');

const recovery = span('const runOrdinaryRecoveryBatch = async', 'const runAiExtractionBatch = async');
assert(recovery.includes('buildOrdinaryRecoveryTargets'), 'recovery targets must be grouped per screenshot');
assert(recovery.includes('overrideFields: target.fields'), 'one request must contain all missing fields');
assert(recovery.includes('allowInternalRetry: false'), 'recovery must not self-retry');
assert(!/for\s*\([^)]*pass/.test(recovery), 'recovery must not contain another pass loop');

// D: capacity belongs exclusively to the strict dedicated verifier.
assert(source.includes("const DEDICATED_VERIFICATION_FIELDS = new Set(['poke_bag', 'item_bag'])"));
assert(span('const buildOrdinaryRecoveryTargets =', 'const runOrdinaryRecoveryBatch = async')
  .includes('DEDICATED_VERIFICATION_FIELDS'));

// E: lock all Smart Hundo accuracy controls and request wiring.
for (const fragment of [
  "const HUNDO_COUNT_MODEL = 'gpt-5.6-luna'",
  "const HUNDO_SMART_MODEL = 'gpt-5.6-sol'",
  "const HUNDO_SMART_REASONING_EFFORT = 'high'",
  "const HUNDO_FORM_VERIFY_MODEL = 'gpt-5.6-sol'",
  'requestHundoCountExtraction(',
  'requestSmartHundoExtractionV2(',
  'structural_retry_used',
  'requestSmartHundoFormVerification('
]) assert(source.includes(fragment), `Smart Hundo safeguard missing: ${fragment}`);

// F/G: the coordinator selects unfinished work and rejects stale-run writes.
const progress = span('const createAiScanProgress =', 'const createAiScanDiagnostics =');
assert(progress.includes('smartHundo'), 'pending Smart Hundo must remain visible');
assert(progress.includes('isCurrentAutoScanRun(runId)'), 'late scan progress must be ignored');
assert(!progress.includes('欄位複檢'), 'obsolete completed-phase label must not be used');

// Diagnostics and deterministic request budget are part of the public test surface.
for (const key of [
  'ordinary_primary_request_count', 'ordinary_recovery_request_count',
  'storage_verification_request_count', 'smart_hundo_count_request_count',
  'smart_hundo_card_request_count', 'smart_hundo_structural_retry_count',
  'smart_hundo_form_verifier_request_count', 'trainer_team_request_count',
  'stage_duration_ms', 'total_duration_ms'
]) assert(source.includes(key), `diagnostic key missing: ${key}`);

console.log('AI scan pipeline request budget and progress tests passed.');
