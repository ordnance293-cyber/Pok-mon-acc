const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const settings = [
    {
        id: 'googleSheetId',
        label: 'Google 試算表 ID',
        help: '帳號資料同步到哪一份試算表'
    },
    {
        id: 'gasUrl',
        label: 'Apps Script 同步網址',
        help: '負責新增、售出、刪除與同步'
    },
    {
        id: 'openaiApiKey',
        label: 'OpenAI API Key',
        help: '提供網站內 AI 圖片辨識'
    }
];

for (const { id, label, help } of settings) {
    const inputPattern = new RegExp(`<input[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`);
    assert.match(html, inputPattern, `${id} input must remain present`);

    const labelPattern = new RegExp(
        `<label[^>]*\\bfor=["']${escapeRegExp(id)}["'][^>]*>[\\s\\S]*?${escapeRegExp(label)}[\\s\\S]*?<\\/label>`
    );
    assert.match(
        html,
        labelPattern,
        `${id} must have a persistent visible label; placeholder text alone is not enough`
    );

    assert.ok(
        html.includes(help),
        `${id} must include a short explanation of what the setting controls`
    );
}

assert.match(
    html,
    /aria-label=["']系統連線設定["']/,
    'settings controls must be grouped as 系統連線設定'
);
assert.match(
    html,
    /<details(?![^>]*\bopen\b)[^>]*aria-label=["']系統連線設定["'][^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?⚙️ 系統設定[\s\S]*?<\/summary>/,
    'global settings must be collapsed by default behind the system settings control'
);
assert.match(
    html,
    /id=["']saveBtn["'][^>]*>[\s\S]*?儲存以上設定[\s\S]*?<\/button>/,
    'save button must make it clear that it saves the settings above'
);

console.log('settings label regression tests passed');
