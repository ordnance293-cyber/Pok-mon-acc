const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('../smart-hundo-visual-rules.js');
const verifier = require('../smart-hundo-form-verifier.js');

const expectedIds = Object.values(verifier.VERIFIED_FORM_IDS_BY_BASE_SPECIES)
  .flat().filter(id => id !== 'uncertain');
assert.equal(expectedIds.length, 23);
assert.equal(rules.validateCoverage(expectedIds), true);
assert.deepEqual(Object.keys(rules.FORM_RULES).sort(), [...expectedIds].sort());
for (const id of expectedIds) {
  const item = rules.FORM_RULES[id];
  for (const field of ['base_species', 'family', 'silhouette', 'decisive_parts', 'reference_colors',
    'comparison', 'prohibited_shortcuts', 'visibility']) assert.ok(item[field], `${id}.${field}`);
  assert.equal(verifier.REQUIRED_VERIFIED_FORM_EVIDENCE[id].visual_rule, rules.visualRuleForForm(id));
}
assert.throws(() => rules.visualRuleForForm('unsupported_form'), /missing Smart Hundo visual rule/);
assert.throws(() => rules.validateCoverage([...expectedIds, 'unsupported_form']), /coverage mismatch/);

const primary = rules.buildPrimaryVisualRules();
for (const text of ['仍是四足', '兩條粗壯後腿承重', '也有長帶狀尾', '細長尖喙',
  '多個中心', '連續圓外緣', '粉紅極巨化 X', '看不見不等於沒有']) assert.ok(primary.includes(text), text);
for (const wrongPositive of ['無足或雙足晶體柱。', '較短尾部；不可只靠顏色', '短腿與短粗喙']) {
  assert.equal(primary.includes(wrongPositive), false, wrongPositive);
}

const index = fs.readFileSync(require.resolve('../index.html'), 'utf8');
assert.ok(index.indexOf('smart-hundo-visual-rules.js') < index.indexOf('smart-hundo-form-verifier.js'));
assert.ok(index.includes('SmartHundoVisualRules.buildPrimaryVisualRules()'));
assert.ok(index.includes('SmartHundoVisualRules.familyRulesForFormIds(candidateIds)'));
assert.ok(index.includes('SmartHundoVisualRules.BACKGROUND_RULES'));
assert.ok(index.includes("requestedDimensions.has('form')"));
assert.ok(index.includes("requestedDimensions.has('background')"));
assert.equal(index.includes('large pink background'), false);

const declaration = name => {
  const marker = `        const ${name} =`;
  const start = index.indexOf(marker);
  assert.ok(start >= 0, `missing production declaration ${name}`);
  const end = index.indexOf('\n        const ', start + marker.length);
  assert.ok(end > start, `unterminated production declaration ${name}`);
  return index.slice(start, end);
};
const requests = [];
const runtime = {
  SmartHundoVisualRules: rules,
  SmartHundoFormVerifier: verifier,
  HUNDO_LEGENDARY_FILTER: '傳說的寶可夢,幻,究極異獸&4*',
  HUNDO_SMART_SCHEMA: { name: 'pokemon_go_smart_hundo_v2' },
  HUNDO_FORM_VERIFIER_SCHEMA: { name: 'pokemon_go_smart_hundo_form_verifier_v2' },
  HUNDO_SMART_MODEL: 'gpt-5.6-sol',
  HUNDO_SMART_REASONING_EFFORT: 'medium',
  HUNDO_SMART_IMAGE_DETAIL: 'high',
  HUNDO_FORM_VERIFY_MODEL: 'gpt-5.6-sol',
  HUNDO_FORM_VERIFY_REASONING_EFFORT: 'high',
  requestOpenAiJsonSchema: async (...args) => { requests.push(args); return { cards: [] }; }
};
vm.createContext(runtime);
for (const name of ['isDenseExactArray', 'isValidSmartHundoFormVerificationJobs', 'buildSmartHundoPrompt',
  'buildSmartHundoFormVerifierPrompt', 'requestSmartHundoFormVerification', 'requestSmartHundoExtractionV2']) {
  vm.runInContext(`${declaration(name)}\nthis.${name}=${name};`, runtime);
}
const familyJobs = [1, 2].map((number, index) => ({
  tile_id: `T${number}`, card_id: `0:1:1:${number}`, screenshot_index: 0,
  base_species: '帝牙盧卡', requested_dimensions: ['form'],
  candidate_form_ids: ['dialga_standard', 'dialga_origin', 'uncertain']
}));
const backgroundJobs = [{ tile_id: 'T1', card_id: '0:1:1:1', screenshot_index: 0,
  base_species: '超夢', requested_dimensions: ['background'], candidate_form_ids: [] }];
