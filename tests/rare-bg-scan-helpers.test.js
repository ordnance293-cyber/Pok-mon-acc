'use strict';

const assert = require('node:assert/strict');
const {
    RARE_BACKGROUND_SEARCH_FILTER,
    isRareBackgroundSearchQuery,
    normalizeRareBackgroundList,
    mergeRareBackgroundLists
} = require('../rare-bg-scan-helpers.js');

assert.equal(RARE_BACKGROUND_SEARCH_FILTER, '極巨化,超極巨化&背卡');
assert.equal(isRareBackgroundSearchQuery('極巨化,超極巨化&背卡'), true);
assert.equal(isRareBackgroundSearchQuery('極巨化,超極巨化'), false);

assert.equal(
    normalizeRareBackgroundList(
        '稀有紫黑背卡:超極巨化千面避役,超極巨化巨鉗蟹,超極巨化妙蛙花,超極巨化妙蛙花,超極巨化妙蛙花,超極巨化顫弦蠑螈'
    ),
    '稀有紫黑背卡:超極巨化千面避役,超極巨化巨鉗蟹,超極巨化妙蛙花*3,超極巨化顫弦蠑螈'
);

assert.equal(
    normalizeRareBackgroundList('極巨化噴火龍*2,超極巨化妙蛙花*3,極巨化噴火龍'),
    '稀有紫黑背卡:極巨化噴火龍*3,超極巨化妙蛙花*3'
);

assert.equal(
    normalizeRareBackgroundList('稀有紫黑背卡:極巨化噴火龍,超極巨化妙蛙花*1'),
    '稀有紫黑背卡:極巨化噴火龍,超極巨化妙蛙花'
);

assert.equal(
    mergeRareBackgroundLists([
        '稀有紫黑背卡:超極巨化妙蛙花*2,極巨化噴火龍',
        '稀有紫黑背卡:超極巨化妙蛙花,極巨化水箭龜*2'
    ]),
    '稀有紫黑背卡:超極巨化妙蛙花*3,極巨化噴火龍,極巨化水箭龜*2'
);

console.log('PASS rare background scan helper tests');
