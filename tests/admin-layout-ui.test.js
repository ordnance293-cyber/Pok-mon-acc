const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

const occurrenceCount = (pattern) => (markup.match(pattern) || []).length;
const elementWithId = (id) => markup.match(new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i'));
const detailsContaining = (id) => {
  const blocks = [...markup.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi)];
  return blocks.find(([, , body]) => new RegExp(`\\bid=["']${id}["']`).test(body));
};

const criticalIds = [
  'mainPage1', 'mainPage2', 'simpleAccountPage', 'googleSheetId', 'gasUrl',
  'openaiApiKey', 'saveBtn', 'simpleAccountSpreadsheetId', 'simpleAccountGasUrl',
  'simpleAccountFulfillmentSecret', 'saveSimpleAccountSettingsBtn', 'g_id',
  'imageInput', 'aiAutoBtn', 'aiAutoStatus', 'st_poke_bag', 'st_item_bag',
  'pokeInputForm', 'submitBtn', 'inventoryCount', 'searchInput', 'filterStatus',
  'sortMode', 'inventoryBody'
];

criticalIds.forEach((id) => {
  assert(elementWithId(id), `missing critical element #${id}`);
  assert.strictEqual(occurrenceCount(new RegExp(`\\bid=["']${id}["']`, 'g')), 1, `#${id} must occur exactly once`);
});

const globalSettings = detailsContaining('googleSheetId');
assert(globalSettings, 'global settings must be in a details disclosure');
assert(!/\bopen(?:\s|=|>)/i.test(globalSettings[1]), 'global settings must be collapsed by default');
['gasUrl', 'openaiApiKey', 'saveBtn'].forEach((id) => assert(new RegExp(`\\bid=["']${id}["']`).test(globalSettings[2])));
assert(/<summary\b[^>]*aria-controls=["']globalSettingsPanel["']/i.test(globalSettings[0]), 'global settings summary must identify its panel');

const simpleSettings = detailsContaining('simpleAccountSpreadsheetId');
assert(simpleSettings, 'simple-account settings must be in a separate details disclosure');
assert(!/\bopen(?:\s|=|>)/i.test(simpleSettings[1]), 'simple-account settings must be collapsed by default');
['simpleAccountGasUrl', 'simpleAccountFulfillmentSecret', 'saveSimpleAccountSettingsBtn'].forEach((id) => assert(new RegExp(`\\bid=["']${id}["']`).test(simpleSettings[2])));

const nav = markup.match(/<nav\b[^>]*data-dashboard-navigation[^>]*>([\s\S]*?)<\/nav>/i);
assert(nav, 'shared dashboard navigation is required');
[1, 2, 3].forEach((page) => assert(new RegExp(`window\\.togglePage\\(${page}\\)`).test(nav[1]), `navigation missing page ${page}`));

const products = [...markup.matchAll(/data-simple-account-product=["']([^"']+)["']/g)].map((match) => match[1]);
assert.deepStrictEqual(products, ['1百神', '2百神', '3百神', '無極汰那', 'Mega烈空坐']);
products.forEach((product) => assert(html.includes(`window.fulfillSimpleAccount('${product}', this)`), `${product} fulfillment handler changed`));

assert(/id=["']g_id["'][^>]*oninput=["'][^"']*replace\(\/\\s\+\/g,\s*';'\)/.test(markup), 'account whitespace normalization changed');
assert(/id=["']pokeInputForm["']/.test(markup) && /id=["']submitBtn["'][^>]*onclick=["']saveAccountToInventory\(\)/.test(markup), 'normal save path disconnected');
assert(/data-dashboard-workspace/.test(markup), 'responsive dashboard workspace is required');
assert(/data-resource-section/.test(markup), 'resource workspace section is required');
assert(/data-ai-section/.test(markup), 'AI workspace section is required');

['smart-hundo-helpers.js', 'smart-hundo-form-verifier.js', 'trainer-team-helpers.js', 'sold-account-cleanup.js', 'simple-account-fulfillment-helpers.js']
  .forEach((script) => assert(new RegExp(`<script[^>]+src=["']${script.replace('.', '\\.')}["']`).test(html), `${script} was removed`));

console.log('admin layout UI contracts passed');
