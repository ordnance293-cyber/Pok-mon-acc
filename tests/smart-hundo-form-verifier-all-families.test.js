'use strict';

const assert = require('node:assert/strict');
const verifier = require('../smart-hundo-form-verifier.js');

const expectedFamilies = {
  '急凍鳥': ['articuno_standard', 'articuno_galarian'],
  '閃電鳥': ['zapdos_standard', 'zapdos_galarian'],
  '火焰鳥': ['moltres_standard', 'moltres_galarian'],
  '蒼響': ['zacian_standard', 'zacian_crowned'],
  '藏瑪然特': ['zamazenta_standard', 'zamazenta_crowned'],
  '帝牙盧卡': ['dialga_standard', 'dialga_origin'],
  '帕路奇亞': ['palkia_standard', 'palkia_origin'],
  '基格爾德': ['zygarde_10', 'zygarde_50', 'zygarde_complete'],
  '奈克洛茲瑪': ['necrozma_base', 'necrozma_dusk_mane', 'necrozma_dawn_wings'],
  '酋雷姆': ['kyurem_base', 'kyurem_white', 'kyurem_black']
};

assert.deepEqual(verifier.TARGET_HUNDO_FORM_BASE_SPECIES, Object.keys(expectedFamilies));
for (const [species, forms] of Object.entries(expectedFamilies)) {
  assert.deepEqual(verifier.VERIFIED_FORM_IDS_BY_BASE_SPECIES[species], [...forms, 'uncertain']);
}
assert.equal(Object.keys(verifier.REQUIRED_VERIFIED_FORM_EVIDENCE).length, 23);

const candidates = Array.from({ length: 13 }, (_, index) => ({
  card_id: `card-${index}`,
  screenshot_index: 4,
  base_species: Object.keys(expectedFamilies)[index % 10],
  candidate_form_ids: ['uncertain']
}));
const batches = verifier.planHundoFormVerificationBatches(candidates);
assert.deepEqual(batches.map(batch => batch.jobs.length), [6, 6, 1]);
assert.equal(batches.length, Math.ceil(candidates.length / 6));
assert.deepEqual(verifier.planHundoFormVerificationBatches([]), []);

console.log('PASS all-family form verifier and request-count contracts');
