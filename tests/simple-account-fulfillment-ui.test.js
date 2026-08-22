const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperSource = fs.readFileSync(path.join(__dirname, '..', 'simple-account-fulfillment-helpers.js'), 'utf8');

const showCredentialModal = source.match(
  /window\.showCredentialModal\s*=\s*function\s*\(account, password\)\s*\{[\s\S]*?\n\s*\};/
);
assert.ok(showCredentialModal, 'shared credential modal helper must exist');
assert.match(showCredentialModal[0], /document\.getElementById\('modalAccount'\)\.value\s*=\s*account\s*;/);
assert.match(showCredentialModal[0], /document\.getElementById\('modalPassword'\)\.value\s*=\s*password\s*;/);
assert.match(showCredentialModal[0], /document\.getElementById\('copyModal'\)\.classList\.remove\('hidden'\)\s*;/);
assert.match(source, /window\.showCopyModal\s*=\s*function\s*\(accountId\)\s*\{[\s\S]*?accountId\.split\(';'\)[\s\S]*?parts\[0\]\s*\?\s*parts\[0\]\.trim\(\)\s*:\s*accountId[\s\S]*?parts\[1\]\s*\?\s*parts\[1\]\.trim\(\)\s*:\s*'（無密碼）'[\s\S]*?window\.showCredentialModal\(account, password\);[\s\S]*?\}/);

