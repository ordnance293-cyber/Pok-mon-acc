'use strict';
const assert = require('node:assert/strict');
const helpers = require('../smart-hundo-helpers.js');
const verifier = require('../smart-hundo-form-verifier.js');

const clearBackground = (badge_type, appearance, present = true) => ({
  present, region_visibility: 'clear', position: present ? 'lower_right' : 'none', badge_type, appearance
});
for (const appearance of ['uncertain', 'other', 'none']) {
  assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('commemorative_location_badge', appearance)), 'uncertain');
  assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('special_background_badge', appearance)), 'uncertain');
}
assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('commemorative_location_badge', 'location_style_background')), 'commemorative');
assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('special_background_badge', 'event_special_background')), 'special');
assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('other', 'other')), 'uncertain');
assert.equal(helpers.deriveBackgroundTypeFromEvidence({ present: false, region_visibility: 'cropped', position: 'none', badge_type: 'none', appearance: 'none' }), 'uncertain');
assert.equal(helpers.deriveRocketStateFromEvidence({ present: true, region_visibility: 'clear', position: 'lower_left', color: 'light_cyan', shape: 'purification_starburst' }), 'purified');
assert.equal(helpers.deriveBackgroundTypeFromEvidence(clearBackground('special_background_badge', 'event_special_background')), 'special', 'Dynamax is independent of a real badge');

const bbox = { card_bbox: { x_min: 0, y_min: 0, x_max: 300, y_max: 400 }, pokemon_bbox: { x_min: 30, y_min: 40, x_max: 270, y_max: 330 }, bbox_confidence: .99, bbox_visibility: 'clear' };
const card = (id, species, form, bg, cp) => ({ card_id: id, screenshot_index: 2, order: Number(id.slice(1)) + 1, row: 1, column: Number(id.slice(1)) + 1,
  cp: String(cp), base_species: species, official_name: species, canonical_official_name: helpers.HUNDO_FORM_CANONICAL_NAMES[form] || species,
  recognition_status: 'recognized', species_confidence: .99, form_id: form || 'not_applicable', effective_form_id: form || 'not_applicable', form_confidence: .99,
  effective_shiny_state: 'no', effective_lucky_state: 'no', effective_favorite_state: 'no', effective_rocket_state: 'normal',
  background_type: bg, effective_background_type: bg, background_confidence: .99,
  background_evidence: bg === 'commemorative' ? clearBackground('commemorative_location_badge', 'location_style_background') : bg === 'special' ? clearBackground('special_background_badge', 'event_special_background') : clearBackground('none', 'none', false),
  manual_review_reasons: [], ...bbox });

const zacian = card('c0', '蒼響', 'zacian_crowned', 'none', 2199);
const confidentPlan = verifier.planTargetHundoAttributeCandidates([zacian], { screenshotIndex: 2 });
assert.equal(confidentPlan.candidates.length, 1, 'confident crowned Zacian is reviewed');
assert.deepEqual(confidentPlan.candidates[0].requested_dimensions, ['form']);
const job = verifier.planHundoFormVerificationBatches(confidentPlan.candidates)[0].jobs[0];
const formEvidence = id => verifier.REQUIRED_VERIFIED_FORM_EVIDENCE[id];
const resultFor = (job, overrides = {}) => ({ tile_id: job.tile_id, card_id: job.card_id, screenshot_index: job.screenshot_index,
  requested_dimensions: job.requested_dimensions, base_species: job.base_species, verified_form_id: 'uncertain', verification_confidence: 0,
  crop_visibility: 'uncertain', body_plan: 'uncertain', limb_layout: 'uncertain', fusion_host: 'uncertain', decisive_feature: 'uncertain', key_features_visible: false,
  verified_background_type: 'uncertain', background_verification_confidence: 0, background_region_visibility: 'uncertain', background_card_association: 'uncertain',
  observed_icon_class: 'uncertain', badge_type: 'uncertain', appearance: 'uncertain', ...overrides });
