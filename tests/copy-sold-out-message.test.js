const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expectedMessage = '不好意思老闆，這隻帳號目前已經售出了！\n\n我已經在賣場新增其他帳號，如果您還有興趣購買，歡迎到我的賣場看看有沒有其他喜歡的，謝謝您的支持與理解！';

const buttonMarkup = source.match(/<button\b[^>]*\bid="copySoldOutMessageBtn"[^>]*>[^<]*<\/button>/);
assert.ok(buttonMarkup, 'quick-entry area must offer a sold-out reply button');
assert.match(buttonMarkup[0], /onclick="window\.copySoldOutMessage\(this\)"/);
assert.match(buttonMarkup[0], /複製商品售完通知/);
assert.match(buttonMarkup[0], />📋 售完<\/button>/);
assert.ok(
  source.indexOf('id="copyStoreMessageBtn"') < source.indexOf('id="copySoldOutMessageBtn"') &&
  source.indexOf('id="copySoldOutMessageBtn"') < source.indexOf('id="submitBtn"'),
  'sold-out reply button should be next to existing quick-entry copy actions'
);

const handlerSource = source.match(/window\.copySoldOutMessage = async function\(btn\) \{[\s\S]*?\n        \};/);
assert.ok(handlerSource, 'sold-out reply handler must exist');
const messageMatch = handlerSource[0].match(/const msg = `([\s\S]*?)`;/);
assert.ok(messageMatch, 'handler must contain the complete, fixed message');
assert.equal(messageMatch[1], expectedMessage, 'copy must preserve wording and blank line exactly');

function makeScenario(clipboard, copyResult) {
  const textarea = {
    style: { display: 'none' },
    value: '',
    focus() {},
    select() { this.selected = true; }
  };
  const alerts = [];
  const timers = [];
  const context = {
    window: {},
    navigator: { clipboard },
    document: {
      getElementById(id) {
        assert.equal(id, 'hiddenCopyArea');
        return textarea;
      },
      execCommand(command) {
        assert.equal(command, 'copy');
        return copyResult;
      }
    },
    alert(message) { alerts.push(message); },
    setTimeout(callback) { timers.push(callback); }
  };
  vm.runInNewContext(handlerSource[0], context);
  return { handler: context.window.copySoldOutMessage, textarea, alerts, timers };
}

(async () => {
  let copied = '';
  const native = makeScenario({ writeText: async text => { copied = text; } }, false);
  const nativeButton = { innerHTML: '📋 售完' };
  await native.handler(nativeButton);
  assert.equal(copied, expectedMessage);
  assert.equal(nativeButton.innerHTML, '✅ 已複製');
  native.timers[0]();
  assert.equal(nativeButton.innerHTML, '📋 售完');

  const fallback = makeScenario({ writeText: async () => { throw new Error('clipboard unavailable'); } }, true);
  const fallbackButton = { innerHTML: '📋 售完' };
  await fallback.handler(fallbackButton);
  assert.equal(fallback.textarea.value, expectedMessage);
  assert.equal(fallback.textarea.selected, true);
  assert.equal(fallback.textarea.style.display, 'none');
  assert.equal(fallbackButton.innerHTML, '✅ 已複製');

  const unsupported = makeScenario(undefined, false);
  const failedButton = { innerHTML: '📋 售完' };
  await unsupported.handler(failedButton);
  assert.equal(failedButton.innerHTML, '📋 售完', 'failure must not be reported as success');
  assert.equal(unsupported.alerts.length, 1, 'failed copy must be explained');
  assert.equal(unsupported.timers.length, 0, 'failed copy must not schedule a success reset');

  console.log('Sold-out reply copy tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
