'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOLD_ACCOUNT_RETENTION_MS,
  planSoldAccountCleanup
} = require('../sold-account-cleanup.js');

const NOW = Date.UTC(2026, 6, 28, 12);
const day = 24 * 60 * 60 * 1000;

async function run() {
  assert.equal(SOLD_ACCOUNT_RETENTION_MS, 30 * day);

  const active = { uid: 'active', status: 'active', soldAt: NOW - 90 * day };
  const recent = { uid: 'recent', status: 'sold', soldAt: NOW - 29 * day };
  const boundary = { uid: 'boundary', status: 'sold', soldAt: NOW - 30 * day };
  const old = { uid: 'old', status: 'sold', soldAt: String(NOW - 31 * day) };
  const missing = { uid: 'missing', status: 'sold' };
  const invalid = { uid: 'invalid', status: 'sold', soldAt: 'unknown' };

  const plan = planSoldAccountCleanup([active, recent, boundary, old, missing, invalid], NOW);
  assert.deepEqual(plan.expired.map(item => item.uid), ['boundary', 'old']);
  assert.deepEqual(plan.needsSoldAt.map(item => item.uid), ['missing', 'invalid']);

  assert.throws(() => planSoldAccountCleanup([], NaN), /positive finite timestamp/);

  const productionSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(productionSource, /if \(!hasRunSoldAccountCleanup\)/,
    'the initial Firebase snapshot triggers cleanup');
  assert.doesNotMatch(productionSource, /setInterval/,
    'cleanup is not repeated during the page lifecycle');
  assert.match(productionSource, /\{ status: 'active', soldAt: null \}/,
    'restoring an account clears the old retention clock');
  assert.match(productionSource, /updates\[item\.uid\] = null/,
    'expired records use a multi-location null update');
  assert.match(productionSource, /updates\[`\$\{item\.uid\}\/soldAt`\] = now/,
    'legacy records use a multi-location soldAt update');
  assert.match(productionSource, /await update\(inventoryRef, updates\)/,
    'the cleanup applies one Firebase batch');

  console.log('PASS sold-account cleanup tests');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