const standardEvidence = formEvidence('zacian_standard');
let merged = verifier.mergeHundoAttributeVerificationResults(confidentPlan.cards, [job], { cards: [resultFor(job, {
  verified_form_id: 'zacian_standard', verification_confidence: .97, crop_visibility: 'clear', body_plan: standardEvidence.body_plan,
  limb_layout: standardEvidence.limb_layout, fusion_host: standardEvidence.fusion_host, decisive_feature: standardEvidence.decisive_feature, key_features_visible: true
})] }, helpers.HUNDO_FORM_CANONICAL_NAMES);
assert.equal(merged[0].effective_form_id, 'zacian_standard');
assert.equal(merged[0].canonical_official_name, '蒼響');
const crownedEvidence = formEvidence('zacian_crowned');
merged = verifier.mergeHundoAttributeVerificationResults(confidentPlan.cards, [job], { cards: [resultFor(job, {
  verified_form_id: 'zacian_crowned', verification_confidence: .97, crop_visibility: 'clear', body_plan: crownedEvidence.body_plan,
  limb_layout: crownedEvidence.limb_layout, fusion_host: crownedEvidence.fusion_host, decisive_feature: crownedEvidence.decisive_feature, key_features_visible: true
})] }, helpers.HUNDO_FORM_CANONICAL_NAMES);
assert.equal(merged[0].effective_form_id, 'zacian_crowned');
merged = verifier.mergeHundoAttributeVerificationResults(confidentPlan.cards, [job], { cards: [resultFor(job, { verified_form_id: 'zacian_standard', verification_confidence: .99, crop_visibility: 'cropped' })] }, helpers.HUNDO_FORM_CANONICAL_NAMES);
assert.equal(merged[0].effective_form_id, 'uncertain');

const affected = [card('c1', '超夢', 'not_applicable', 'commemorative', 2401), zacian, card('c2', '急凍鳥', 'articuno_standard', 'special', 1802)];
const plan = verifier.planTargetHundoAttributeCandidates(affected, { screenshotIndex: 2 });
assert.equal(plan.candidates.length, 3);
assert.equal(verifier.planHundoFormVerificationBatches(plan.candidates).length, 1, 'three dimensions share one bounded request');
assert.equal(plan.candidates.filter(c => c.card_id === 'c0').length, 1, 'combined job is not duplicated');
const jobs = verifier.planHundoFormVerificationBatches(plan.candidates)[0].jobs;
const outputs = jobs.map(j => resultFor(j, j.card_id === 'c1' ? { verified_background_type: 'special', background_verification_confidence: .96, background_region_visibility: 'clear', background_card_association: 'same_card', observed_icon_class: 'special_flower_badge', badge_type: 'special_background_badge', appearance: 'event_special_background' }
  : j.card_id === 'c2' ? { verified_background_type: 'none', background_verification_confidence: .96, background_region_visibility: 'clear', background_card_association: 'same_card', observed_icon_class: 'pink_dynamax_x', badge_type: 'none', appearance: 'none' }
  : { verified_form_id: 'zacian_standard', verification_confidence: .97, crop_visibility: 'clear', body_plan: standardEvidence.body_plan, limb_layout: standardEvidence.limb_layout, fusion_host: standardEvidence.fusion_host, decisive_feature: standardEvidence.decisive_feature, key_features_visible: true }));
const corrected = verifier.mergeHundoAttributeVerificationResults(plan.cards, jobs, { cards: outputs }, helpers.HUNDO_FORM_CANONICAL_NAMES);
assert.deepEqual(corrected.map(c => c.effective_background_type), ['special', 'none', 'none']);
assert.equal(corrected[1].effective_form_id, 'zacian_standard');
const bad = verifier.mergeHundoAttributeVerificationResults(plan.cards, jobs, { cards: [...outputs, outputs.find(value => value.card_id === 'c1')] }, helpers.HUNDO_FORM_CANONICAL_NAMES);
assert.equal(bad[0].effective_background_type, 'uncertain', 'duplicate result is rejected');
assert.equal(bad[2].effective_background_type, 'uncertain', 'invalid batch cannot correct a neighboring card');

const reference = [card('r0', '蓋歐卡', 'not_applicable', 'none', 3011), card('r1', '烈空坐', 'not_applicable', 'none', 2802), card('r2', '蓋歐卡', 'not_applicable', 'none', 2703), card('r3', '酋雷姆', 'kyurem_white', 'none', 2604), ...corrected];
reference[0].effective_rocket_state = 'purified';
assert.deepEqual(helpers.smartHundoCardsToPokemonList(reference), { pokemon_list: '蓋歐卡*2,烈空坐,焰白酋雷姆,特別背卡超夢,蒼響,急凍鳥', recognized_count: 7, review_card_count: 0, review_reason_counts: {} });
assert.equal(verifier.validateVerifiedBackground({ verified_background_type: 'none', background_verification_confidence: .99, background_region_visibility: 'cropped', background_card_association: 'same_card', observed_icon_class: 'none', badge_type: 'none', appearance: 'none' }).valid, false);
console.log('PASS Smart Hundo attribute verification regressions');

