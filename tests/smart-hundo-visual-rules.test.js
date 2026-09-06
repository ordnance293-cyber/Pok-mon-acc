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

const isolated = { globalThis: {} };
assert.throws(() => vm.runInNewContext(fs.readFileSync(require.resolve('../smart-hundo-form-verifier.js'), 'utf8'), isolated),
  /SmartHundoVisualRules must be loaded/);

console.log('PASS shared Smart Hundo visual rules, coverage, runtime wiring, and fail-fast loading');
