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

function ids(items) {
  return items.map(item => item.uid);
}

async function run() {
  assert.equal(SOLD_ACCOUNT_RETENTION_MS, 14 * day);

  const active = { uid: 'active', status: 'active', soldAt: NOW - 100 * day, deleteAt: NOW - day };
  const legacyOldSoldAt = { uid: 'legacy-old-soldAt', status: 'sold', soldAt: NOW - 100 * day };
  const missingDeleteAt = { uid: 'missing-deleteAt', status: 'sold' };
  const invalidDeleteAt = { uid: 'invalid-deleteAt', status: 'sold', deleteAt: 'unknown' };
  const malformedDeleteAt = { uid: 'malformed-deleteAt', status: 'sold', deleteAt: true };
  const malformedArrayDeleteAt = { uid: 'malformed-array-deleteAt', status: 'sold', deleteAt: [NOW] };
  const retained = { uid: 'retained', status: 'sold', soldAt: NOW - day, deleteAt: NOW + day };
  const boundary = { uid: 'boundary', status: 'sold', deleteAt: NOW };
  const oneMillisecondLater = { uid: 'one-millisecond-later', status: 'sold', deleteAt: NOW + 1 };

  const plan = planSoldAccountCleanup([
    active,
    legacyOldSoldAt,
    missingDeleteAt,
    invalidDeleteAt,
    malformedDeleteAt,
    malformedArrayDeleteAt,
    retained,
    boundary,
    oneMillisecondLater
  ], NOW);

  assert.deepEqual(ids(plan.expired), ['boundary']);
  assert.deepEqual(ids(plan.needsDeleteAt), [
    'legacy-old-soldAt',
    'missing-deleteAt',
    'invalid-deleteAt',
    'malformed-deleteAt',
    'malformed-array-deleteAt'
  ]);
  assert.equal(plan.needsDeleteAt.includes(boundary), false);
  assert.equal(plan.needsDeleteAt.includes(retained), false);
  assert.equal(plan.expired.includes(legacyOldSoldAt), false);
  assert.equal(plan.expired.includes(active), false);

  assert.throws(() => planSoldAccountCleanup([], NaN), /positive finite timestamp/);

  const productionSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const bulkRepaintStart = productionSource.indexOf('window.bulkMarkAsSold = async function');
  const bulkRepaintEnd = productionSource.indexOf('\n        window.showCopyModal', bulkRepaintStart);
  assert.ok(bulkRepaintStart >= 0 && bulkRepaintEnd > bulkRepaintStart,
    'the existing manual repaint function remains present');
  const bulkRepaintSource = productionSource.slice(bulkRepaintStart, bulkRepaintEnd);
  assert.match(productionSource, /if \(!hasRunSoldAccountCleanup\)/,
    'the initial Firebase snapshot triggers cleanup');
  assert.doesNotMatch(productionSource, /setInterval/,
    'cleanup is not repeated during the page lifecycle');
  assert.match(productionSource, /status: 'active', soldAt: null, deleteAt: null/,
    'restoring an account clears both retention fields');
  assert.match(productionSource, /needsDeleteAt/,
    'the frontend migrates legacy deleteAt values');
  assert.match(productionSource, /updates\[`\$\{item\.uid\}\/deleteAt`\] = now \+ window\.SoldAccountCleanup\.SOLD_ACCOUNT_RETENTION_MS/,
    'legacy records receive a fresh deleteAt in the caller');
  assert.match(productionSource, /updates\[item\.uid\] = null/,
    'expired records use a multi-location null update');
  assert.match(productionSource, /await update\(inventoryRef, updates\)/,
    'the cleanup applies one Firebase batch');
  assert.match(productionSource, /status: 'sold', soldAt, deleteAt/,
    'new sales persist soldAt and deleteAt together');
  assert.match(productionSource, /const deleteAt = [\s\S]*now \+ window\.SoldAccountCleanup\.SOLD_ACCOUNT_RETENTION_MS/,
    'new sales calculate deleteAt from the same now value');
  assert.match(productionSource, /body: JSON\.stringify\(\{ action: 'delete', id: sheetId, accountId: item\.accountId \}\)/,
    'expired records keep the existing Sheet deletion integration');
  assert.match(productionSource, /const BATCH = 10/,
    'manual repaint keeps the existing 10-at-a-time fallback');
  assert.match(productionSource, /body: JSON\.stringify\(\{ action: 'sold', id: sheetId, accountId: item\.accountId \}\)/,
    'manual repaint keeps the deployed SOLD request contract');
  assert.doesNotMatch(bulkRepaintSource, /soldAt|deleteAt/,
    'manual repaint does not reset either retention timer');
  assert.doesNotMatch(productionSource, /action: 'reconcileSold'/,
    'the frontend does not guess a new deployed bulk action');

  console.log('PASS sold-account cleanup tests');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
