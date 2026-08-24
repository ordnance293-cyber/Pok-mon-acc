const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expression = name => {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const end = source.indexOf('\n        };', start);
  assert.notStrictEqual(end, -1, `unterminated ${name}`);
  return source.slice(start, end + '\n        };'.length);
};
const context = {};
vm.createContext(context);
vm.runInContext(`${expression('extractStorageCapacity')}\nthis.extractStorageCapacity = extractStorageCapacity;`, context);
vm.runInContext(`${expression('normalizeStorageHeaderResult')}\nthis.normalizeStorageHeaderResult = normalizeStorageHeaderResult;`, context);

const extract = context.extractStorageCapacity;
for (const [input, expected] of [
  ['391/875', '875'], ['391 / 875', '875'], ['258/500', '500'],
  ['1,234/5,678', '5678'], ['391／875', '875'], ['１，２３４／５，６７８', '5678'],
  ['391', ''], ['875', ''], ['258', ''], ['500', ''], ['391/', ''], ['／875', ''],
  ['391 875', ''], ['道具 391/875', ''], ['寶可夢 258/500', ''],
  ['current=391 capacity=875', ''], ['', ''], [null, ''], [undefined, '']
]) assert.strictEqual(extract(input), expected, `strict parser mismatch for ${String(input)}`);

const normalize = value => JSON.parse(JSON.stringify(context.normalizeStorageHeaderResult(value)));
assert.deepStrictEqual(normalize({ header_type: 'item', storage_text: '391/875' }), {
  header_type: 'item', poke_bag: '', item_bag: '875', structurally_complete: true
});
assert.deepStrictEqual(normalize({ header_type: 'pokemon', storage_text: '258/500' }), {
  header_type: 'pokemon', poke_bag: '500', item_bag: '', structurally_complete: true
});
assert.deepStrictEqual(normalize({ header_type: 'none', storage_text: '' }), {
  header_type: 'none', poke_bag: '', item_bag: '', structurally_complete: true
});
for (const input of [
  { header_type: 'item', storage_text: '875' },
  { header_type: 'pokemon', storage_text: '258' },
  { header_type: 'invalid', storage_text: '391/875' }
]) {
  const result = normalize(input);
  assert.strictEqual(result.structurally_complete, false);
  assert.strictEqual(result.poke_bag, '');
  assert.strictEqual(result.item_bag, '');
}

const crop = expression('fileToStorageHeaderDataUrl');
assert(crop.includes('img.src = originalDataUrl'), 'crop must use original data URL');
assert(crop.includes('0, 0, sourceWidth, cropHeight'), 'crop must start at top and preserve source width');
assert(crop.includes('Math.max(240, Math.ceil(sourceHeight * 0.24))'), 'crop must retain sufficient top area');
assert(crop.includes("canvas.toDataURL('image/png')"), 'crop must be lossless PNG');
assert(!crop.includes('image/jpeg'), 'storage crop must never use JPEG');

assert(source.includes("const STORAGE_HEADER_IMAGE_TYPES = new Set(['RESOURCE_SCREEN', 'CATEGORY_OVERVIEW_SCREEN'])"));
assert(source.includes("{ imageDetail: 'high', maxRetries: 1 }"));
assert(source.includes("const DEDICATED_VERIFICATION_FIELDS = new Set(['poke_bag', 'item_bag'])"));
const recoveryBuilder = source.slice(source.indexOf('const buildOrdinaryRecoveryTargets ='), source.indexOf('const runOrdinaryRecoveryBatch = async'));
assert(recoveryBuilder.includes('!DEDICATED_VERIFICATION_FIELDS.has(field)'));
const verifier = source.slice(source.indexOf('const verifyStorageHeader = async'), source.indexOf('const requestSingleImageClassification = async'));
assert.strictEqual((verifier.match(/requestStorageHeaderVerification\(/g) || []).length, 2, 'one primary plus at most one structural retry');
assert(verifier.includes('if (!result.structurally_complete)'), 'truthful none must not retry');
const orchestration = source.slice(source.indexOf('const runNormalTask = async () =>'), source.indexOf('const smartQueueStartedAt'));
assert(orchestration.includes('Promise.all(['), 'ordinary extraction and verifier must run in parallel');
assert(orchestration.includes('normalIndex'), 'storage merge must preserve explicit screenshot index');
assert(orchestration.includes('imageResult.header_type = verified.header_type'));
assert(orchestration.includes('imageResult.poke_bag = verified.poke_bag'));
assert(orchestration.includes('imageResult.item_bag = verified.item_bag'));
assert(orchestration.indexOf('storageSettlements.forEach') < orchestration.indexOf('runOrdinaryRecoveryBatch'), 'authoritative storage merge must precede recovery');

const ownership = source.slice(source.indexOf('const STORAGE_CAPACITY_AI_OWNED_INPUT_IDS'), source.indexOf('const isCurrentSmartHundoSession'));
for (const fragment of ['marker && input && input.value === marker.value', 'storageCapacityAiValueOwnership.clear()']) {
  assert(ownership.includes(fragment), `ownership safeguard missing: ${fragment}`);
}
assert(source.includes("addEventListener('input'"));
assert(source.includes('storageCapacityAiValueOwnership.delete(inputId)'));
assert(source.includes('storageCapacityAiValueOwnership.set(id, { value: normalizedValue })'));

console.log('Storage capacity recognition tests passed.');