const copyModalMarkup = source.slice(source.indexOf('<div id="copyModal"'), source.indexOf('</body>'));
assert.ok(copyModalMarkup.startsWith('<div id="copyModal"'), 'credential modal markup must exist');
assert.deepEqual(
  Array.from(copyModalMarkup.matchAll(/window\.copyModalField\('([^']+)', this\)/g), (match) => match[1]),
  ['modalAccount', 'modalPassword'],
  'the modal must expose only separate account and password copy controls'
);
for (const button of copyModalMarkup.match(/<button\b[\s\S]*?<\/button>/g) || []) {
  const visibleText = button.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  assert.ok(
    !(visibleText.includes('複製') && visibleText.includes('帳號') && visibleText.includes('密碼')),
    'the modal must not contain a combined account-and-password copy button'
  );
  assert.doesNotMatch(
    button,
    /onclick\s*=\s*"[^"]*modalAccount[^"]*modalPassword|onclick\s*=\s*"[^"]*modalPassword[^"]*modalAccount/,
    'one modal control must not copy both credential fields'
  );
}
assert.match(source, /window\.copyModalMessage/);
assert.match(source, /【安全改綁流程】/);
assert.doesNotMatch(source, /(?:copy|複製)[A-Za-z_$]*(?:combined|both|all)[A-Za-z_$]*(?:credential|account|password)/i);

assert.match(source, /<script\s+src=["']simple-account-fulfillment-helpers\.js["']/);
for (const [id, label] of [
  ['simpleAccountSpreadsheetId', '簡帳試算表 ID'],
  ['simpleAccountGasUrl', '簡帳出貨 Apps Script 網址'],
  ['simpleAccountFulfillmentSecret', '簡帳出貨密鑰']
]) {
  assert.match(source, new RegExp(`<label[^>]+for=["']${id}["'][^>]*>[\\s\\S]*?${label}`));
  assert.match(source, new RegExp(`<input[^>]+id=["']${id}["']`));
  assert.match(source, new RegExp(`elementId:\\s*["']${id}["'][\\s\\S]*?storageKey:\\s*["']${id}["']`));
}
const secretInput = source.match(/<input\b[^>]*\bid=["']simpleAccountFulfillmentSecret["'][^>]*>/);
assert.ok(secretInput, 'simple-account secret input must exist');
assert.match(secretInput[0], /\btype=["']password["']/);
assert.match(source, /💾 儲存簡帳設定/);
assert.match(source, /window\.saveSimpleAccountSettings\s*=\s*function/);
assert.match(source, /DOMContentLoaded[\s\S]*simpleAccountSpreadsheetId/);

assert.match(source, /id=["']simpleAccountPage["']/);
assert.match(source, /簡帳自動出貨/);
assert.ok((source.match(/togglePage\(3\)/g) || []).length >= 2, 'page 1 and page 2 must link to simple-account page');
assert.match(source, /togglePage\(1\)[\s\S]*返回建檔區/);
assert.match(source, /pageNumber\s*===\s*3/);

const expectedProducts = ['1百神', '2百神', '3百神', '無極汰那', 'Mega烈空坐'];
const saleControls = Array.from(source.matchAll(/<button\b[^>]*data-simple-account-product=["']([^"']+)["'][^>]*>[\s\S]*?<\/button>/g), match => ({
  product: match[1],
  markup: match[0]
}));
assert.deepEqual(saleControls.map(control => control.product), expectedProducts, 'exactly five fixed simple-account controls must exist');
for (const control of saleControls) assert.match(control.markup, new RegExp(control.product));
assert.doesNotMatch(source, /data-simple-account-product=["'](?:全部價格|高預算帳號)["']/);
assert.match(source, /確定要售出「\$\{product\}」並取得 1 組帳號嗎？/);

const fulfillmentFunction = source.match(/window\.fulfillSimpleAccount\s*=\s*async function\s*\(product(?:,\s*button)?\)[\s\S]*?\n\s*\};/);
assert.ok(fulfillmentFunction, 'simple-account fulfillment request function must exist');
const fulfillmentSource = fulfillmentFunction[0];
const dispatchStart = source.indexOf('        async function dispatchSimpleAccountFulfillment(');
const dispatchEnd = source.indexOf('        window.fulfillSimpleAccount = async function', dispatchStart);
assert.ok(dispatchStart >= 0 && dispatchEnd > dispatchStart, 'simple-account dispatch function must have a bounded source span');
const dispatchSource = source.slice(dispatchStart, dispatchEnd);
assert.match(dispatchSource, /\n\s*\}\s*$/);
assert.doesNotMatch(dispatchSource, /window\.fulfillSimpleAccount\s*=\s*async function/);
const busyStart = source.indexOf('        function setSimpleAccountButtonsBusy(');
const busyEnd = source.indexOf('        function readSimpleAccountSettings', busyStart);
assert.ok(busyStart >= 0 && busyEnd > busyStart, 'simple-account busy helper must have a bounded source span');
const busySource = source.slice(busyStart, busyEnd);
assert.match(busySource, /\n\s*\}\s*$/);
assert.doesNotMatch(busySource, /function readSimpleAccountSettings/);
assert.match(fulfillmentSource, /setSimpleAccountPending\(pending\)[\s\S]*dispatchSimpleAccountFulfillment/);
assert.match(dispatchSource, /setSimpleAccountButtonsBusy\(selectedButton,\s*true\)/);
assert.match(busySource, /button\.disabled\s*=\s*busy/);
assert.match(busySource, /textContent\s*=\s*busy[\s\S]*["']出貨中["']/);
assert.match(dispatchSource, /method:\s*["']POST["']/);
assert.match(dispatchSource, /["']Content-Type["']\s*:\s*["']text\/plain;charset=UTF-8["']/);
assert.match(dispatchSource, /cache:\s*["']no-store["']/);
assert.doesNotMatch(dispatchSource, /mode:\s*["']no-cors["']/);
assert.match(dispatchSource, /window\.showCredentialModal\(responseBody\.account,\s*responseBody\.password\)/);
assert.match(dispatchSource, /helpers\.buildRequestPayload\(settings,\s*pending\.product,\s*pending\.requestId\)/);
const modalAssignmentIndex = dispatchSource.indexOf('window.showCredentialModal(responseBody.account, responseBody.password)');
const clearPendingIndex = dispatchSource.indexOf('clearSimpleAccountPending()');
assert.ok(modalAssignmentIndex >= 0 && clearPendingIndex > modalAssignmentIndex, 'credentials must be written before pending state is cleared');
const replayInstructionIndex = dispatchSource.indexOf('const instruction = `請立即查閱「簡帳出貨紀錄」');
const replayClearIndex = dispatchSource.indexOf('clearSimpleAccountPending()', replayInstructionIndex);
assert.ok(replayInstructionIndex >= 0 && replayClearIndex > replayInstructionIndex, 'REPLAY_UNAVAILABLE instruction must precede pending cleanup');
assert.match(fulfillmentSource, /上次出貨結果尚未確認/);
assert.match(dispatchSource, /簡帳出貨紀錄/);
const pendingProductCheckIndex = fulfillmentSource.indexOf('helpers.pendingBlocksProduct(existingPending, product)');
const differentProductBlockIndex = fulfillmentSource.indexOf('不能改售其他商品');
assert.ok(pendingProductCheckIndex >= 0 && differentProductBlockIndex > pendingProductCheckIndex, 'pending product check must precede different-product blocking');
assert.match(fulfillmentSource, /if \(helpers\.pendingBlocksProduct\(existingPending,\s*product\)\) \{[\s\S]*?不能改售其他商品/);
const retryStart = source.indexOf('        window.retrySimpleAccountFulfillment = async function');
const retryEnd = source.indexOf('        window.showCopyModal = function', retryStart);
assert.ok(retryStart >= 0 && retryEnd > retryStart, 'simple-account retry function must have a bounded source span');
const retrySource = source.slice(retryStart, retryEnd);
assert.match(retrySource, /const pending\s*=\s*getSimpleAccountPending\(\)/);
assert.match(retrySource, /dispatchSimpleAccountFulfillment\(pending,\s*selectedButton\)/);
assert.doesNotMatch(retrySource, /createRequestId/);
assert.match(source, /pending.*requestId|requestId.*pending/s);

assert.match(source, /function setSimpleAccountPending\(pending\)[\s\S]*localStorage\.setItem\([\s\S]*PENDING_STORAGE_KEY/);

for (const code of [
  'INVALID_REQUEST', 'UNAUTHORIZED', 'CONFIG_MISMATCH', 'SHEET_NOT_FOUND', 'OUT_OF_STOCK', 'BUSY'
]) assert.match(helperSource, new RegExp(`['"]${code}['"]`));
assert.match(dispatchSource, /if \(result\.clearPending\) clearSimpleAccountPending\(\);/);
assert.match(dispatchSource, /else window\.refreshSimpleAccountPendingState\(\);/);
assert.match(dispatchSource, /const responseText = await response\.text\(\);/);
assert.match(dispatchSource, /responseBody = JSON\.parse\(responseText\);/);
assert.match(dispatchSource, /throw new Error\(['"]UNREADABLE_RESPONSE['"]\)/);
assert.match(dispatchSource, /const result = helpers\.classifyNetworkFailure\(\);/);
const networkCatch = dispatchSource.match(/\}\s*catch \(error\) \{\s*const result = helpers\.classifyNetworkFailure\(\);[\s\S]*?\n\s*\} finally/);
assert.ok(networkCatch, 'network and unreadable-response path must be bounded');
assert.match(networkCatch[0], /window\.refreshSimpleAccountPendingState\(\);/);
assert.doesNotMatch(networkCatch[0], /clearSimpleAccountPending/);
assert.match(helperSource, /UNKNOWN_OUTCOME/);
assert.match(helperSource, /classifyNetworkFailure/);

for (const [id, key] of [
  ['googleSheetId', 'googleSheetId'],
  ['gasUrl', 'gasUrl'],
  ['openaiApiKey', 'OPENAI_API_KEY']
]) {
  assert.match(source, new RegExp(`elementId:\\s*["']${id}["']`));
  assert.match(source, new RegExp(`storageKey:\\s*["']${key}["']`));
}

const deploymentReadme = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'simple-account-fulfillment', 'README.md'), 'utf8');
for (const requiredText of [
  'completely separate Apps Script project',
  'SIMPLE_ACCOUNT_SPREADSHEET_ID',
  'SIMPLE_ACCOUNT_FULFILLMENT_SECRET',
  'Execute as:',
  'Who has access:',
  'Anyone',
  '簡帳出貨紀錄',
  'new deployment version',
  'REPLAY_UNAVAILABLE',
  'real GitHub Pages origin',
  'no password'
]) assert.match(deploymentReadme, new RegExp(requiredText === 'completely separate Apps Script project' ? 'completely separate (?:Google )?Apps Script project' : requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

const manualAcceptance = fs.readFileSync(path.join(__dirname, '..', 'docs', 'manual-tests', 'simple-account-auto-fulfillment.md'), 'utf8');
assert.match(manualAcceptance, /duplicate\/test spreadsheet/);
assert.match(manualAcceptance, /(?:actual|real) GitHub Pages origin/);
for (const product of expectedProducts) assert.match(manualAcceptance, new RegExp(product));
assert.match(manualAcceptance, /全部價格/);
assert.match(manualAcceptance, /高預算帳號/);
assert.match(manualAcceptance, /Firebase/);

console.log('simple-account fulfillment modal UI assertions passed');
