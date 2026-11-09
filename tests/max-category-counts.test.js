'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const helpers = require('../max-category-count-helpers.js');

const screenshot = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const evidence = (dynaCount, gigaCount) => ({
    dyna_label: '極巨化', dyna_count: dynaCount, dyna_position: 'directly_below_label',
    giga_label: '超極巨化', giga_count: gigaCount, giga_position: 'directly_below_label'
});
const overview = 'CATEGORY_OVERVIEW_SCREEN';
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('13', '3'), overview).values,
    { dyna: '13', giga: '3' },
    'each label owns the number underneath its own icon, including lower-row 3 vs upper-row 13');
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('１３', '３'), overview).values,
    { dyna: '13', giga: '3' });
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('13', '13'), overview).values,
    { dyna: '13', giga: '13' }, 'equal counts may be legitimate, do not reject automatically');
assert.deepEqual(helpers.validateMaxCategoryEvidence({
    ...evidence('13', '3'), giga_label: '極巨化'
}, overview).values, { dyna: '13', giga: '' }, 'exact labels prevent substring collision');
assert.deepEqual(helpers.validateMaxCategoryEvidence({
    ...evidence('13', '3'), giga_position: 'other'
}, overview).values, { dyna: '13', giga: '' }, 'adjacent rather than owned counts must fail closed');
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('13隻', '3/13'), overview).values,
    { dyna: '', giga: '' }, 'reject inferred arithmetic or non-literal digits');
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('0', '3'), overview).values,
    { dyna: '0', giga: '3' }, 'visible zero differs from unknown');
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('13', '3'), 'DYNA_CATEGORY_SCREEN').values,
    { dyna: '13', giga: '' }, 'a single category must not populate the other count');
assert.deepEqual(helpers.validateMaxCategoryEvidence(evidence('13', '3'), 'GIGA_CATEGORY_SCREEN').values,
    { dyna: '', giga: '3' });
const valid = helpers.validateMaxCategoryEvidence(evidence('13', '3'), overview);
const merged = helpers.reconcileMaxCategoryEvidence([valid]);
assert.equal(merged.dyna, '13');
assert.equal(merged.giga, '3');
assert.deepEqual(merged.audited_fields, ['dyna', 'giga']);
const conflict = helpers.reconcileMaxCategoryEvidence([
    valid, helpers.validateMaxCategoryEvidence(evidence('13', '4'), overview)
]);
assert.equal(conflict.dyna, '13');
assert.equal(conflict.giga, '');
assert.match(conflict.review_messages.giga, /衝突/);
const unverifiable = helpers.reconcileMaxCategoryEvidence([
    helpers.validateMaxCategoryEvidence({ ...evidence('13', '3'), giga_label: '極巨化' }, overview)
]);
assert.equal(unverifiable.giga, '');
assert.match(unverifiable.review_messages.giga, /核對原圖/);
assert.deepEqual(helpers.reconcileMaxCategoryEvidence([]).audited_fields, []);

for (const text of [
    '<script src="max-category-count-helpers.js"></script>',
    'const MAX_CATEGORY_COUNT_JSON_SCHEMA =',
    'const requestMaxCategoryCountVerification =',
    'maxCategoryVerificationTask',
    'reconcileMaxCategoryEvidence(maxCategoryRecords)',
    "setAiFieldReview('st_dyna'",
    "setAiFieldReview('st_giga'",
    "'directly_below_label'",
    'fileToOriginalDataUrl(job.file)'
]) assert(screenshot.includes(text), 'missing max category count integration: ' + text);
const prompt = screenshot.slice(
    screenshot.indexOf('const buildMaxCategoryCountVerificationPrompt ='),
    screenshot.indexOf('const buildSmartHundoPrompt =')
);
for (const term of ['極巨化', '超極巨化', '13', '3', '正下方', '禁止']) {
    assert(prompt.includes(term), 'focused prompt must ground label to count: ' + term);
}
console.log('PASS exact-label Dynamax / Gigantamax category count verification');
