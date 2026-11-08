'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const searchSection = source.split('<span class="text-[10px] font-bold text-gray-400 mr-1">搜尋</span>')[1]?.split('</div>')[0];
assert.ok(searchSection, 'search shortcut section must exist');

const button = /<button type="button" id="hundoDynamaxSearchButton" onclick="window\.copySimpleText\('4\*&極巨化,超極巨化', this\)"[^>]*>百極巨<\/button>/g;
assert.equal([...searchSection.matchAll(button)].length, 1, '百極巨 button must appear exactly once and copy the exact query');
assert.ok(
  searchSection.indexOf('>百神</button>') >= 0
    && searchSection.indexOf('>百神</button>') < searchSection.indexOf('id="hundoDynamaxSearchButton"'),
  '百極巨 button should be visible beside 百神 in the 搜尋 shortcuts'
);
assert.match(searchSection, /id="hundoDynamaxSearchButton"[^>]*aria-label="複製百極巨搜尋指令"/);
const eternatus = /<button type="button" id="eternatusSearchButton" onclick="window\.copySimpleText\('無極汰那', this\)"[^>]*>無極汰那<\/button>/g;
assert.equal([...searchSection.matchAll(eternatus)].length, 1, '無極汰那 button must appear exactly once and copy its exact name');
assert.ok(
  searchSection.indexOf('id="hundoDynamaxSearchButton"') < searchSection.indexOf('id="eternatusSearchButton"')
    && searchSection.indexOf('id="eternatusSearchButton"') < searchSection.indexOf('>色神</button>'),
  '無極汰那 button must appear in the existing search shortcut row'
);
assert.match(searchSection, /id="eternatusSearchButton"[^>]*aria-label="複製無極汰那搜尋指令"/);
console.log('PASS 無極汰那 search shortcut');

console.log('PASS 百極巨 search shortcut');
