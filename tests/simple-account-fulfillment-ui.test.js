const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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

console.log('simple-account fulfillment modal UI assertions passed');
