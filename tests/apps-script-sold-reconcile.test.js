'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOLD_ACCOUNT_RETENTION_MS,
  planInventoryReconciliation,
  buildFirebaseInventoryUpdates,
  applyInventoryReconciliationToSnapshot,
  runConditionalSnapshotTransaction,
  isFormatterReadyPropertyValue,
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
  assert.equal(isFormatterReadyPropertyValue(undefined), false);
  assert.equal(isFormatterReadyPropertyValue(null), false);
  assert.equal(isFormatterReadyPropertyValue('TRUE'), false);
  assert.equal(isFormatterReadyPropertyValue(true), false);
  assert.equal(isFormatterReadyPropertyValue('true'), true);

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
  assert.deepEqual(ids(plan.sold), ['legacy', 'invalid', 'malformed', 'malformed-array', 'expired', 'retained', 'duplicate']);
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

  const completeSnapshot = {
    legacy: {
      status: 'sold',
      soldAt: NOW - 100 * day,
      accountId: 'legacy',
      fullText: 'keep-legacy-data',
      deleteAt: undefined
    },
    expired: {
      status: 'sold',
      soldAt: NOW - 20 * day,
      deleteAt: NOW,
      accountId: 'expired',
      price: 123,
      smartHundo: { preserved: true }
    },
    active: {
      status: 'active',
      deleteAt: NOW - 100 * day,
      soldAt: NOW - 100 * day,
      accountId: 'active',
      unrelated: 'preserve-active'
    },
    retained: {
      status: 'sold',
      deleteAt: NOW + day,
      accountId: 'retained',
      level: 50,
      team: 'blue'
    }
  };
  const completeSnapshotItems = Object.entries(completeSnapshot).map(([uid, item]) => ({ uid, ...item }));
  const completeSnapshotPlan = planInventoryReconciliation(completeSnapshotItems, NOW);
  const mutatedSnapshot = applyInventoryReconciliationToSnapshot(
    completeSnapshot,
    completeSnapshotPlan,
    NOW
  );
  assert.notEqual(mutatedSnapshot, completeSnapshot);
  assert.equal(mutatedSnapshot.expired, undefined);
  assert.deepEqual(mutatedSnapshot.active, completeSnapshot.active);
  assert.deepEqual(mutatedSnapshot.retained, completeSnapshot.retained);
  assert.equal(mutatedSnapshot.legacy.deleteAt, NOW + SOLD_ACCOUNT_RETENTION_MS);
  assert.equal(mutatedSnapshot.legacy.fullText, 'keep-legacy-data');
  assert.deepEqual(mutatedSnapshot.expired, undefined);
  assert.equal(mutatedSnapshot.retained.level, 50);
  assert.equal(mutatedSnapshot.retained.team, 'blue');
  assert.equal(applyInventoryReconciliationToSnapshot(null, plan, NOW), null);

  const retrySnapshots = [
    {
      legacy: { status: 'sold', accountId: 'legacy', soldAt: NOW - 100 * day },
      unchanged: { status: 'active', accountId: 'unchanged', unrelated: { keep: true } }
    },
    {
      legacy: { status: 'active', accountId: 'legacy', soldAt: null, deleteAt: null },
      freshLegacy: { status: 'sold', accountId: 'fresh-legacy', soldAt: NOW - 100 * day }
    }
  ];
  let retryReadIndex = 0;
  let retryPlanCount = 0;
  let retryWriteCount = 0;
  let sheetSideEffects = 0;
  const eventOrder = [];
  const retryResult = runConditionalSnapshotTransaction({
    maxAttempts: 3,
    readSnapshot: () => retrySnapshots[retryReadIndex++],
    buildPlan: snapshot => {
      retryPlanCount += 1;
      const items = Object.entries(snapshot).map(([uid, item]) => ({ uid, ...item }));
      return {
        snapshot,
        plan: planInventoryReconciliation(items, NOW),
        mutated: applyInventoryReconciliationToSnapshot(
          snapshot,
          planInventoryReconciliation(items, NOW),
          NOW
        )
      };
    },
    conditionalWrite: attempt => {
      retryWriteCount += 1;
      eventOrder.push('firebase');
      return { conflict: retryWriteCount === 1, attempt };
    },
    afterCommit: () => {
      sheetSideEffects += 1;
      eventOrder.push('sheet');
    }
  });
  assert.equal(retryResult.committed, true);
  assert.equal(retryResult.conflicts, 1);
  assert.equal(retryResult.attempts, 2);
  assert.equal(retryPlanCount, 2);
  assert.equal(retryWriteCount, 2);
  assert.equal(sheetSideEffects, 1);
  assert.deepEqual(eventOrder, ['firebase', 'firebase', 'sheet']);
  assert.deepEqual(retryResult.plan.plan.sold.map(item => item.uid), ['freshLegacy']);
  assert.deepEqual(retryResult.plan.plan.needsDeleteAt.map(item => item.uid), ['freshLegacy']);

  let exhaustedSheetSideEffects = 0;
  const exhaustedResult = runConditionalSnapshotTransaction({
    maxAttempts: 3,
    readSnapshot: () => ({ only: { status: 'sold', accountId: 'only', deleteAt: NOW + day } }),
    buildPlan: snapshot => ({ snapshot, plan: 'fresh-plan-' + exhaustedSheetSideEffects }),
    conditionalWrite: () => ({ conflict: true }),
    afterCommit: () => {
      exhaustedSheetSideEffects += 1;
    }
  });
  assert.equal(exhaustedResult.committed, false);
  assert.equal(exhaustedResult.conflicts, 3);
  assert.equal(exhaustedResult.attempts, 3);
  assert.equal(exhaustedSheetSideEffects, 0);

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
  assert.match(appsScriptSource, /fetchFirebaseJson_\(config, 'inventory\.json', 'put'/);
  assert.match(appsScriptSource, /MAX_FIREBASE_RECONCILIATION_ATTEMPTS = 3/);
  assert.match(appsScriptSource, /status === 412/);
  assert.doesNotMatch(appsScriptSource, /patchFirebaseInventory_/);
  assert.doesNotMatch(appsScriptSource, /\bpatch\b[\s\S]{0,500}If-Match/i);
  assert.doesNotMatch(appsScriptSource, /If-Match[\s\S]{0,500}\bpatch\b/i);
  assert.match(appsScriptSource, /SOLD_FORMATTER_READY/);
  assert.match(appsScriptSource, /SoldReconcileLogic\.isFormatterReadyPropertyValue\(ready\)/);
  assert.match(appsScriptSource, /installHourlySoldReconcileTrigger\(\)[\s\S]*isSoldFormatterReady_/);
  assert.match(appsScriptSource, /hourlySoldReconcile\(\)[\s\S]*isSoldFormatterReady_/);
  assert.match(appsScriptSource, /SOLD_SHEET_DELETE_QUEUE/);
  assert.match(appsScriptSource, /\.everyHours\(1\)/);
  const firebaseReconcileCall = appsScriptSource.indexOf('var reconciliation = reconcileFirebaseWithRetry_(config);');
  const sheetReconcileCall = appsScriptSource.indexOf('var sheetResult = reconcileSheetAfterFirebaseCommit_(config, attempt);');
  assert.ok(firebaseReconcileCall >= 0 && sheetReconcileCall > firebaseReconcileCall,
    'Sheet reconciliation is ordered after the Firebase transaction');

  assert.throws(() => planInventoryReconciliation([], NaN), /positive finite timestamp/);

  console.log('PASS Apps Script SOLD reconciliation tests');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
