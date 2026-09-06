const assert = require('assert');
const helpers = require('../smart-hundo-helpers.js');
const base = {
  applicable: true, imageIndexes: [0], elapsedMs: 52000, finalCount: '7',
  finalPokemonList: '蓋歐卡*2,烈空坐,白酋雷姆,超夢,蒼響,急凍鳥',
  countApplied: true, listApplied: true, countValid: true, countConflict: false,
  cardOperationsSucceeded: true, structuresComplete: true, overlapResolved: true,
  verificationComplete: true, cardReviewCount: 0, sessionReviewReasons: [],
  renderObservation: 'observed', currentRun: true
};
const evaluate = changes => helpers.evaluateSmartHundoCompletion({ ...base, ...changes });
assert.deepStrictEqual([evaluate({}).completed, evaluate({}).within_60s, evaluate({}).expanded_pokemon_count], [true, true, 7]);
assert.strictEqual(evaluate({ elapsedMs: 72000, unrelatedOrdinaryMissingFields: ['stardust'] }).within_60s, false, 'real unrelated waits remain in elapsed time');
assert.strictEqual(evaluate({ unrelatedOrdinaryMissingFields: ['storage', 'shiny'] }).completed, true, 'ordinary missing fields do not affect hundo completeness');
assert.strictEqual(evaluate({ elapsedMs: 61000, apiReturnedAtMs: 55000 }).within_60s, false, 'render at 61 seconds fails even if API returned sooner');
assert.strictEqual(evaluate({ elapsedMs: 52000, blockingAlertDismissedAtMs: 72000 }).complete_visible_elapsed_ms, 52000, 'later alert dismissal cannot inflate observed milestone');
assert.strictEqual(evaluate({ finalPokemonList: '蓋歐卡*2,烈空坐', elapsedMs: 40000 }).completed, false, 'partial list cannot complete');
assert.strictEqual(evaluate({ elapsedMs: 60000 }).within_60s, true);
assert.strictEqual(evaluate({ elapsedMs: 60001 }).within_60s, false);
assert.strictEqual(evaluate({ finalPokemonList: '甲*2,乙' }).expanded_pokemon_count, 3);
assert.strictEqual(evaluate({ finalPokemonList: '甲*2,乙,丙,丁,戊' }).completed, false, 'six represented cards cannot satisfy seven');
for (const changes of [
  { countValid: false }, { cardOperationsSucceeded: false }, { structuresComplete: false },
  { overlapResolved: false }, { verificationComplete: false }, { cardReviewCount: 1 },
  { sessionReviewReasons: ['count_conflict'], cardReviewCount: 0 }, { countApplied: false }, { listApplied: false }
]) assert.strictEqual(evaluate(changes).completed, false);
assert.strictEqual(evaluate({ applicable: false }).within_60s, false);
assert.strictEqual(evaluate({ currentRun: false }).completed, false);
assert.strictEqual(evaluate({ renderObservation: 'unverified_background' }).within_60s, false);
assert.strictEqual(evaluate({ renderObservation: 'pending', elapsedMs: 70000 }).completed, false, 'passing the threshold neither certifies nor truncates pending work');
const empty = evaluate({ finalCount: '0', finalPokemonList: '' });
assert.strictEqual(empty.completed, true, 'validated zero and complete empty extraction is valid');

(async () => {
  let frames = 0;
  const observed = await helpers.observeSmartHundoRenderOpportunity({
    scheduleFrame: callback => { frames += 1; callback(); }, isVisible: () => true, isCurrentRun: () => true
  });
  assert.strictEqual(observed, 'observed'); assert.strictEqual(frames, 2);
  assert.strictEqual(await helpers.observeSmartHundoRenderOpportunity({ isVisible: () => true }), 'unavailable');
  assert.strictEqual(await helpers.observeSmartHundoRenderOpportunity({ scheduleFrame: cb => cb(), isVisible: () => false }), 'unverified_background');
  console.log('Smart Hundo completion lifecycle tests passed; mocked clock/DOM/render only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
