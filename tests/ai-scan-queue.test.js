const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ScanQueue, createScanJob, MAX_CONCURRENT_SCANS } = require('../ai-scan-queue.js');

class MemoryStore {
  constructor(seed = []) { this.records = new Map(seed.map(job => [job.id, structuredClone(job)])); }
  async put(job) { this.records.set(job.id, structuredClone(job)); }
  async get(id) { return structuredClone(this.records.get(id)); }
  async delete(id) { this.records.delete(id); }
  async getAll() { return structuredClone([...this.records.values()]); }
}

const waitUntil = async predicate => {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error('condition timed out');
};

(async () => {
  assert.strictEqual(MAX_CONCURRENT_SCANS, 1);

  // queued -> processing -> completed
  const transitions = [];
  const success = new ScanQueue({ store: new MemoryStore(), runner: async () => ({ value: 1 }), onChange: (_jobs, reason) => transitions.push(reason) });
  await success.initialize();
  const completed = await success.enqueue([new Blob(['a'])]);
  await waitUntil(() => completed.status === 'completed');
  assert.deepStrictEqual(completed.result, { value: 1 });
  assert(transitions.includes('processing') && transitions.includes('completed'));

  // queued -> processing -> failed; failed jobs preserve their Blob.
  const failure = new ScanQueue({ store: new MemoryStore(), runner: async () => { throw new Error('network'); } });
  await failure.initialize();
  const failed = await failure.enqueue([new Blob(['b'])]);
  await waitUntil(() => failed.status === 'failed');
  assert.strictEqual(failed.files.length, 1);
  assert.strictEqual(failed.error.message, 'network');

  // failed -> retry -> completed
  failure.runner = async () => ({ retried: true });
  await failure.retry(failed.id);
  await waitUntil(() => failed.status === 'completed');
  assert.strictEqual(failed.attempts, 2);

  // A processing record from a previous page becomes interrupted without an automatic API retry.
  const interrupted = createScanJob([new Blob(['c'])], { id: 'interrupted', now: 1 });
  interrupted.status = 'processing';
  const recoveryStore = new MemoryStore([interrupted]);
  let recoveredRunCount = 0;
  const recovered = new ScanQueue({
    store: recoveryStore,
    runner: async () => { recoveredRunCount += 1; return { ok: true }; },
    now: () => 2
  });
  await recovered.initialize();
  assert.strictEqual(recovered.jobs[0].status, 'interrupted');
  assert.match(recovered.jobs[0].progress, /中斷/);
  await recovered.process();
  assert.strictEqual(recoveredRunCount, 0, 'interrupted jobs must never run automatically');
  assert.strictEqual(await recovered.jobs[0].files[0].text(), 'c', 'interrupted jobs retain image blobs');
  await recovered.retry(interrupted.id);
  await waitUntil(() => recovered.jobs[0].status === 'completed');
  assert.strictEqual(recoveredRunCount, 1, 'explicit retry may run the interrupted job once');
  assert.strictEqual(recovered.jobs[0].attempts, 1);

  // Lifecycle refreshes in the same live session preserve the active Promise and worker.
  let releaseActive;
  let activeRunCount = 0;
  const activeGate = new Promise(resolve => { releaseActive = resolve; });
  const active = new ScanQueue({
    store: new MemoryStore(),
    runner: async () => { activeRunCount += 1; await activeGate; return { ok: true }; }
  });
  await active.initialize();
  const activeJob = await active.enqueue([new Blob(['live'])]);
  await waitUntil(() => activeJob.status === 'processing');
  const activePromise = active.process();
  await active.refresh();
  assert.strictEqual(activeJob.status, 'processing');
  assert.strictEqual(active.process(), activePromise);
  assert.strictEqual(activeRunCount, 1);
  releaseActive();
  await activePromise;
  assert.strictEqual(activeJob.status, 'completed');
  assert.strictEqual(activeRunCount, 1, 'lifecycle refresh must not duplicate the active request');

  // FIFO, a failure does not block later work, and one worker cannot double-run a job.
  const order = [];
  const calls = new Map();
  const fifo = new ScanQueue({
    store: new MemoryStore(),
    runner: async job => {
      calls.set(job.id, (calls.get(job.id) || 0) + 1);
      order.push(job.label);
      if (job.label === 'A') throw new Error('A failed');
      return { label: job.label };
    }
  });
  await fifo.initialize();
  const originalOnline = fifo.isOnline;
  fifo.isOnline = () => false;
  const a = await fifo.enqueue([new Blob(['a'])], { label: 'A' });
  const b = await fifo.enqueue([new Blob(['b'])], { label: 'B' });
  fifo.isOnline = originalOnline;
  const p1 = fifo.process();
  const p2 = fifo.process();
  assert.strictEqual(p1, p2);
  await p1;
  await waitUntil(() => b.status === 'completed');
  assert.deepStrictEqual(order, ['A', 'B']);
  assert.strictEqual(a.status, 'failed');
  assert.strictEqual(calls.get(a.id), 1);
  assert.strictEqual(calls.get(b.id), 1);

  // Reload restores the same queued record and image data.
  const reloadSeed = createScanJob([new Blob(['image'])], { id: 'reload', now: 10 });
  const reloadQueue = new ScanQueue({ store: new MemoryStore([reloadSeed]), runner: async () => ({}) });
  await reloadQueue.initialize();
  assert.strictEqual(reloadQueue.jobs[0].id, 'reload');
  assert.strictEqual(await reloadQueue.jobs[0].files[0].text(), 'image');

  // Queue completion is data-only: applying is an explicit UI action.
  let activeForm = 'Account B draft';
  const isolated = new ScanQueue({ store: new MemoryStore(), runner: async () => ({ account: 'A' }) });
  await isolated.initialize();
  const jobA = await isolated.enqueue([new Blob(['a'])]);
  await waitUntil(() => jobA.status === 'completed');
  assert.strictEqual(activeForm, 'Account B draft');
  activeForm = jobA.result.account;
  assert.strictEqual(activeForm, 'A');

  // Integration contract: input is cleared only after the persisted enqueue resolves.
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const enqueueAt = html.indexOf('await queue.enqueue(files');
  const clearAt = html.indexOf("input.value = ''", enqueueAt);
  assert(enqueueAt >= 0 && clearAt > enqueueAt, 'file input must clear after durable enqueue');
  assert(html.includes('applyCompletedScanResult'), 'completed results require an explicit load action');

  console.log('AI scan queue persistence, recovery, FIFO, retry, isolation, and input reset tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
