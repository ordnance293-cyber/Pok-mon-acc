'use strict';

(function attachRareBackgroundScanHelpers(globalScope) {
    const RARE_BACKGROUND_SEARCH_FILTER = '極巨化,超極巨化&背卡';
    const RARE_BACKGROUND_PREFIX = '稀有紫黑背卡:';

    const normalizeSearchQuery = value => String(value ?? '')
        .trim()
        .replace(/\s+/g, '');

    const isRareBackgroundSearchQuery = value => (
        normalizeSearchQuery(value) === RARE_BACKGROUND_SEARCH_FILTER
    );

    const stripCodeFence = value => String(value ?? '')
        .replace(/^\s*[\x60]{3}(?:json)?\s*/i, '')
        .replace(/\s*[\x60]{3}\s*$/i, '')
        .trim();

    const parseEntry = value => {
        let token = String(value ?? '').trim();
        if (!token) return null;

        let count = 1;
        const countMatch = token.match(/\s*\*\s*(\d+)\s*$/);
        if (countMatch) {
            count = Number(countMatch[1]);
            token = token.slice(0, countMatch.index).trim();
        }
        if (!Number.isInteger(count) || count < 1) return null;

        const typeMatch = token.match(/^(極巨化|超極巨化)\s*(.+)$/);
        if (!typeMatch) return null;
        const name = typeMatch[2].trim();
        if (!name) return null;
        return { type: typeMatch[1], name, count };
    };

    const parseEntries = value => {
        const raw = stripCodeFence(value)
            .replace(/^稀有紫黑背卡\s*[:：]\s*/u, '');
        if (!raw) return [];
        return raw
            .split(/[,，、\n]+/)
            .map(parseEntry)
            .filter(Boolean);
    };

    const formatEntries = entries => {
        if (!entries.length) return '';
        const grouped = new Map();
        entries.forEach(entry => {
            const key = entry.type + '|' + entry.name;
            const current = grouped.get(key);
            if (current) current.count += entry.count;
            else grouped.set(key, { ...entry });
        });

        const formatted = [...grouped.values()]
            .map(({ type, name, count }) => type + name + (count > 1 ? '*' + count : ''))
            .join(',');
        return formatted ? RARE_BACKGROUND_PREFIX + formatted : '';
    };

    const normalizeRareBackgroundList = value => formatEntries(parseEntries(value));

    const mergeRareBackgroundLists = values => formatEntries(
        (Array.isArray(values) ? values : [values]).flatMap(parseEntries)
    );

    const api = {
        RARE_BACKGROUND_SEARCH_FILTER,
        RARE_BACKGROUND_PREFIX,
        isRareBackgroundSearchQuery,
        normalizeRareBackgroundList,
        mergeRareBackgroundLists
    };

    if (globalScope) globalScope.RareBackgroundScanHelpers = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
