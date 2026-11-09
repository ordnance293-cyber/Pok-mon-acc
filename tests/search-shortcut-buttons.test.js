'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const searchSection = source.split('<span class="text-[10px] font-bold text-gray-400 mr-1">搜尋</span>')[1]?.split('</div>')[0];
assert.ok(searchSection, 'search shortcut section must exist');

const shortcuts = [
  ['無極汰那', '無極汰那'],
  ['神獸', '傳說的寶可夢,幻,究極異獸'],
  ['百神', '傳說的寶可夢,幻,究極異獸&4*'],
  ['百超極巨', '4*&極巨化,超極巨化'],
  ['色神', '傳說的寶可夢,幻,究極異獸&異色'],
  ['裝甲超夢', '特殊&傳說的寶可夢,幻,究極異獸'],
  ['背卡', '極巨化,超極巨化&背卡'],
  ['水墨背卡', '384,888,889&特別背卡'],
  ['16–20', '年16-20'],
  ['16–20神', '年16-20&傳說的寶可夢,幻,究極異獸']
];

const buttons = [...searchSection.matchAll(/<button\b[^>]*>[^<]*<\/button>/g)].map(match => match[0]);
assert.equal(buttons.length, shortcuts.length, 'search buttons must not be added or removed');
assert.deepEqual(
  buttons.map(button => button.match(/>([^<]+)<\/button>$/)?.[1]),
  shortcuts.map(([label]) => label),
  'search shortcut buttons should appear in the requested order'
);
for (let i = 0; i < shortcuts.length; i++) {
  const [label, query] = shortcuts[i];
  assert.ok(buttons[i].includes(`window.copySimpleText('${query}', this)`), `${label} should preserve its search query`);
}
assert.match(buttons[0], /id="eternatusSearchButton"[^>]*aria-label="複製無極汰那搜尋指令"/);
assert.match(buttons[3], /id="hundoDynamaxSearchButton"[^>]*aria-label="複製百超極巨搜尋指令"/);
assert.match(buttons[7], /id="inkBackgroundSearchButton"[^>]*aria-label="複製水墨背卡搜尋指令"/);
console.log('PASS search shortcut order, button labels, and unchanged queries');
