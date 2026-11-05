'use strict';

const assert = require('node:assert/strict');
const {
    RARE_BACKGROUND_SEARCH_FILTER,
    INK_BACKGROUND_SEARCH_FILTER,
    isRareBackgroundSearchQuery,
    isInkBackgroundSearchQuery,
    normalizeRareBackgroundList,
    mergeRareBackgroundLists,
    normalizeInkBackgroundList,
    mergeInkBackgroundLists,
    mergeRareListSections,
    HUNDO_DYNAMAX_SEARCH_FILTER,
    isHundoDynamaxSearchQuery,
    normalizeHundoDynamaxList,
    mergeHundoDynamaxLists,
    insertRarePresetAtCaret,
    removeRarePresetLine
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

assert.deepEqual(
    insertRarePresetAtCaret('稀有紫黑背卡:超極巨化妙蛙花*3', '稀有無極汰那', 0, 0),
    {
        value: '稀有無極汰那\n稀有紫黑背卡:超極巨化妙蛙花*3',
        selectionStart: 6,
        selectionEnd: 6
    }
);

assert.deepEqual(
    insertRarePresetAtCaret('第一行\n第二行', '稀有無極汰那', 4, 4),
    {
        value: '第一行\n稀有無極汰那\n第二行',
        selectionStart: 10,
        selectionEnd: 10
    }
);

assert.deepEqual(
    insertRarePresetAtCaret('第一行\n第二行', '稀有無極汰那', 0, 3),
    {
        value: '稀有無極汰那\n第二行',
        selectionStart: 6,
        selectionEnd: 6
    }
);

assert.deepEqual(
    removeRarePresetLine('稀有無極汰那\n第二行', '稀有無極汰那', 9),
    {
        value: '第二行',
        selectionStart: 2,
        selectionEnd: 2,
        removed: true
    }
);

assert.deepEqual(
    removeRarePresetLine('第一行\n稀有無極汰那', '稀有無極汰那', 4),
    {
        value: '第一行',
        selectionStart: 3,
        selectionEnd: 3,
        removed: true
    }
);

assert.equal(INK_BACKGROUND_SEARCH_FILTER, '384,888,889&特別背卡');
assert.equal(isInkBackgroundSearchQuery(' 384, 888, 889 & 特別背卡 '), true);
assert.equal(isInkBackgroundSearchQuery('384,888,889&背景'), false);
assert.equal(isInkBackgroundSearchQuery('384,888,889&特別背卡&異色'), false);

assert.equal(
    normalizeInkBackgroundList('水墨背卡：烈空坐,烈空坐,烈空坐'),
    '水墨背卡：烈空坐*3'
);
assert.equal(
    normalizeInkBackgroundList('水墨背卡：特別背卡烈空坐*2,蒼響,藏瑪然特*3'),
    '水墨背卡：烈空坐*2,蒼響,藏瑪然特*3'
);
assert.equal(
    normalizeInkBackgroundList('水墨背卡：#384,888*2,889,超夢*10'),
    '水墨背卡：烈空坐,蒼響*2,藏瑪然特'
);
assert.equal(normalizeInkBackgroundList('特別背卡超夢*3,普通烈空坐'), '');
assert.equal(normalizeInkBackgroundList('水墨背卡：烈空坐*0'), '');
assert.equal(
    mergeInkBackgroundLists(['水墨背卡：烈空坐*2,蒼響', '水墨背卡：烈空坐,藏瑪然特*2']),
    '水墨背卡：烈空坐*3,蒼響,藏瑪然特*2'
);
assert.equal(
    mergeRareListSections('稀有無極汰那\n稀有紫黑背卡:超極巨化妙蛙花*3', '水墨背卡：烈空坐*3'),
    '稀有無極汰那\n水墨背卡：烈空坐*3\n稀有紫黑背卡:超極巨化妙蛙花*3'
);
assert.equal(
    mergeRareListSections('水墨背卡：烈空坐*3\n稀有紫黑背卡:超極巨化妙蛙花', '稀有紫黑背卡:極巨化噴火龍*2'),
    '水墨背卡：烈空坐*3\n稀有紫黑背卡:極巨化噴火龍*2'
);
assert.equal(
    mergeRareListSections('稀有紫黑背卡:極巨化噴火龍\n水墨背卡：烈空坐*2', '水墨背卡：烈空坐*3'),
    '水墨背卡：烈空坐*3\n稀有紫黑背卡:極巨化噴火龍'
);

assert.equal(HUNDO_DYNAMAX_SEARCH_FILTER, '4*&極巨化,超極巨化');
assert.equal(isHundoDynamaxSearchQuery(' 4* & 極巨化, 超極巨化 '), true);
assert.equal(isHundoDynamaxSearchQuery('極巨化,超極巨化&背卡'), false);
assert.equal(isHundoDynamaxSearchQuery('4*&極巨化,超極巨化&異色'), false);
assert.equal(
    normalizeHundoDynamaxList('百極巨：極巨化毛毛角羊,超極巨化巴大蝶,極巨化毛毛角羊'),
    '百極巨：極巨化毛毛角羊*2,超極巨化巴大蝶'
);
assert.equal(
    normalizeHundoDynamaxList('百極巨：極巨化巴大蝶*2,超極巨化巴大蝶,超極巨化巴大蝶'),
    '百極巨：極巨化巴大蝶*2,超極巨化巴大蝶*2'
);
assert.equal(normalizeHundoDynamaxList('百極巨：極巨化巴大蝶*0'), '');
assert.equal(normalizeHundoDynamaxList('百極巨：無法確認型態'), '');
assert.equal(
    mergeHundoDynamaxLists(['百極巨：極巨化毛毛角羊,超極巨化巴大蝶', '百極巨：極巨化毛毛角羊,超極巨化巴大蝶*2']),
    '百極巨：極巨化毛毛角羊*2,超極巨化巴大蝶*3'
);
assert.equal(
    mergeRareListSections('稀有無極汰那\n水墨背卡：烈空坐\n稀有紫黑背卡:極巨化噴火龍', '百極巨：極巨化毛毛角羊,超極巨化巴大蝶'),
    '稀有無極汰那\n水墨背卡：烈空坐\n百極巨：極巨化毛毛角羊,超極巨化巴大蝶\n稀有紫黑背卡:極巨化噴火龍'
);
assert.equal(
    mergeRareListSections('百極巨：極巨化毛毛角羊\n稀有裝甲超夢2隻', '百極巨：超極巨化巴大蝶*2'),
    '百極巨：超極巨化巴大蝶*2\n稀有裝甲超夢2隻'
);

console.log('PASS rare background scan helper tests');
