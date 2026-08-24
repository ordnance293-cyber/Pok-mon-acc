const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');

const criticalIds = [
  'googleSheetId','gasUrl','openaiApiKey','saveBtn','mainPage1','mainPage2','simpleAccountPage',
  'g_id','imageInput','imagePreviewContainer','aiActionButtons','aiAutoBtn','aiAutoStatus','g_rare_list','g_hundos',
  'st_hundo_leg','st_legend','st_shiny','st_shiny_leg','st_costume','st_bg_comm','st_bg_special','st_dyna','st_giga','st_perfect',
  'st_old_poke','st_old_leg','st_masterball','st_greenpass','st_rarecandy','st_coin','st_poke_bag','st_item_bag',
  'g_level','g_team','g_xp','g_stardust','g_price','g_item_status','submitBtn','cancelEditBtn','inventoryBody',
  'inventoryCount','searchInput','filterStatus','sortMode','simpleAccountSpreadsheetId','simpleAccountGasUrl',
  'simpleAccountFulfillmentSecret','saveSimpleAccountSettingsBtn','simpleAccountPendingPanel','simpleAccountPendingDetail',
  'retrySimpleAccountFulfillmentBtn','simpleAccountFulfillmentStatus'
];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const id of criticalIds) {
  const matches = html.match(new RegExp(`\\bid=["']${escape(id)}["']`, 'g')) || [];
  assert.strictEqual(matches.length, 1, `${id} must exist exactly once`);
}

const quickBuild = html.slice(html.indexOf('<div id="mainPage1"'), html.indexOf('<div id="mainPage2"'));
assert.ok(!quickBuild.includes('<details'), 'Quick Build sections must not use collapsed details elements');
for (const sectionId of ['quickResourceSection', 'quickAiSection', 'quickResearchSection', 'quickFusionSection', 'quickListingSection']) {
  assert.match(quickBuild, new RegExp(`<section id="${sectionId}"`), `${sectionId} must remain in the normal Quick Build flow`);
}
const resourceIds = ['st_old_poke','st_old_leg','st_masterball','st_greenpass','st_rarecandy','st_coin','st_poke_bag','st_item_bag'];
const aiMetricIds = ['st_hundo_leg','st_legend','st_shiny','st_shiny_leg','st_costume','st_bg_comm','st_bg_special','st_dyna','st_giga','st_perfect'];
for (const id of [...resourceIds, ...aiMetricIds]) {
  assert.strictEqual((quickBuild.match(new RegExp(`\\bid="${id}"`, 'g')) || []).length, 1, `${id} must appear once in Quick Build`);
}
const specialResearchValues = ['色違美洛耶塔','色違夢幻','凱路迪歐','至尊鳳王','至尊洛奇亞','瑪夏多','色違基拉祈','色違謝米','波爾凱尼恩','薩戮德','凱路迪歐,瑪夏多','捷拉奧拉','色違蒂安希','蒂安希','色違凱路迪歐'];
specialResearchValues.forEach((value, index) => assert.match(quickBuild, new RegExp(`id="chk_sp_${index + 1}" value="${value}"`)));
for (const id of ['sel_kyurem','sel_dogs','sel_necrozma','sel_mewtwo','sel_lati','sel_hoenn']) {
  assert.match(quickBuild, new RegExp(`id="${id}"`), `${id} must remain in the visible Fusion/Mega section`);
}
assert.match(html, /class="app-sidebar/);
assert.match(html, /id="systemSettingsPanel"/);
assert.match(html, /id="mainPage2"[^>]*app-page hidden/);
assert.match(html, /id="simpleAccountPage"[^>]*app-page hidden/);
assert.match(html, /window\.togglePage\s*=\s*function/);
assert.match(html, /id="aiAutoBtn"[^>]+onclick="autoScan\(\)"/);
for (const product of ['1百神','2百神','3百神','無極汰那','Mega烈空坐']) {
  assert.match(html, new RegExp(`data-simple-account-product="${product}"[^>]+onclick="window\\.fulfillSimpleAccount\\('${product}', this\\)"`));
}
assert.match(html, /id="openaiApiKey"[^>]*type="password"|type="password"[^>]*id="openaiApiKey"/);
assert.match(html, /id="simpleAccountFulfillmentSecret"[^>]*type="password"|type="password"[^>]*id="simpleAccountFulfillmentSecret"/);
for (const helper of ['smart-hundo-helpers.js','smart-hundo-form-verifier.js','trainer-team-helpers.js','sold-account-cleanup.js','simple-account-fulfillment-helpers.js']) assert.ok(html.includes(`src="${helper}"`));
console.log('admin dashboard DOM contract tests passed');
