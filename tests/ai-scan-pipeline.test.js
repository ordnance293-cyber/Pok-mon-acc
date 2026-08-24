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

assert(!source.includes('AI_REQUIRED_VALIDATION_PASSES'), 'two-pass validation must be removed');

const extraction = span('const extractSingleAiImage = async', 'const buildOrdinaryRecoveryTargets =');
assert.strictEqual((extraction.match(/requestSingleImageExtraction/g) || []).length, 1,
  'one extraction invocation must issue exactly one semantic request');
assert(!extraction.includes('retriedResult'), 'missing fields must not trigger an internal retry');

const targetBuilder = span('const buildOrdinaryRecoveryTargets =', 'const runOrdinaryRecoveryBatch = async');
assert(targetBuilder.includes('buildValidationTargets'), 'recovery fields must be grouped by screenshot');

const recovery = span('const runOrdinaryRecoveryBatch = async', 'const runAiExtractionBatch = async');
assert(recovery.includes('overrideFields: target.fields'), 'one recovery request must include every missing field');
assert(!recovery.includes('runOrdinaryRecoveryBatch('), 'recovery must not recursively invoke itself');
assert(!/for\s*\([^)]*pass/.test(recovery), 'there must be no second recovery pass');
assert.strictEqual((recovery.match(/extractSingleAiImage\s*\(/g) || []).length, 1,
  'each grouped screenshot must have one recovery invocation');

for (const fragment of [
  "const HUNDO_COUNT_MODEL = 'gpt-5.6-luna'",
  "const HUNDO_COUNT_REASONING_EFFORT = 'medium'",
  "const HUNDO_SMART_MODEL = 'gpt-5.6-sol'",
  "const HUNDO_SMART_REASONING_EFFORT = 'high'",
  "const HUNDO_FORM_VERIFY_MODEL = 'gpt-5.6-sol'",
  "const HUNDO_FORM_VERIFY_REASONING_EFFORT = 'high'",
  'requestHundoCountExtraction(',
  'requestSmartHundoExtractionV2(',
  'structural_retry_used',
  'requestSmartHundoFormVerification('
]) assert(source.includes(fragment), `Smart Hundo safeguard missing: ${fragment}`);

const progress = span('const createAiScanProgress =', 'const createAiScanDiagnostics =');
for (const label of ['準備圖片', '圖片分類', '一般欄位掃描', '缺漏欄位補掃', '百神辨識中',
  '特殊型態複核中', '訓練家隊伍驗證', '最終資料統整中']) {
  assert(progress.includes(label), `progress phase missing: ${label}`);
}
assert(progress.includes('isCurrentAutoScanRun(runId)'), 'stale scan progress must be rejected');
assert(!source.includes('欄位複檢 1/2') && !source.includes('欄位複檢 2/2'),
  'obsolete validation progress states must be removed');

for (const key of [
  'total_files', 'classified_files', 'normal_files', 'smart_hundo_files',
  'ordinary_primary_request_count', 'ordinary_recovery_request_count',
  'stage_duration_ms', 'total_duration_ms'
]) assert(source.includes(key), `diagnostic key missing: ${key}`);
assert(source.includes('window.lastAiScanDiagnostics'), 'run diagnostics must be published');

console.log('AI scan pipeline request budget and progress tests passed.');
