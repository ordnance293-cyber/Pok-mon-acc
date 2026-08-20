'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOLD_ACCOUNT_RETENTION_MS,
  planInventoryReconciliation,
  buildFirebaseInventoryUpdates,
  mapAccountIdsToSheetRows,
  planHourlyTriggerInstallation
} = require('../apps-script/sold-reconcile-logic.js');

const NOW = Date.UTC(2026, 6, 28, 12);
const day = 24 * 60 * 60 * 1000;

function ids(items) {
  return items.map(item => item.uid);
}

async function run() {
  assert.equal(SOLD_ACCOUNT_RETENTION_MS, 14 * day);

  const appsScriptSource = fs.readFileSync(
    path.join(__dirname, '..', 'apps-script', 'hourly-sold-reconcile.gs'),
    'utf8'
  );

  const records = [
    { uid: 'active', accountId: 'active', status: 'active', deleteAt: NOW - 100 * day },
    { uid: 'legacy', accountId: 'legacy', status: 'sold', soldAt: NOW - 100 * day },
    { uid: 'invalid', accountId: 'invalid', status: 'sold', deleteAt: 'bad' },
    { uid: 'malformed', accountId: 'malformed', status: 'sold', deleteAt: true },
    { uid: 'malformed-array', accountId: 'malformed-array', status: 'sold', deleteAt: [NOW] },
    { uid: 'expired', accountId: 'expired', status: 'sold', deleteAt: NOW },
    { uid: 'retained', accountId: 'duplicate', status: 'sold', deleteAt: NOW + 1 },
    { uid: 'duplicate', accountId: 'duplicate', status: 'sold', deleteAt: NOW + day }
  ];

  const plan = planInventoryReconciliation(records, NOW);
  assert.deepEqual(ids(plan.sold), ['legacy', 'invalid', 'expired', 'retained', 'duplicate']);
  assert.deepEqual(ids(plan.expired), ['expired']);
  assert.deepEqual(ids(plan.needsDeleteAt), ['legacy', 'invalid', 'malformed', 'malformed-array']);
  assert.deepEqual(ids(plan.retained), ['retained', 'duplicate']);
  assert.deepEqual(plan.duplicateAccountIds, ['duplicate']);

  const updates = buildFirebaseInventoryUpdates(plan, NOW);
  assert.equal(updates['legacy/deleteAt'], NOW + SOLD_ACCOUNT_RETENTION_MS);
  assert.equal(updates['invalid/deleteAt'], NOW + SOLD_ACCOUNT_RETENTION_MS);
  assert.equal(updates.expired, null);
  assert.equal(Object.keys(updates).some(key => key === 'legacy'), false);
  assert.equal(Object.keys(updates).some(key => key === 'expired/deleteAt'), false);

  const migratedAndDeleted = records
    .map(item => item.uid === 'legacy' || item.uid === 'invalid' || item.uid === 'malformed' || item.uid === 'malformed-array'
      ? { ...item, deleteAt: NOW + SOLD_ACCOUNT_RETENTION_MS }
      : item)
    .filter(item => item.uid !== 'expired');
  const secondPlan = planInventoryReconciliation(migratedAndDeleted, NOW);
  assert.deepEqual(secondPlan.expired, []);
  assert.deepEqual(secondPlan.needsDeleteAt, []);
  assert.deepEqual(buildFirebaseInventoryUpdates(secondPlan, NOW), {});

  const rowMap = mapAccountIdsToSheetRows([
    { rowNumber: 2, accountId: 'duplicate' },
    { rowNumber: 3, accountId: 'single' },
    { rowNumber: 4, accountId: 'duplicate' }
  ], 'accountId');
  assert.deepEqual(rowMap, { duplicate: [2, 4], single: [3] });

  const triggerPlan = planHourlyTriggerInstallation([
    'hourlySoldReconcile',
    'otherHandler',
    'hourlySoldReconcile'
  ], 'hourlySoldReconcile');
  assert.deepEqual(triggerPlan.removeHandlers, ['hourlySoldReconcile', 'hourlySoldReconcile']);
  assert.equal(triggerPlan.createHourlyTrigger, true);
  assert.match(appsScriptSource, /LockService\.getScriptLock\(\)/);
  assert.match(appsScriptSource, /X-Firebase-ETag/);
  assert.match(appsScriptSource, /If-Match/);
  assert.match(appsScriptSource, /SOLD_SHEET_DELETE_QUEUE/);
  assert.match(appsScriptSource, /\.everyHours\(1\)/);

  assert.throws(() => planInventoryReconciliation([], NaN), /positive finite timestamp/);

  console.log('PASS Apps Script SOLD reconciliation tests');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
