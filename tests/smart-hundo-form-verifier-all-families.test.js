'use strict';

const assert = require('node:assert/strict');
const verifier = require('../smart-hundo-form-verifier.js');
const helpers = require('../smart-hundo-helpers.js');

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

const bbox = {
  card_bbox: { x_min: 0, y_min: 0, x_max: 1000, y_max: 1000 },
  pokemon_bbox: { x_min: 180, y_min: 150, x_max: 820, y_max: 850 },
  bbox_confidence: .99,
  bbox_visibility: 'clear'
};
const zamazenta = overrides => ({
  card_id: '0:1:1:1', screenshot_index: 0, order: 1, row: 1, column: 1, cp: '3282',
  base_species: '藏瑪然特', recognition_status: 'recognized', species_confidence: .99,
  form_id: 'uncertain', effective_form_id: 'uncertain', form_confidence: .2,
  canonical_official_name: '', manual_review_reasons: ['form_uncertain'],
  effective_shiny_state: 'no', effective_lucky_state: 'yes', effective_favorite_state: 'yes',
  effective_rocket_state: 'normal', effective_background_type: 'none', ...bbox, ...overrides
});
const resolved = zamazenta({
  form_id: 'zamazenta_standard', effective_form_id: 'zamazenta_standard',
  canonical_official_name: '藏瑪然特', manual_review_reasons: []
});
const resolvedPlan = verifier.planTargetHundoFormCandidates([resolved]);
assert.equal(resolvedPlan.target_candidate_count, 0);
assert.deepEqual(resolvedPlan.cards[0], resolved);

const unresolvedPlan = verifier.planTargetHundoFormCandidates([zamazenta()]);
assert.equal(unresolvedPlan.target_candidate_count, 1);
assert.deepEqual(unresolvedPlan.candidates[0].candidate_form_ids, ['zamazenta_standard', 'zamazenta_crowned', 'uncertain']);
const job = verifier.planHundoFormVerificationBatches(unresolvedPlan.candidates)[0].jobs[0];
const evidenceResult = (formId, overrides = {}) => {
  const evidence = verifier.REQUIRED_VERIFIED_FORM_EVIDENCE[formId];
  return { tile_id: job.tile_id, card_id: job.card_id, base_species: job.base_species,
    verified_form_id: formId, verification_confidence: .97, crop_visibility: 'clear',
    body_plan: evidence.body_plan, limb_layout: evidence.limb_layout, fusion_host: evidence.fusion_host,
    decisive_feature: evidence.decisive_feature, key_features_visible: true, ...overrides };
};
const merge = resultCard => {
  const result = { cards: [resultCard] };
  const structure = verifier.validateHundoFormVerifierStructure(result, [job], 'stop');
  return verifier.mergeHundoFormVerificationResults(unresolvedPlan.cards, [job], result, structure, helpers.HUNDO_FORM_CANONICAL_NAMES)[0];
};
const standard = merge(evidenceResult('zamazenta_standard'));
assert.equal(standard.effective_form_id, 'zamazenta_standard');
assert.equal(standard.canonical_official_name, '藏瑪然特');
assert.equal(helpers.smartHundoCardsToPokemonList([standard]).pokemon_list, '藏瑪然特');
for (const field of ['cp', 'base_species', 'card_id', 'order', 'effective_shiny_state', 'effective_lucky_state',
  'effective_favorite_state', 'effective_rocket_state', 'effective_background_type']) {
  assert.equal(standard[field], zamazenta()[field], `form-only merge preserves ${field}`);
}
const uncertain = merge(evidenceResult('zamazenta_standard', { verification_confidence: .5 }));
assert.equal(uncertain.effective_form_id, 'uncertain');
assert.equal(helpers.smartHundoCardsToPokemonList([uncertain]).pokemon_list, '待確認（CP3282）');
assert.equal(helpers.smartHundoCardsToPokemonList([
  merge(evidenceResult('zamazenta_standard', { key_features_visible: false, crop_visibility: 'cropped' }))
]).pokemon_list, '待確認（CP3282）');
assert.equal(merge(evidenceResult('zamazenta_crowned')).canonical_official_name, '藏瑪然特劍盾型態');

for (const [species, forms] of Object.entries(expectedFamilies)) {
  for (const formId of forms) {
    const evidence = verifier.REQUIRED_VERIFIED_FORM_EVIDENCE[formId];
    assert.ok(evidence.visual_rule.includes(species), `${formId} has an explicit family visual rule`);
    const diagnostics = helpers.shapeSmartHundoDiagnostics({ screenshots: [{ index: 0, cards: [{
      ...zamazenta({ base_species: species }), stage2_candidate_form_ids: [...forms, 'uncertain'],
      verified_form_id: formId, verification_confidence: .97,
      verification_evidence: { crop_visibility: 'clear', body_plan: evidence.body_plan,
        limb_layout: evidence.limb_layout, fusion_host: evidence.fusion_host,
        decisive_feature: evidence.decisive_feature, key_features_visible: true }, verification_status: 'verified'
    }] }] });
    const safe = diagnostics.screenshots[0].cards[0];
    assert.equal(safe.verified_form_id, formId);
    assert.equal(safe.verification_evidence.decisive_feature, evidence.decisive_feature);
    assert.deepEqual(safe.stage2_candidate_form_ids, [...forms, 'uncertain']);
  }
}

const mixed = [...Array.from({ length: 7 }, (_, i) => zamazenta({ card_id: `u-${i}`, order: i + 1 })), resolved];
const mixedPlan = verifier.planTargetHundoFormCandidates(mixed);
assert.equal(mixedPlan.target_candidate_count, 7);
assert.equal(verifier.planHundoFormVerificationBatches(mixedPlan.candidates).length, 2);

console.log('PASS all-family form verifier and request-count contracts');
