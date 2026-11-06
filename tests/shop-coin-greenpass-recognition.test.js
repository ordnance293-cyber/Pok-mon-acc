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

// The shop balance and the visible green premium pass have distinct routes.
const classifier = between('const buildAiClassificationPrompt =', 'const buildAiExtractionPrompt =');
for (const phrase of ['SHOP_COIN_SCREEN', 'ITEM_GREENPASS_SCREEN', '商店', '特級對戰入場券', '遠距團體戰入場券']) {
  assert(classifier.includes(phrase), 'classification guard missing: ' + phrase);
}
const schema = between('const OPENAI_CLASSIFICATION_JSON_SCHEMA =', 'const OPENAI_EXTRACTION_JSON_SCHEMA =');
assert(schema.includes("'SHOP_COIN_SCREEN'") && schema.includes("'ITEM_GREENPASS_SCREEN'"));

const context = {};
vm.createContext(context);
const numberHelpers = between('const extractSingleNumber =', 'const extractSlashSideNumber =');
vm.runInContext(numberHelpers + '\nthis.extractSingleNumber = extractSingleNumber; this.extractGreenPassCount = extractGreenPassCount;', context);
for (const [raw, expected] of [
  ['285', '285'], ['x285', '285'], ['×285', '285'], ['ｘ２８５', '285'],
  ['285張', '285'], ['x3+285', ''], ['3/285', ''], ['', '']
]) {
  assert.equal(context.extractGreenPassCount(raw), expected, 'pass numeric parse: ' + raw);
}
assert.equal(context.extractSingleNumber('294'), '294', 'shop balance numeric parse');
assert.equal(context.extractSingleNumber('250.00'), '', 'product price must not parse as a whole coin balance');

const extraction = between('const buildAiExtractionPrompt =', 'const buildSmartHundoPrompt =');
vm.runInContext(extraction.replace('const buildAiExtractionPrompt =', 'this.buildAiExtractionPrompt ='), context);
const shopPrompt = context.buildAiExtractionPrompt({ image_type: 'SHOP_COIN_SCREEN', search_query: '' });
const passPrompt = context.buildAiExtractionPrompt({ image_type: 'ITEM_GREENPASS_SCREEN', search_query: '' });
for (const phrase of ['coin', '金色皮卡丘', 'GO Pass', '手機電量', 'greenpass']) {
  assert(shopPrompt.includes(phrase), 'shop extraction safeguard missing: ' + phrase);
}
for (const phrase of ['greenpass', '特級對戰入場券', '遠距團體戰入場券', '團體戰入場券', 'item_bag']) {
  assert(passPrompt.includes(phrase), 'green pass extraction safeguard missing: ' + phrase);
}
assert(shopPrompt.includes('header_type="none"'));
assert(passPrompt.includes('header_type="item"'));

const allowedFields = between('const AI_IMAGE_TYPE_ALLOWED_FIELDS =', 'const AI_EXPECTED_FIELDS_BY_IMAGE_TYPE =');
assert(allowedFields.includes("SHOP_COIN_SCREEN: ['coin']"));
assert(allowedFields.includes("ITEM_GREENPASS_SCREEN: ['greenpass', 'item_bag']"));
const priorities = between('const AI_FIELD_SOURCE_PRIORITY =', 'const AI_FIELD_LABELS =');
assert(priorities.includes('coin: { SHOP_COIN_SCREEN: 2, RESOURCE_SCREEN: 1 }'));
assert(priorities.includes('greenpass: { ITEM_GREENPASS_SCREEN: 2, RESOURCE_SCREEN: 1 }'));
assert(source.includes("STORAGE_HEADER_IMAGE_TYPES = new Set(['RESOURCE_SCREEN', 'ITEM_GREENPASS_SCREEN', 'CATEGORY_OVERVIEW_SCREEN'])"));

const request = between('const requestSingleImageExtraction =', 'const classifySingleAiImage =');
assert(request.includes('isResourceVisualScan'), 'focused resources should use high-detail extraction');
assert(request.includes('(isRareVisualScan || isResourceVisualScan) ? HUNDO_SMART_IMAGE_DETAIL : AI_IMAGE_DETAIL'));
assert(source.includes("'SHOP_COIN_SCREEN', 'ITEM_GREENPASS_SCREEN', 'RESOURCE_SCREEN'].includes(job.classification.image_type)"),
  'resource extraction must preserve original screenshot resolution');

const generic = passPrompt.includes('這是一張 Pokémon GO「道具」背包畫面');
assert(generic, 'the pass page has its own prompt instead of a shared catch-all');
console.log('Shop Pokécoins / green premium pass recognition regression tests passed (no API calls).');
