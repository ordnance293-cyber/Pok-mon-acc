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

    function planSoldAccountCleanup(items, now = Date.now()) {
        const currentTime = validTimestamp(now);
        if (currentTime === null) throw new TypeError('now must be a positive finite timestamp');

        const expired = [];
        const needsDeleteAt = [];
        for (const item of Array.isArray(items) ? items : []) {
            if (!item || item.status !== 'sold' || !item.uid) continue;
            const deleteAt = validTimestamp(item.deleteAt);
            if (deleteAt === null) {
                needsDeleteAt.push(item);
            } else if (deleteAt <= currentTime) {
                expired.push(item);
            }
        }
        return { expired, needsDeleteAt };
    }

    const api = { SOLD_ACCOUNT_RETENTION_MS, planSoldAccountCleanup };
    global.SoldAccountCleanup = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