// Review follow-up: the observed icon must agree with both positive evidence fields.
for (const [type, badge, appearance, validIcon] of [
  ['special', 'special_background_badge', 'event_special_background', 'special_flower_badge'],
  ['commemorative', 'commemorative_location_badge', 'location_style_background', 'location_globe_badge']
]) {
  for (const incompatibleIcon of ['pink_dynamax_x', 'purification_starburst', 'other', 'none', 'uncertain']) {
    assert.equal(verifier.validateVerifiedBackground({ verified_background_type: type,
      background_verification_confidence: .99, background_region_visibility: 'clear',
      background_card_association: 'same_card', observed_icon_class: incompatibleIcon,
      badge_type: badge, appearance }).valid, false, `${type} rejects ${incompatibleIcon}`);
  }
  assert.equal(verifier.validateVerifiedBackground({ verified_background_type: type,
    background_verification_confidence: .99, background_region_visibility: 'clear',
    background_card_association: 'same_card', observed_icon_class: validIcon,
    badge_type: badge, appearance }).valid, true, `${type} accepts its matching icon`);
}
assert.equal(verifier.validateVerifiedBackground({ verified_background_type: 'none',
  background_verification_confidence: .99, background_region_visibility: 'clear',
  background_card_association: 'same_card', observed_icon_class: 'pink_dynamax_x',
  badge_type: 'none', appearance: 'none' }).valid, true, 'clear associated Dynamax-only evidence supports none');

const backgroundOnlyCard = card('s1', '超夢', 'not_applicable', 'special', 2507);
backgroundOnlyCard.manual_review_reasons = ['background_uncertain', 'shiny_uncertain'];
const backgroundOnlyPlan = verifier.planTargetHundoAttributeCandidates([backgroundOnlyCard], { screenshotIndex: 2 });
const backgroundOnlyJob = verifier.planHundoFormVerificationBatches(backgroundOnlyPlan.candidates)[0].jobs[0];
assert.deepEqual(backgroundOnlyJob.requested_dimensions, ['background']);
const matchingBackground = resultFor(backgroundOnlyJob, { verified_background_type: 'special',
  background_verification_confidence: .99, background_region_visibility: 'clear',
  background_card_association: 'same_card', observed_icon_class: 'special_flower_badge',
  badge_type: 'special_background_badge', appearance: 'event_special_background' });
const matchedBackground = verifier.mergeHundoAttributeVerificationResults(backgroundOnlyPlan.cards,
  [backgroundOnlyJob], { cards: [matchingBackground] }, helpers.HUNDO_FORM_CANONICAL_NAMES)[0];
assert.equal(matchedBackground.effective_background_type, 'special');
assert.deepEqual(matchedBackground.manual_review_reasons, ['shiny_uncertain']);
const wrongSpecies = verifier.mergeHundoAttributeVerificationResults(backgroundOnlyPlan.cards,
  [backgroundOnlyJob], { cards: [{ ...matchingBackground, base_species: '急凍鳥' }] }, helpers.HUNDO_FORM_CANONICAL_NAMES)[0];
assert.equal(wrongSpecies.effective_background_type, 'uncertain');
assert.equal(wrongSpecies.background_verification_status, 'failed');
assert.equal(wrongSpecies.manual_review_reasons.includes('background_uncertain'), true);
assert.equal(wrongSpecies.manual_review_reasons.includes('shiny_uncertain'), true);

const missingStructure = verifier.validateHundoAttributeVerifierStructure({ cards: outputs.slice(1) }, jobs, 'stop');
assert.equal(missingStructure.complete, false);
assert.equal(missingStructure.reason, 'structural_incomplete');
const truncatedStructure = verifier.validateHundoAttributeVerifierStructure({ cards: outputs }, jobs, 'length');
assert.equal(truncatedStructure.complete, false);
assert.equal(truncatedStructure.reason, 'structural_incomplete');
