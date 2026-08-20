(function (global) {
    'use strict';

    const SOLD_ACCOUNT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

    function validTimestamp(value) {
        const timestamp = typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
                ? Number(value)
                : NaN;
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }

    function planInventoryReconciliation(items, now) {
        const currentTime = validTimestamp(now);
        if (currentTime === null) throw new TypeError('now must be a positive finite timestamp');

        const sold = [];
        const expired = [];
        const needsDeleteAt = [];
        const retained = [];
        const duplicateAccountIds = [];
        const seenAccountIds = new Set();
        const duplicateAccountIdSet = new Set();

        for (const item of Array.isArray(items) ? items : []) {
            if (!item || item.status !== 'sold' || !item.uid) continue;
            sold.push(item);

            const accountId = item.accountId === undefined || item.accountId === null
                ? ''
                : String(item.accountId).trim();
            if (accountId) {
                if (seenAccountIds.has(accountId) && !duplicateAccountIdSet.has(accountId)) {
                    duplicateAccountIds.push(accountId);
                    duplicateAccountIdSet.add(accountId);
                }
                seenAccountIds.add(accountId);
            }

            const deleteAt = validTimestamp(item.deleteAt);
            if (deleteAt === null) {
                needsDeleteAt.push(item);
            } else if (deleteAt <= currentTime) {
                expired.push(item);
            } else {
                retained.push(item);
            }
        }

        return { sold, expired, needsDeleteAt, retained, duplicateAccountIds };
    }

    function buildFirebaseInventoryUpdates(plan, now) {
        const currentTime = validTimestamp(now);
        if (currentTime === null) throw new TypeError('now must be a positive finite timestamp');

        const updates = {};
        const expiredUids = new Set((plan && Array.isArray(plan.expired) ? plan.expired : [])
            .filter(item => item && item.uid)
            .map(item => item.uid));

        for (const item of plan && Array.isArray(plan.needsDeleteAt) ? plan.needsDeleteAt : []) {
            if (!item || !item.uid || expiredUids.has(item.uid)) continue;
            updates[`${item.uid}/deleteAt`] = currentTime + SOLD_ACCOUNT_RETENTION_MS;
        }
        for (const item of plan && Array.isArray(plan.expired) ? plan.expired : []) {
            if (!item || !item.uid) continue;
            updates[item.uid] = null;
        }
        return updates;
    }

    function mapAccountIdsToSheetRows(rows, accountIdField = 'accountId') {
        const rowMap = {};
        for (const row of Array.isArray(rows) ? rows : []) {
            if (!row) continue;
            const rawAccountId = row[accountIdField];
            const accountId = rawAccountId === undefined || rawAccountId === null
                ? ''
                : String(rawAccountId).trim();
            const rowNumber = Number(row.rowNumber);
            if (!accountId || !Number.isInteger(rowNumber) || rowNumber < 1) continue;
            if (!rowMap[accountId]) rowMap[accountId] = [];
            rowMap[accountId].push(rowNumber);
        }
        Object.keys(rowMap).forEach(accountId => {
            rowMap[accountId].sort((a, b) => a - b);
        });
        return rowMap;
    }

    function planHourlyTriggerInstallation(existingHandlers, handlerName = 'hourlySoldReconcile') {
        const removeHandlers = (Array.isArray(existingHandlers) ? existingHandlers : [])
            .filter(name => name === handlerName);
        return { removeHandlers, createHourlyTrigger: true };
    }

    const api = {
        SOLD_ACCOUNT_RETENTION_MS,
        validTimestamp,
        planInventoryReconciliation,
        buildFirebaseInventoryUpdates,
        mapAccountIdsToSheetRows,
        planHourlyTriggerInstallation
    };

    global.SoldReconcileLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
