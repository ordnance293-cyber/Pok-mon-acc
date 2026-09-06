const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expression = name => {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker); assert(start >= 0, `missing ${name}`);
  const end = source.indexOf('\n        };', start); assert(end > start, `unterminated ${name}`);
  return source.slice(start, end + 11);
};
const context = { SHINY_LEGENDARY_FILTER: '傳說的寶可夢,幻,究極異獸&異色', normalizeSearchQuery: value => String(value || '').replace(/\s/g, '') };
vm.createContext(context);
for (const name of ['normalizeParenthesizedSearchCount', 'normalizeShinyLegendaryEvidence', 'reconcileShinyLegendaryCounts', 'formatCountConsistencyReview']) {
  vm.runInContext(`${expression(name)}\nthis.${name}=${name};`, context);
}
const evidence = (raw, extra={}) => context.normalizeShinyLegendaryEvidence({
 visible_query: context.SHINY_LEGENDARY_FILTER, active_tab: 'pokemon', source_region: 'pokemon_tab_summary', raw_summary_text: raw, target_summary_readable: true, ...extra
}, { search_query: context.SHINY_LEGENDARY_FILTER });
assert.strictEqual(evidence('(15)').shiny_leg, '15'); // battery 49 and eggs 9/12 are absent from allowed evidence
assert.strictEqual(evidence('(49)').shiny_leg, '49');
assert.strictEqual(evidence('49').shiny_leg, '');
for (const raw of ['CP 49', '9/12', '12:49', '']) assert.strictEqual(evidence(raw).shiny_leg, '');
assert.strictEqual(evidence('（ ４９ ）').shiny_leg, '49');
assert.strictEqual(evidence('（０）').shiny_leg, '0');

const productionEvidence = evidence('寶可夢 (17)');
assert.strictEqual(productionEvidence.shiny_leg, '17');
assert.strictEqual(productionEvidence.evidence.accepted, true);
assert.strictEqual(productionEvidence.evidence.raw_summary_text, '寶可夢 (17)');

for (const [raw, expected] of [
  ['(17)', '17'], ['寶可夢 (17)', '17'], ['寶可夢\n(17)', '17'], ['寶可夢（１７）', '17'],
  ['（１７）', '17'], ['(0)', '0'], ['寶可夢 (0)', '0'], ['(49)', '49'], ['寶可夢 (123)', '123']
]) assert.strictEqual(evidence(raw).shiny_leg, expected, `accept ${JSON.stringify(raw)}`);

for (const raw of [
  '17', '75', '蛋 (17)', '電量 (75)', 'CP (3407)', '11/12', '435/500', '寶可夢 17',
  '寶可夢 (17) 電量 75', '寶可夢 (17) (75)', '其他文字 (17)', '(-17)', '(1.7)',
  '寶可夢 (-17)', '寶可夢 (1.7)', '(17', '17)', '寶可夢（17'
]) assert.strictEqual(evidence(raw).shiny_leg, '', `reject ${JSON.stringify(raw)}`);

for (const [classification, extra] of [
  [{ search_query: '異色' }, {}],
  [{ search_query: context.SHINY_LEGENDARY_FILTER }, { visible_query: '異色' }],
  [{ search_query: context.SHINY_LEGENDARY_FILTER }, { active_tab: 'egg' }],
  [{ search_query: context.SHINY_LEGENDARY_FILTER }, { source_region: 'battery' }],
  [{ search_query: context.SHINY_LEGENDARY_FILTER }, { target_summary_readable: false }]
]) {
  const rejected = context.normalizeShinyLegendaryEvidence({
    visible_query: context.SHINY_LEGENDARY_FILTER, active_tab: 'pokemon', source_region: 'pokemon_tab_summary',
    raw_summary_text: '寶可夢 (17)', target_summary_readable: true, ...extra
  }, classification);
  assert.strictEqual(rejected.shiny_leg, '');
  assert.strictEqual(rejected.evidence.accepted, false);
}
assert.strictEqual(evidence('(15)', { active_tab: 'egg' }).shiny_leg, '');
assert.strictEqual(evidence('(15)', { visible_query: '異色' }).shiny_leg, '');
const task = (imageIndex, values) => ({ imageIndex, imageResult: values });
let r = context.reconcileShinyLegendaryCounts({ shiny: '28', shiny_leg: '49' }, [task(0,{shiny:'28'}),task(1,{shiny_leg:'49'})]);
assert.strictEqual(r.result.shiny_leg, ''); assert.strictEqual(r.result.shiny, ''); assert.strictEqual(r.conflicts.length, 1);
assert(context.formatCountConsistencyReview(r).includes('圖2'));
r = context.reconcileShinyLegendaryCounts({ shiny: '28', shiny_leg: '15' }, []);
assert.strictEqual(r.result.shiny_leg, '15'); assert.strictEqual(r.result.shiny, '28');
r = context.reconcileShinyLegendaryCounts({ shiny_leg: '49', legendary: '' }, []);
assert.strictEqual(r.result.shiny_leg, '49');