const realmValue = value => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, runtime);
const runtimeFamilyJobs = realmValue(familyJobs);
const runtimeBackgroundJobs = realmValue(backgroundJobs);
const primaryPrompt = runtime.buildSmartHundoPrompt();
const retryPrompt = runtime.buildSmartHundoPrompt({ structuralRetry: true });
for (const prompt of [primaryPrompt, retryPrompt]) {
  for (const safeguard of ['visible_label 只能作為次要證據',
    '不得因為 visible_label 只顯示基礎物種，就退回 standard 或 base',
    '不得被 visible_label 帶回 dialga_standard', '證據不足仍為 uncertain',
    'dialga_origin：帝牙盧卡：仍是四足', '特別背卡：', '紀念背卡：']) assert.ok(prompt.includes(safeguard), safeguard);
}
assert.ok(retryPrompt.includes('【結構重試】'));
const repeatedFamilyPrompt = runtime.buildSmartHundoFormVerifierPrompt(runtimeFamilyJobs);
for (const candidate of familyJobs[0].candidate_form_ids) assert.ok(repeatedFamilyPrompt.includes(candidate));
assert.equal((repeatedFamilyPrompt.match(/dialga_standard：/g) || []).length, 1);
assert.ok(!repeatedFamilyPrompt.includes('【背景徽章比較】'));
assert.ok(!repeatedFamilyPrompt.includes('特別背卡：'));
const backgroundPrompt = runtime.buildSmartHundoFormVerifierPrompt(runtimeBackgroundJobs);
for (const contrast of ['特別背卡：', '紀念背卡：', '才支持 none']) assert.ok(backgroundPrompt.includes(contrast));
assert.ok(!backgroundPrompt.includes('【候選家族比較】'));

(async () => {
  await runtime.requestSmartHundoExtractionV2('key', 'data:image/png;base64,AA==', () => {});
  await runtime.requestSmartHundoExtractionV2('key', 'data:image/png;base64,AA==', () => {}, { structuralRetry: true });
  await runtime.requestSmartHundoFormVerification({ apiKey: 'key', contactSheetDataUrl: 'data:image/png;base64,AA==',
    verificationJobs: runtimeFamilyJobs, statusUpdater: () => {} });
  assert.deepEqual(requests.map(call => call[5].diagnosticRequestType),
    ['hundo_card', 'hundo_card_structural_retry', 'hundo_form_verifier']);
  assert.deepEqual(requests.map(call => call[5].model), ['gpt-5.6-sol', 'gpt-5.6-sol', 'gpt-5.6-sol']);
  assert.deepEqual(requests.map(call => call[5].reasoningEffort), ['medium', 'medium', 'high']);
  assert.deepEqual(requests.map(call => call[5].imageDetail), ['high', 'high', 'high']);
  assert.deepEqual(requests.map(call => call[2]), Array(3).fill('data:image/png;base64,AA=='));
  assert.deepEqual(requests.map(call => call[3].name),
    ['pokemon_go_smart_hundo_v2', 'pokemon_go_smart_hundo_v2', 'pokemon_go_smart_hundo_form_verifier_v2']);
  console.log('PASS shared Smart Hundo visual rules and actual production request builders');
})().catch(error => { console.error(error); process.exitCode = 1; });

const isolated = { globalThis: {} };
assert.throws(() => vm.runInNewContext(fs.readFileSync(require.resolve('../smart-hundo-form-verifier.js'), 'utf8'), isolated),
  /SmartHundoVisualRules must be loaded/);

console.log('PASS shared Smart Hundo visual rules, coverage, runtime wiring, and fail-fast loading');
