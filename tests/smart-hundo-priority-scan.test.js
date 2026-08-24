const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(source.includes('const AI_CLASSIFICATION_BATCH_SIZE = 2;'));
assert(source.includes('for (let start = 0; start < jobs.length; start += AI_CLASSIFICATION_BATCH_SIZE)'));
assert(source.includes('await Promise.allSettled(batch.map(job =>'));
assert(source.includes('.filter(job => helpers.isSmartHundoClassification(job.classification))'));
assert(!source.includes('ai-scan-scheduler.js'));
for (const forbidden of [
  'SMART_HUNDO_MIN_RECOGNIZED_SPECIES_RATIO',
  'SMART_HUNDO_MIN_RESOLVED_DISPLAY_RATIO',
  'SMART_HUNDO_MAX_QUALITY_RETRIES',
  'evaluateSmartHundoQuality',
  'runSmartHundoJobWithQualityRetry',
  'mergeSmartHundoScreenshotsAdjacent'
]) assert(!source.includes(forbidden), `PR #68 logic must remain absent: ${forbidden}`);
for (const preserved of [
  "const HUNDO_COUNT_MODEL = 'gpt-5.6-luna';",
  "const HUNDO_SMART_MODEL = 'gpt-5.6-sol';",
  "const HUNDO_FORM_VERIFY_MODEL = 'gpt-5.6-sol';",
  'helpers.mergeSmartHundoScreenshots(successfulCardScreenshots)',
  'const smartHundoScan = async ({',
  'const runOrdinaryRecoveryBatch = async ({',
  'const requestStorageHeaderVerification = async'
]) assert(source.includes(preserved), `preserved pipeline contract missing: ${preserved}`);

async function runPriorityScan(types) {
  const events = [];
  const active = { classification: 0, ordinary: 0, storage: 0, trainerTeam: 0, smart: 0 };
  let triggers = 0;
  const jobs = types.map((type, index) => ({ index, type }));

  for (let start = 0; start < jobs.length; start += 2) {
    const batch = jobs.slice(start, start + 2);
    const settled = await Promise.allSettled(batch.map(async job => {
      active.classification += 1;
      events.push(`classify ${job.index}`);
      await Promise.resolve();
      active.classification -= 1;
      return job;
    }));
    const smartJobs = settled.map(item => item.value).filter(job => job.type === 'smart');
    if (smartJobs.length) triggers += 1;
    for (const job of smartJobs) {
      assert.strictEqual(active.classification, 0);
      assert.strictEqual(active.ordinary, 0);
      assert.strictEqual(active.storage, 0);
      assert.strictEqual(active.trainerTeam, 0);
      assert.strictEqual(active.smart, 0, 'Smart Hundo scans must be sequential');
      active.smart += 1;
      events.push(`smart-start ${job.index}`);
      await Promise.resolve();
      events.push(`smart-end ${job.index}`);
      active.smart -= 1;
    }
  }
  active.ordinary += 1;
  events.push('ordinary-start');
  active.ordinary -= 1;
  return { events, triggers };
}

(async () => {
  const priority = await runPriorityScan(['ordinary', 'ordinary', 'smart', 'ordinary', 'ordinary', 'ordinary']);
  assert(priority.events.indexOf('smart-end 2') < priority.events.indexOf('classify 4'));
  assert(priority.events.indexOf('classify 5') < priority.events.indexOf('ordinary-start'));

  const multiple = await runPriorityScan(['ordinary', 'ordinary', 'smart', 'smart', 'ordinary']);
  assert.deepStrictEqual(multiple.events.filter(event => event.startsWith('smart')), [
    'smart-start 2', 'smart-end 2', 'smart-start 3', 'smart-end 3'
  ]);

  const ordinary = await runPriorityScan(Array(6).fill('ordinary'));
  assert.strictEqual(ordinary.events.filter(event => event.startsWith('classify')).length, 6);
  assert.strictEqual(ordinary.triggers, 0);
  assert(!ordinary.events.some(event => event.startsWith('smart')));

  const single = await runPriorityScan(['smart']);
  assert.deepStrictEqual(single.events, ['classify 0', 'smart-start 0', 'smart-end 0', 'ordinary-start']);
  console.log('Smart Hundo classification priority tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
