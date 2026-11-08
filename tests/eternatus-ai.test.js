'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rare = require('../rare-bg-scan-helpers.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.equal(rare.ETERNATUS_SEARCH_FILTER, '無極汰那');
assert.equal(rare.isEternatusSearchQuery(' 無 極 汰 那 '), true);
assert.equal(rare.isEternatusSearchQuery('無極汰那&4*'), false);
assert.equal(rare.isEternatusSearchQuery('無極汰那,超夢'), false);
assert.equal(rare.isEternatusSearchQuery('無極'), false);
for (const [input, expected] of [
 ['稀有無極汰那3隻', '稀有無極汰那3隻'],
 ['無極汰那*2', '稀有無極汰那2隻'],
 ['無極汰那３隻', '稀有無極汰那3隻'],
 ['無極汰那', ''],
 ['稀有無極汰那0隻', ''],
 ['稀有無極汰那-1隻', ''],
 ['稀有無極汰那1.5隻', ''],
 ['超夢3隻', ''],
 ['稀有無極汰那9007199254740992隻', ''],
 ['我猜3隻', '']
]) assert.equal(rare.normalizeEternatusRareList(input), expected, input);
assert.equal(rare.mergeEternatusRareLists(['稀有無極汰那2隻','無極汰那*3','超夢3隻']), '稀有無極汰那5隻');
assert.equal(rare.mergeRareListSections('稀有無極汰那\n水墨背卡：烈空坐\n稀有裝甲超夢2隻','稀有無極汰那3隻'),
 '稀有無極汰那3隻\n水墨背卡：烈空坐\n稀有裝甲超夢2隻');
assert.equal(rare.mergeRareListSections('稀有無極汰那3隻\n百極巨：極巨化毛毛角羊','稀有無極汰那2隻'),
 '稀有無極汰那2隻\n百極巨：極巨化毛毛角羊');

for(const marker of [
 "'ETERNATUS_SCREEN'", "{ query: ETERNATUS_FILTER, imageType: 'ETERNATUS_SCREEN' }",
 "ETERNATUS_SCREEN: ['rare_list']", "ETERNATUS_SCREEN: 1",
 "normalizeEternatusRareList(result?.rare_list)", "mergeEternatusRareLists(eternatusLists)",
 "const ETERNATUS_FILTER =", "稀有無極汰那N隻",
 '不得直接依搜尋條件填入稀有清單', '若看不清楚',
 "window.copySimpleText('無極汰那', this)"
]) assert.ok(source.includes(marker), marker);
const classify=source.slice(source.indexOf('const buildAiClassificationPrompt ='),source.indexOf('const buildAiExtractionPrompt ='));
assert.match(classify,/若搜尋欄完全符合「\$\{ETERNATUS_FILTER\}」/);
const a=source.indexOf("case 'ETERNATUS_SCREEN':");
const b=source.indexOf("case 'RESOURCE_SCREEN':",a);
assert.ok(a>=0&&b>a);
const prompt=source.slice(a,b);
assert.match(prompt,/逐張確認寶可夢卡片本體確實是無極汰那/);
assert.match(prompt,/頂部「寶可夢 \(N\)」/);
assert.match(prompt,/rare_list 留空字串/);
assert.match(source,/RARE_LIST_IMAGE_TYPES = new Set\(\[[^\]]*'ETERNATUS_SCREEN'/);
assert.match(source,/isRareVisualScan = \[[^\]]*'ETERNATUS_SCREEN'/);
assert.match(source,/normalJobs\.map\(async job => \{[\s\S]*?'ETERNATUS_SCREEN'/);
assert.match(source,/normalized\.image_type === 'ETERNATUS_SCREEN'/);
console.log('PASS Eternatus AI screenshot route');