// Integration regression: run the production normalization, merge, consistency,
// recovery-target, and form-application helpers in the mocked browser harness.
const inputs = new Map();
const integration = {
  AI_FIELD_SOURCE_PRIORITY: {
    shiny: { CATEGORY_OVERVIEW_SCREEN: 1 },
    shiny_leg: { SHINY_LEGENDARY_SCREEN: 1 },
    poke_bag: { CATEGORY_OVERVIEW_SCREEN: 1 }
  },
  AI_FIELD_TO_IMAGE_TYPES: {
    shiny: ['CATEGORY_OVERVIEW_SCREEN'],
    shiny_leg: ['SHINY_LEGENDARY_SCREEN'],
    poke_bag: ['CATEGORY_OVERVIEW_SCREEN']
  },
  AI_REQUIRED_VALIDATION_FIELDS: ['shiny', 'shiny_leg', 'poke_bag'],
  DEDICATED_VERIFICATION_FIELDS: new Set(['poke_bag', 'item_bag']),
  AI_AUTOFILL_FIELD_TO_INPUT: { shiny: 'st_shiny', shiny_leg: 'st_shiny_leg', poke_bag: 'st_poke_bag' },
  STORAGE_CAPACITY_AI_OWNED_INPUT_IDS: new Set(['st_poke_bag', 'st_item_bag']),
  storageCapacityAiValueOwnership: new Map(),
  buildEmptyMergedAiResult: () => ({ shiny: '', shiny_leg: '', poke_bag: '', pokemon_list: '' }),
  buildEmptyAiResult: () => ({ shiny: '', shiny_leg: '', poke_bag: '', pokemon_list: '' }),
  normalizePokemonList: value => value,
  isPopulatedAiValue: value => String(value || '').trim() !== '',
  getRequiredValidationFields: () => ['shiny', 'shiny_leg', 'poke_bag'],
  captureProtectedAiState: () => ({}), restoreProtectedAiState: () => {}, highlightInput: () => {},
  document: { getElementById: id => {
    if (!inputs.has(id)) inputs.set(id, { value: '' });
    return inputs.get(id);
  } },
  window: { updateHundoCount: () => {} }
};
vm.createContext(integration);
for (const name of [
  'mergeAiResults', 'getCandidateImageIndexesForField', 'evaluateRequiredFieldCoverage',
  'buildValidationTargets', 'applyAiResultToForm'
]) vm.runInContext(`${expression(name)}\nthis.${name}=${name};`, integration);

const normalizedShiny = evidence('寶可夢 (17)');
const integrationTasks = [
  task(0, { image_type: 'CATEGORY_OVERVIEW_SCREEN', header_type: 'pokemon', shiny: '43', poke_bag: '500' }),
  task(1, { image_type: 'SHINY_LEGENDARY_SCREEN', header_type: 'pokemon', shiny_leg: normalizedShiny.shiny_leg })
];
const merged = integration.mergeAiResults(integrationTasks.map(result => result.imageResult));
const consistent = context.reconcileShinyLegendaryCounts(merged, integrationTasks);
assert.deepStrictEqual(
  { shiny: consistent.result.shiny, shiny_leg: consistent.result.shiny_leg, poke_bag: consistent.result.poke_bag },
  { shiny: '43', shiny_leg: '17', poke_bag: '500' }
);
assert.strictEqual(consistent.conflicts.length, 0);
const classifications = [{ image_type: 'CATEGORY_OVERVIEW_SCREEN' }, { image_type: 'SHINY_LEGENDARY_SCREEN' }];
const coverage = integration.evaluateRequiredFieldCoverage(consistent.result, classifications, integrationTasks);
const recoveryTargets = integration.buildValidationTargets(coverage.missingWithScreens.filter(
  ({ field }) => !integration.DEDICATED_VERIFICATION_FIELDS.has(field)
));
assert(!recoveryTargets.some(target => target.fields.includes('shiny_leg')),
  'accepted primary shiny_leg evidence must not be scheduled for recovery');
integration.applyAiResultToForm(consistent.result);
assert.strictEqual(inputs.get('st_shiny').value, '43');
assert.strictEqual(inputs.get('st_shiny_leg').value, '17');
assert.strictEqual(inputs.get('st_poke_bag').value, '500');
assert(source.includes("canvas.toDataURL('image/png')"));
assert(source.includes("classification.image_type !== 'SHINY_LEGENDARY_SCREEN'"));
console.log('Shiny legendary evidence and consistency tests passed; 0 live OpenAI requests.');
