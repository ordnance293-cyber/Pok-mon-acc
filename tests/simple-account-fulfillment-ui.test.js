const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(source, /window\.showCredentialModal\s*=\s*function\s*\(account, password\)\s*\{[\s\S]*?modalAccount[\s\S]*?modalPassword[\s\S]*?copyModal[\s\S]*?\}/);
assert.match(source, /window\.showCopyModal\s*=\s*function\s*\(accountId\)\s*\{[\s\S]*?accountId\.split\(';'\)[\s\S]*?parts\[0\]\s*\?\s*parts\[0\]\.trim\(\)\s*:\s*accountId[\s\S]*?parts\[1\]\s*\?\s*parts\[1\]\.trim\(\)\s*:\s*'（無密碼）'[\s\S]*?window\.showCredentialModal\(account, password\);[\s\S]*?\}/);
assert.equal((source.match(/window\.copyModalField\('modal(?:Account|Password)', this\)/g) || []).length, 2);
assert.match(source, /window\.copyModalMessage/);
assert.match(source, /【安全改綁流程】/);
assert.doesNotMatch(source, /複製帳號密碼|copyCombinedCredential|combinedCredential/);

console.log('simple-account fulfillment modal UI assertions passed');
