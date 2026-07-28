(function (global) {
    'use strict';

    const SOLD_ACCOUNT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

    function validTimestamp(value) {
        const timestamp = Number(value);
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }

    function planSoldAccountCleanup(items, now = Date.now()) {
        const currentTime = validTimestamp(now);
        if (currentTime === null) throw new TypeError('now must be a positive finite timestamp');

        const expired = [];
        const needsSoldAt = [];
        for (const item of Array.isArray(items) ? items : []) {
            if (!item || item.status !== 'sold' || !item.uid) continue;
            const soldAt = validTimestamp(item.soldAt);
            if (soldAt === null) {
                needsSoldAt.push(item);
            } else if (soldAt <= currentTime - SOLD_ACCOUNT_RETENTION_MS) {
                expired.push(item);
            }
        }
        return { expired, needsSoldAt };
    }

    const api = { SOLD_ACCOUNT_RETENTION_MS, planSoldAccountCleanup };
    global.SoldAccountCleanup = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
