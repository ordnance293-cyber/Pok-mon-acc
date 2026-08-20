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

    function isFormatterReadyPropertyValue(value) {
        return value === 'true';
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

    function applyInventoryReconciliationToSnapshot(snapshot, plan, now) {
        const currentTime = validTimestamp(now);
        if (currentTime === null) throw new TypeError('now must be a positive finite timestamp');
        if (snapshot === null) return null;
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
            throw new TypeError('inventory snapshot must be an object or null');
        }

        const result = {};
        Object.keys(snapshot).forEach(uid => {
            const record = snapshot[uid];
            result[uid] = record && typeof record === 'object' && !Array.isArray(record)
                ? { ...record }
                : record;
        });

        const expiredUids = new Set((plan && Array.isArray(plan.expired) ? plan.expired : [])
            .filter(item => item && item.uid)
            .map(item => item.uid));

        for (const item of plan && Array.isArray(plan.needsDeleteAt) ? plan.needsDeleteAt : []) {
            if (!item || !item.uid || expiredUids.has(item.uid)) continue;
            const record = result[item.uid];
            if (!record || typeof record !== 'object' || Array.isArray(record) || record.status !== 'sold') continue;
            if (validTimestamp(record.deleteAt) === null) {
                record.deleteAt = currentTime + SOLD_ACCOUNT_RETENTION_MS;
            }
        }

        for (const item of plan && Array.isArray(plan.expired) ? plan.expired : []) {
            if (!item || !item.uid) continue;
            const record = result[item.uid];
            const deleteAt = record && typeof record === 'object' && !Array.isArray(record)
                ? validTimestamp(record.deleteAt)
                : null;
            if (record && typeof record === 'object' && !Array.isArray(record)
                && record.status === 'sold' && deleteAt !== null && deleteAt <= currentTime) {
                delete result[item.uid];
            }
        }

        return result;
    }

    function runConditionalSnapshotTransaction(options) {
        if (!options || typeof options !== 'object') throw new TypeError('transaction options are required');
        if (typeof options.readSnapshot !== 'function'
            || typeof options.buildPlan !== 'function'
            || typeof options.conditionalWrite !== 'function') {
            throw new TypeError('transaction callbacks are required');
        }

        const configuredAttempts = options.maxAttempts === undefined ? 3 : Number(options.maxAttempts);
        if (!Number.isInteger(configuredAttempts) || configuredAttempts < 1) {
            throw new TypeError('maxAttempts must be a positive integer');
        }

        let conflicts = 0;
        for (let attempt = 1; attempt <= configuredAttempts; attempt += 1) {
            const snapshot = options.readSnapshot(attempt);
            const plan = options.buildPlan(snapshot, attempt);
            const writeResult = options.conditionalWrite(plan, attempt);
            if (writeResult && writeResult.conflict === true) {
                conflicts += 1;
                continue;
            }

            const sideEffects = typeof options.afterCommit === 'function'
                ? options.afterCommit(plan, attempt, writeResult)
                : undefined;
            return {
                committed: true,
                attempts: attempt,
                conflicts,
                plan,
                writeResult,
                sideEffects
            };
        }

        return {
            committed: false,
            attempts: configuredAttempts,
            conflicts,
            plan: null,
            writeResult: null,
            sideEffects: undefined
        };
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
        isFormatterReadyPropertyValue,
        planInventoryReconciliation,
        buildFirebaseInventoryUpdates,
        applyInventoryReconciliationToSnapshot,
        runConditionalSnapshotTransaction,
        mapAccountIdsToSheetRows,
        planHourlyTriggerInstallation
    };

    global.SoldReconcileLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
