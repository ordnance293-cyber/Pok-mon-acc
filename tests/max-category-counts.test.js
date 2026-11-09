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

// Regression for the real November screenshot: first-pass 12 and 4 must not
// disappear simply because a separate high-detail request is inconclusive.
const emptyVerification = helpers.validateMaxCategoryEvidence({
    dyna_label: '', dyna_count: '', dyna_position: 'not_visible',
    giga_label: '', giga_count: '', giga_position: 'not_visible'
}, overview);
const fromPrimary = helpers.reconcileMaxCategoryEvidence(
    [emptyVerification], { dyna: '12', giga: '4' }
);
assert.equal(fromPrimary.dyna, '12');
assert.equal(fromPrimary.giga, '4');
assert.match(fromPrimary.review_messages.dyna, /保留初步辨識/);
assert.match(fromPrimary.review_messages.giga, /保留初步辨識/);

// The previous 13/13 duplicate bug must not return if the focused verifier fails.
const duplicatedPrimary = helpers.reconcileMaxCategoryEvidence(
    [emptyVerification], { dyna: '13', giga: '13' }
);
assert.equal(duplicatedPrimary.dyna, '13');
assert.equal(duplicatedPrimary.giga, '');
assert.match(duplicatedPrimary.review_messages.giga, /相同/);

// Valid independent Gigantamax evidence can correct a copied initial count.
const fixedDuplicate = helpers.reconcileMaxCategoryEvidence(
    [valid], { dyna: '13', giga: '13' }
);
assert.equal(fixedDuplicate.dyna, '13');
assert.equal(fixedDuplicate.giga, '3');

// A focused read of only one label must not wipe the other initial count.
const partialVerified = helpers.validateMaxCategoryEvidence({
    ...evidence('12', '4'), giga_label: ''
}, overview);
const mixed = helpers.reconcileMaxCategoryEvidence([partialVerified], { dyna: '12', giga: '4' });
assert.equal(mixed.dyna, '12');
assert.equal(mixed.giga, '4');

const noFirstPass = helpers.reconcileMaxCategoryEvidence([emptyVerification], {});
assert.equal(noFirstPass.dyna, '');
assert.equal(noFirstPass.giga, '');
assert.match(noFirstPass.review_messages.dyna, /沒有可靠數字/);

const zeroPrimary = helpers.reconcileMaxCategoryEvidence(
    [emptyVerification], { dyna: '0', giga: '4' }
);
assert.equal(zeroPrimary.dyna, '0');
assert.equal(zeroPrimary.giga, '4');


for (const text of [
    '<script src="max-category-count-helpers.js"></script>',
    'const MAX_CATEGORY_COUNT_JSON_SCHEMA =',
    'const requestMaxCategoryCountVerification =',
    'maxCategoryVerificationTask',
    'reconcileMaxCategoryEvidence(',
    "setAiFieldReview('st_dyna'",
    "setAiFieldReview('st_giga'",
    "'directly_below_label'",
    'fileToOriginalDataUrl(job.file)'
]) assert(screenshot.includes(text), 'missing max category count integration: ' + text);
const prompt = screenshot.slice(
    screenshot.indexOf('const buildMaxCategoryCountVerificationPrompt ='),
    screenshot.indexOf('const buildSmartHundoPrompt =')
);
for (const term of ['極巨化', '超極巨化', '正下方', '禁止']) {
    assert(prompt.includes(term), 'focused prompt must ground label to count: ' + term);
}
assert(screenshot.includes("classification.image_type === 'CATEGORY_OVERVIEW_SCREEN') return fileToOriginalDataUrl(job.file)"));
assert(screenshot.includes('requestOptions.imageDetail = HUNDO_SMART_IMAGE_DETAIL'));
console.log('PASS category count fallback, duplicate guard and native-image extraction');
