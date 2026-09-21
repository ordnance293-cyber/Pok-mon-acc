'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const extractionStart = source.indexOf('const requestSingleImageExtraction =');
const extractionEnd = source.indexOf('const applyAiResultToForm =', extractionStart);
assert.ok(extractionStart >= 0 && extractionEnd > extractionStart, 'rare extraction function should remain present');
const extraction = source.slice(extractionStart, extractionEnd);

const rareStart = source.indexOf("case 'RARE_BACKGROUND_SCREEN':");
const resourceStart = source.indexOf("case 'RESOURCE_SCREEN':", rareStart);
assert.ok(rareStart >= 0 && resourceStart > rareStart, 'rare prompt branch should remain present');
const rarePrompt = source.slice(rareStart, resourceStart);

const classificationStart = source.indexOf('const buildAiClassificationPrompt =');
const classificationEnd = source.indexOf('const buildAiExtractionPrompt =', classificationStart);
assert.ok(classificationStart >= 0 && classificationEnd > classificationStart, 'classification prompt should remain present');
const classificationPrompt = source.slice(classificationStart, classificationEnd);

// The rare-card extractor must use the same model, reasoning budget, and image
// detail as the Smart Hundo extractor, without changing ordinary scans.
assert.match(extraction, /const isRareBackgroundScan = classification\.image_type === 'RARE_BACKGROUND_SCREEN';/);
assert.match(extraction, /requestOptions\.model = HUNDO_SMART_MODEL/);
assert.match(extraction, /requestOptions\.reasoningEffort = HUNDO_SMART_REASONING_EFFORT/);
assert.match(extraction, /imageDetail: isRareBackgroundScan \? HUNDO_SMART_IMAGE_DETAIL : AI_IMAGE_DETAIL/);

// Filled-vs-outline is the primary visual rule. The mapping is intentionally
// explicit so the model cannot fall back to species or color guesses.
assert.match(rarePrompt, /實心／塗滿 X 型圖標 = 超極巨化/);
assert.match(rarePrompt, /空心／只有輪廓 X 型圖標 = 極巨化/);
assert.match(rarePrompt, /顏色深淺只能作為輔助/);
assert.match(rarePrompt, /不得依寶可夢種類、CP、名稱、排列位置或鄰近卡片猜測型態/);
assert.match(rarePrompt, /遮擋|模糊|不確定/);
assert.doesNotMatch(rarePrompt, /只能依圖標顏色深淺判斷/);

// Classification must also know the same icon distinction so it preserves the
// rare-card route and does not treat the screenshot as a numeric category page.
assert.match(classificationPrompt, /實心／塗滿 X 型圖標 = 超極巨化/);
assert.match(classificationPrompt, /空心／只有輪廓 X 型圖標 = 極巨化/);

console.log('PASS rare background filled-outline prompt tests');
