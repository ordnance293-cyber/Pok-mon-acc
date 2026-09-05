const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = source.indexOf('const sanitizeAiScanDiagnostics =');
const end = source.indexOf('const recordAiDiagnosticRequest =', start);
assert(start >= 0 && end > start, 'safe diagnostics sanitizer must exist');
const sanitizerSource = source.slice(start, end)
  .replace('const sanitizeAiScanDiagnostics =', 'sanitizeAiScanDiagnostics =');
const context = {};
vm.runInNewContext(sanitizerSource, context);

const representative = {
  run_id: '7', total_files: 1, total_duration_ms: 42,
  request_counts: { classification: 1, ordinary_primary: 1, total: 2 },
  stage_duration_ms: { preparation: 2, classification: 10, ordinary_primary: 20 },
  images: [{
    image_index: 0,
    classification: { image_type: 'POKEMON_STORAGE', search_query: 'age0', duration_ms: 10, succeeded: true },
    ordinary: { expected_fields: ['st_legend'], primary_result: { legend: '8' }, missing_after_primary: [], recovery_triggered: false, recovery_fields: [], recovery_result: {}, final_result: { legend: '8' } },
    smart_hundo: { applicable: false },
    apiKey: 'do-not-copy', classificationDataUrl: 'data:image/jpeg;base64,abc',
    nested: { authorization: 'Bearer token', password: 'pw', accountId: '123', spreadsheetId: 'sheet', secret: 'x' }
  }]
};
const safe = context.sanitizeAiScanDiagnostics(representative);
assert.strictEqual(safe.total_files, 1, 'compatibility aggregate fields remain available');
assert.strictEqual(safe.images[0].ordinary.primary_result.legend, '8');
const serialized = JSON.stringify(safe);
for (const prohibited of ['apiKey', 'authorization', 'Bearer', 'password', 'accountId', 'spreadsheetId', 'secret', 'data:image/', 'originalDataUrl', 'classificationDataUrl', 'trainerTeamEvidenceDataUrl']) {
  assert(!serialized.toLowerCase().includes(prohibited.toLowerCase()), `diagnostics leaked ${prohibited}`);
}

for (const key of ['run_id', 'request_counts', 'images', 'preparation', 'classification', 'ordinary', 'storage', 'trainer_team', 'smart_hundo', 'final_applied_fields', 'failures']) {
  assert(source.includes(key), `diagnostics schema missing ${key}`);
}
assert(source.includes("recordAiDiagnosticRequest(options.diagnosticRequestType)"), 'request counts must be recorded at the transport boundary');
assert(source.includes("window.exportAiScanDiagnostics = () => sanitizeAiScanDiagnostics"), 'export must sanitize the published object');
assert(source.includes('const safe = window.exportAiScanDiagnostics();'), 'clipboard must use sanitized export');
assert(source.includes("diagnostics.images[job.index].failures.push(safeAiFailure(error, 'classification'))"), 'request failure metadata must be safe and per-image');
assert(source.includes('ordinary.primary_result = sanitizeAiScanDiagnostics(result.imageResult)'), 'primary result must be retained');
assert(source.includes('ordinary.recovery_result = sanitizeAiScanDiagnostics(result.imageResult)'), 'recovery result must be retained');
assert(source.includes('ordinary.final_result = sanitizeAiScanDiagnostics('), 'per-image merged result must be retained');
assert(source.includes('AI_CLASSIFICATION_BATCH_SIZE = 2'), 'classification concurrency stays locked');
assert(!source.includes('window.fetch =') && !source.includes('globalThis.fetch ='), 'diagnostics must not monkey-patch fetch');
assert.strictEqual((source.match(/id="aiDiagnosticsBtn"/g) || []).length, 1, 'diagnostics button id must be unique');
assert.strictEqual((source.match(/id="aiDiagnosticsModal"/g) || []).length, 1, 'diagnostics modal id must be unique');
console.log('AI scan safe diagnostics tests passed; 0 live OpenAI requests.');
