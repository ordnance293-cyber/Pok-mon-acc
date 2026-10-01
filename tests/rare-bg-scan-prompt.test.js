'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const rareHelpers = require('../rare-bg-scan-helpers.js');
const extractionStart = source.indexOf('const requestSingleImageExtraction =');
const extractionEnd = source.indexOf('const applyAiResultToForm =', extractionStart);
assert.ok(extractionStart >= 0 && extractionEnd > extractionStart, 'rare extraction function should remain present');
const extraction = source.slice(extractionStart, extractionEnd);

const rareStart = source.indexOf("case 'RARE_BACKGROUND_SCREEN':");
const armoredStart = source.indexOf("case 'ARMORED_MEWTWO_SCREEN':", rareStart);
const resourceStart = source.indexOf("case 'RESOURCE_SCREEN':", armoredStart);
assert.ok(rareStart >= 0 && armoredStart > rareStart && resourceStart > armoredStart, 'rare prompt branches should remain present');
const rarePrompt = source.slice(rareStart, armoredStart);
const armoredPrompt = source.slice(armoredStart, resourceStart);

const classificationStart = source.indexOf('const buildAiClassificationPrompt =');
const classificationEnd = source.indexOf('const buildAiExtractionPrompt =', classificationStart);
assert.ok(classificationStart >= 0 && classificationEnd > classificationStart, 'classification prompt should remain present');
const classificationPrompt = source.slice(classificationStart, classificationEnd);

// The rare-card extractor must use the same model, reasoning budget, and image
// detail as the Smart Hundo extractor, without changing ordinary scans.
assert.match(extraction, /const isRareVisualScan = \['RARE_BACKGROUND_SCREEN', 'ARMORED_MEWTWO_SCREEN'\]\.includes\(classification\.image_type\);/);
assert.match(extraction, /requestOptions\.model = HUNDO_SMART_MODEL/);
assert.match(extraction, /requestOptions\.reasoningEffort = HUNDO_SMART_REASONING_EFFORT/);
assert.match(extraction, /imageDetail: isRareVisualScan \? HUNDO_SMART_IMAGE_DETAIL : AI_IMAGE_DETAIL/);

// Filled-vs-outline is the primary visual rule. The mapping is intentionally
// explicit so the model cannot fall back to species or color guesses.
assert.match(rarePrompt, /實心／塗滿 X 型圖標 = 超極巨化/);
assert.match(rarePrompt, /空心／只有輪廓.*X 型圖標 = 極巨化/);
assert.match(rarePrompt, /顏色深淺.*只能作為輔助/);
assert.match(rarePrompt, /不得依寶可夢種類、CP、名稱、排列位置或鄰近卡片猜測型態/);
assert.match(rarePrompt, /遮擋|模糊|不確定/);
assert.doesNotMatch(rarePrompt, /只能依圖標顏色深淺判斷/);

// Classification must also know the same icon distinction so it preserves the
// rare-card route and does not treat the screenshot as a numeric category page.
assert.match(classificationPrompt, /實心／塗滿 X 型圖標 = 超極巨化/);
assert.match(classificationPrompt, /空心／只有輪廓 X 型圖標 = 極巨化/);

// The new special-legendary search route must classify and extract Armored
// Mewtwo by visual form, then write a deterministic rare-list line.
assert.equal(rareHelpers.ARMORED_MEWTWO_SEARCH_FILTER, '特殊&傳說的寶可夢,幻,究極異獸');
assert.equal(rareHelpers.normalizeArmoredMewtwoRareList('稀有裝甲超夢4隻'), '稀有裝甲超夢4隻');
assert.equal(rareHelpers.normalizeArmoredMewtwoRareList('裝甲超夢*4'), '稀有裝甲超夢4隻');
assert.equal(
  rareHelpers.mergeArmoredMewtwoRareLists(['稀有裝甲超夢2隻', '稀有裝甲超夢3隻']),
  '稀有裝甲超夢5隻'
);
assert.match(classificationPrompt, /ARMORED_MEWTWO_SCREEN/);
assert.match(classificationPrompt, /特殊.*傳說.*專門用來辨識裝甲超夢/);
assert.match(armoredPrompt, /只計入「本體外觀可明確辨識為裝甲超夢」/);
assert.match(armoredPrompt, /名稱顯示「超夢」只能當輔助/);
assert.match(armoredPrompt, /排除普通超夢、Mega 超夢 X、Mega 超夢 Y/);
assert.match(armoredPrompt, /稀有裝甲超夢N隻/);
assert.match(source, /copySimpleText\('特殊&傳說的寶可夢,幻,究極異獸', this\)[^>]*>裝甲超夢<\/button>/);

const mergeStart = source.indexOf('const mergeAiResults =');
const mergeEnd = source.indexOf('const isPopulatedAiValue =', mergeStart);
const mergeBlock = source.slice(mergeStart, mergeEnd);
assert.ok(
  mergeBlock.indexOf('rareBackgroundLists') < mergeBlock.indexOf('armoredMewtwoLists'),
  'rare background lines must be merged before Armored Mewtwo lines'
);
assert.match(mergeBlock, /rareLines\.filter\(Boolean\)\.join\('\\n'\)/);

console.log('PASS rare background and armored Mewtwo scan prompt tests');
