'use strict';

const assert = require('assert');
const fs = require('fs');
const { parseHundoListCount, synchronizeHundoCount } = require('../hundo-list-count.js');

const valid = (text, total) => assert.deepStrictEqual(parseHundoListCount(text), { valid: true, total, issues: [] });
const invalid = text => {
    const result = parseHundoListCount(text);
    assert.strictEqual(result.valid, false, text);
    assert.strictEqual(result.total, null, text);
    assert.ok(result.issues[0].message, text);
};

valid('蓋歐卡,超夢,雷公', 3);
valid('蓋歐卡*2,超夢,雷公*3', 6);
valid('蓋歐卡＊２， 超夢 × ３', 5);
valid('蓋歐卡\n超夢\r\n雷公', 3);
valid(',,，\n', 0);
valid('蓋歐卡,蓋歐卡,超夢', 3);
valid('特別背卡超夢,奈克洛茲瑪（拂曉之翼）,待確認（CP2387）,基格爾德（50%形態）', 4);
[
    '蓋歐卡*', '蓋歐卡*abc', '蓋歐卡*0', '蓋歐卡*-2', '蓋歐卡*2.5',
    '蓋歐卡*2e3', '蓋歐卡*2*3', '*2', '蓋歐卡*9007199254740992',
    '蓋歐卡*9007199254740991,超夢'
].forEach(invalid);

const classList = { toggle() {} };
const listInput = { value: '蓋歐卡*2,超夢,雷公*3', classList, setAttribute(name, value) { this[name] = value; } };
const countInput = { value: '99' };
const messageElement = {};
synchronizeHundoCount({ listInput, countInput, evidence: { count: 7 }, messageElement });
assert.strictEqual(countInput.value, '6', 'the updater ignores a tampered displayed count');
assert.match(messageElement.textContent, /截圖總數 7，清單合計 6/);
listInput.value = '蓋歐卡*3,超夢,雷公*3';
synchronizeHundoCount({ listInput, countInput, evidence: { count: 7 }, messageElement });
assert.strictEqual(countInput.value, '7');
assert.strictEqual(messageElement.textContent, '');
listInput.value = '蓋歐卡*';
synchronizeHundoCount({ listInput, countInput, messageElement });
assert.strictEqual(countInput.value, '', 'invalid syntax cannot leave a stale valid total');
assert.match(messageElement.textContent, /數量格式/);

const production = fs.readFileSync(require.resolve('../index.html'), 'utf8');
assert.match(production, /id="st_hundo_leg" readonly/, 'the derived count remains serializable but cannot be edited');
assert.doesNotMatch(production, /id="g_hundos"[^>]*oninput=/, 'the list has one JavaScript event hookup');
assert.match(production, /st_hundo_leg: String\(parsedHundos\.total\)/, 'save payload uses the parser result, not the DOM count');
assert.match(production, /if \(field === 'hundo_leg'\) return;/, 'screenshot extraction cannot write the derived field');
assert.match(production, /currentHundoScreenshotEvidence = \{/, 'screenshot evidence has separate current-form state');
assert.ok(production.indexOf('parseHundoListCount(listInput.value)') < production.indexOf('normalizePokemonList(listInput.value)'), 'validation happens before normalization');

console.log('hundo-list-count tests passed');
