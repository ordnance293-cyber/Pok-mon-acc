'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helper = require('../rare-bg-scan-helpers.js');

const promptStart = source.indexOf('const buildAiClassificationPrompt =');
const promptEnd = source.indexOf('const buildAiExtractionPrompt =', promptStart);
const classificationPrompt = source.slice(promptStart, promptEnd);
const extractionStart = source.indexOf("case 'HUNDO_DYNAMAX_SCREEN':");
const extractionEnd = source.indexOf("case 'INK_BACKGROUND_SCREEN':", extractionStart);
const extractionPrompt = source.slice(extractionStart, extractionEnd);
assert.ok(promptStart >= 0 && promptEnd > promptStart && extractionStart >= 0 && extractionEnd > extractionStart);

assert.equal(helper.HUNDO_DYNAMAX_SEARCH_FILTER, '4*&極巨化,超極巨化');
assert.equal(helper.isHundoDynamaxSearchQuery('4* & 極巨化, 超極巨化'), true);
assert.equal(helper.isHundoDynamaxSearchQuery('4*&極巨化,超極巨化&背卡'), false);
assert.match(classificationPrompt, /HUNDO_DYNAMAX_SCREEN/);
assert.match(classificationPrompt, /HUNDO_DYNAMAX_SEARCH_FILTER/);
assert.match(classificationPrompt, /實心／塗滿 X 型圖標 = 超極巨化/);
assert.match(classificationPrompt, /空心／僅輪廓 X 型圖標 = 極巨化/);
assert.match(extractionPrompt, /實心／塗滿 X 型圖標/);
assert.match(extractionPrompt, /空心／只有輪廓 X 型圖標/);
assert.match(extractionPrompt, /嚴禁依寶可夢種類/);
assert.match(extractionPrompt, /每隻寶可夢單獨確認 X 型圖標/);
assert.match(extractionPrompt, /若全部可見卡片都看不清型態或名稱，rare_list 留空/);
assert.match(extractionPrompt, /pokemon_list 及其餘欄位全部留空字串/);
assert.match(source, /HUNDO_DYNAMAX_SCREEN: \['rare_list'\]/);
assert.match(source, /HUNDO_DYNAMAX_SCREEN: 1/);
assert.match(source, /normalizeHundoDynamaxList\(result\?\.rare_list\)/);
assert.match(source, /mergeHundoDynamaxLists\(hundoDynamaxLists\)/);
assert.match(source, /RARE_LIST_IMAGE_TYPES = new Set\(\[[^\]]*'HUNDO_DYNAMAX_SCREEN'\]\)/);
assert.match(source, /const isRareVisualScan = \[[^\]]*'HUNDO_DYNAMAX_SCREEN'\]\.includes/);
assert.match(source, /\['RARE_BACKGROUND_SCREEN', 'INK_BACKGROUND_SCREEN', 'ETERNATUS_SCREEN', 'HUNDO_DYNAMAX_SCREEN', 'SHOP_COIN_SCREEN', 'ITEM_GREENPASS_SCREEN', 'RESOURCE_SCREEN'\]\.includes\(job\.classification\.image_type\)/);
assert.match(source, /mergeRareListSections\(input\.value, normalizedValue\)/);
assert.match(source, /copySimpleText\('4\*&極巨化,超極巨化', this\)[^>]*>百超極巨<\/button>/);

assert.equal(
  helper.normalizeHundoDynamaxList('百極巨：極巨化毛毛角羊,超極巨化巴大蝶,極巨化毛毛角羊'),
  '百極巨：極巨化毛毛角羊*2,超極巨化巴大蝶'
);
assert.equal(
  helper.mergeHundoDynamaxLists(['百極巨：極巨化巴大蝶', '百極巨：超極巨化巴大蝶']),
  '百極巨：極巨化巴大蝶,超極巨化巴大蝶'
);
assert.equal(
  helper.mergeRareListSections('水墨背卡：烈空坐\n稀有紫黑背卡:超極巨化妙蛙花', '百極巨：極巨化毛毛角羊'),
  '水墨背卡：烈空坐\n百極巨：極巨化毛毛角羊\n稀有紫黑背卡:超極巨化妙蛙花'
);
console.log('PASS 百極巨 AI classification, visual routing and typed list merge');
