'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function between(start, end) {
  const i = source.indexOf(start);
  const j = source.indexOf(end, i + start.length);
  assert(i >= 0 && j > i, 'missing source section: ' + start);
  return source.slice(i, j);
}

const helperSource = between('const extractSingleNumber =', 'const extractSlashSideNumber =');
const context = {};
vm.createContext(context);
vm.runInContext(helperSource + '\nthis.extractItemStackCount = extractItemStackCount; this.extractSingleNumber = extractSingleNumber;', context);

for (const [raw, expected] of [
  ['1796', '1796'],
  ['x1796', '1796'],
  ['×1', '1'],
  ['ｘ１，７９６', '1796'],
  ['x 1,796 顆', '1796'],
  ['1,796顆', '1796'],
  ['  x1  ', '1'],
  ['', ''],
  ['神奇糖果XL x76', ''],
  ['XL76', ''],
  ['x76 x1796', ''],
  ['4332/1075', ''],
  ['x1+520', ''],
  ['200元', '']
]) {
  assert.equal(context.extractItemStackCount(raw), expected, 'item stack parse: ' + raw);
}
assert.equal(context.extractSingleNumber('x1796'), '', 'generic numeric parser must not silently take item stacks');

const allowed = between('const AI_IMAGE_TYPE_ALLOWED_FIELDS =', 'const AI_FIELD_SOURCE_PRIORITY =');
const shared = "ITEM_GREENPASS_SCREEN: ['greenpass', 'masterball', 'rarecandy', 'item_bag']";
assert.equal(allowed.split(shared).length - 1, 3, 'classification, expected, recovery schemas must preserve candy and Master Ball on green-pass screens');

const priorities = between('const AI_FIELD_SOURCE_PRIORITY =', 'const AI_FIELD_LABELS =');
assert(priorities.includes('masterball: { RESOURCE_SCREEN: 2, ITEM_GREENPASS_SCREEN: 1 }'));
assert(priorities.includes('rarecandy: { RESOURCE_SCREEN: 2, ITEM_GREENPASS_SCREEN: 1 }'));

const classifier = between('const buildAiClassificationPrompt =', 'const buildAiExtractionPrompt =');
assert(classifier.includes('9B. 若頂部顯示「道具」'));
assert(classifier.includes('9C. 若頂部顯示「道具」'));
assert(classifier.indexOf('9B. 若頂部顯示「道具」') < classifier.indexOf('9C. 若頂部顯示「道具」'));
assert(classifier.includes('不能因底部有「特級對戰入場券」就改成只辨識綠票'));
assert(classifier.includes('「神奇糖果XL」不等於「神奇糖果」'));

const extraction = between('const buildAiExtractionPrompt =', 'const buildSmartHundoPrompt =');
vm.runInContext(extraction.replace('const buildAiExtractionPrompt =', 'this.buildAiExtractionPrompt ='), context);
const resourcePrompt = context.buildAiExtractionPrompt({ image_type: 'RESOURCE_SCREEN', search_query: '' });
const greenPassPrompt = context.buildAiExtractionPrompt({ image_type: 'ITEM_GREENPASS_SCREEN', search_query: '' });
for (const [type, prompt] of [['resource', resourcePrompt], ['pass', greenPassPrompt]]) {
  for (const phrase of [
    '神奇糖果XL', '彩虹色圓形', '三角形彩虹色', '紫粉色精靈球', '白色 M',
    '大師球', 'rarecandy', 'masterball', '跨欄、跨列', '底部最後一列',
    'x／×數量', '看不到', '留空'
  ]) {
    assert(prompt.includes(phrase), type + ' item recognition rule missing: ' + phrase);
  }
}
assert(resourcePrompt.includes('升級包包 200'));
assert(resourcePrompt.includes('不是帳號持有寶可幣'));
assert(greenPassPrompt.includes('特級對戰入場券') && greenPassPrompt.includes('greenpass'));

const normalization = between('const normalizeAiExtraction =', 'const getExtractedFieldsForLog =');
assert(normalization.includes("field === 'masterball' || field === 'rarecandy'"));
assert(normalization.includes('extractItemStackCount(result?.[field])'));
assert(source.includes("masterball: 'st_masterball'"));
assert(source.includes("rarecandy: 'st_rarecandy'"));

console.log('Master Ball and regular Rare Candy screenshot recognition safeguards passed (no API calls).');
