const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function span(start, end) {
  const from = source.indexOf(start);
  assert(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from);
  assert(to > from, `missing ${end}`);
  return source.slice(from, to);
}

assert(source.includes("const HUNDO_SMART_REASONING_EFFORT = 'high'"));
assert(source.includes("new Set(['high', 'medium'])"));
assert(source.includes("get('hundo_test') === '1'"));
assert(source.includes('const smartHundoReasoningEffort = getSmartHundoReasoningEffortForRun();'));
assert(source.includes('reasoningEffort: smartHundoReasoningEffort'));
assert(!source.includes('localStorage.setItem(\'hundoReasoningEffort'));
assert.strictEqual((source.match(/onclick="autoScan\(\)"/g) || []).length, 1, 'comparison must reuse one scan button');

const extraction = span('        const requestSmartHundoExtractionV2 = async', '        const runSmartHundoFormVerification = async');
const calls = [];
let structuralResponses = [
  { result: { cards: [], detected_card_count: 1, scan_complete: false, bottom_edge_checked: false }, finish_reason: 'stop', returned_model: 'gpt-5.6-sol', usage: { input_tokens: 10 } },
  { result: { cards: [], detected_card_count: 0, scan_complete: true, bottom_edge_checked: true }, finish_reason: 'stop', returned_model: 'gpt-5.6-sol', usage: { input_tokens: 8 } }
];
const factory = new Function('requestOpenAiJsonSchema', 'buildSmartHundoPrompt', 'HUNDO_SMART_SCHEMA', 'aiScanNow', 'normalizePokemonBaseName', `
 const HUNDO_SMART_MODEL = 'gpt-5.6-sol';
 const HUNDO_SMART_REASONING_EFFORT = 'high';
 const HUNDO_SMART_REASONING_EFFORTS = new Set(['high', 'medium']);
 const HUNDO_SMART_IMAGE_DETAIL = 'high';
 ${extraction}
 return { requestSmartHundoExtractionV2, requestSmartHundoWithStructuralRetry };
`);
const api = factory(
  async (_key, _prompt, _image, _schema, _status, options) => { calls.push({ ...options }); return structuralResponses.shift(); },
  value => value,
  {},
  (() => { let now = 0; return () => ++now; })(),
  value => value
);
globalThis.SmartHundoHelpers = {
  normalizeSmartHundoResult: value => value,
  validateSmartHundoStructure: result => ({ structurally_complete: result.scan_complete && result.bottom_edge_checked && result.detected_card_count === result.cards.length, reasons: ['scan_incomplete'] })
};

(async () => {
  const retried = await api.requestSmartHundoWithStructuralRetry({ apiKey: 'not-recorded', originalDataUrl: 'not-recorded', imageIndex: 0, reasoningEffort: 'medium' });
  assert.deepStrictEqual(calls.map(call => call.reasoningEffort), ['medium', 'medium'], 'primary and structural retry retain medium');
  assert.deepStrictEqual(calls.map(call => call.diagnosticRequestType), ['hundo_card', 'hundo_card_structural_retry']);
  assert.strictEqual(retried.attempt_count, 2);
  assert.deepStrictEqual(retried.card_request_usages, [{ input_tokens: 10 }, { input_tokens: 8 }]);

  calls.length = 0;
  structuralResponses = [{ result: { cards: [], detected_card_count: 0, scan_complete: true, bottom_edge_checked: true }, finish_reason: 'stop' }];
  await api.requestSmartHundoWithStructuralRetry({ apiKey: 'x', originalDataUrl: 'x', imageIndex: 0, reasoningEffort: 'invalid' });
  assert.deepStrictEqual(calls.map(call => call.reasoningEffort), ['high'], 'invalid/default override sends high');
  assert.strictEqual(calls.length, 1, 'complete result causes no comparison scan or fallback');

  const helpers = require('../smart-hundo-helpers.js');
  const safeDiagnostics = helpers.shapeSmartHundoDiagnostics({ screenshots: [{
    smart_hundo_reasoning_effort: 'medium', card_request_count: 1,
    card_request_usages: [{ input_tokens: 21, output_tokens: 9, reasoning_tokens: 4, cached_input_tokens: 3, apiKey: 'leak', image: 'leak' }]
  }] });
  assert.deepStrictEqual(safeDiagnostics.screenshots[0].card_request_usages, [{ input_tokens: 21, output_tokens: 9, reasoning_tokens: 4, cached_input_tokens: 3 }]);
  assert.strictEqual(safeDiagnostics.screenshots[0].smart_hundo_reasoning_effort, 'medium');
  assert(!JSON.stringify(safeDiagnostics).includes('leak'));

  const count = span('        const requestHundoCountExtraction = async', '        const requestSmartHundoExtractionV2 = async');
  const verifier = span('        const requestSmartHundoFormVerification = async', '        const safeTrainerTeamErrorSummary =');
  assert(count.includes('reasoningEffort: HUNDO_COUNT_REASONING_EFFORT'));
  assert(verifier.includes('reasoningEffort: HUNDO_FORM_VERIFY_REASONING_EFFORT'));
  assert(!count.includes('smartHundoReasoningEffort') && !verifier.includes('smartHundoReasoningEffort'));

  const autoScan = span('        window.autoScan = async function()', '        window.analyzeMultipleImages = window.autoScan;');
  assert(autoScan.indexOf('getSmartHundoReasoningEffortForRun()') < autoScan.indexOf('await Promise.all'), 'effort is snapshotted before asynchronous work');
  assert(autoScan.includes('setHundoReasoningTestDisabled(true)') && autoScan.includes('setHundoReasoningTestDisabled(false)'));
  assert(autoScan.indexOf('diagnostics.processing_duration_ms = aiScanNow() - scanStartedAt') < autoScan.indexOf('alert(`以下欄位'), 'processing timer stops before blocking completion alert');
  assert(autoScan.includes('diagnostics.within_60s = operationComplete && !hasManualReview'));
  assert(autoScan.includes('diagnostics.operation_complete = false;'));

  console.log('Smart Hundo reasoning comparison tests passed; mocked responses only, 0 live OpenAI requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
