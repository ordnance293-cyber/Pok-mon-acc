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

    const insertRarePresetAtCaret = (value, preset, selectionStart, selectionEnd) => {
        const source = String(value ?? '');
        const target = String(preset ?? '').trim();
        const clampPosition = position => Math.max(
            0,
            Math.min(source.length, Number.isFinite(Number(position)) ? Math.trunc(Number(position)) : source.length)
        );
        const start = clampPosition(selectionStart);
        const end = Math.max(start, clampPosition(selectionEnd));
        if (!target) {
            return { value: source, selectionStart: start, selectionEnd: start };
        }

        const before = source.slice(0, start);
        const after = source.slice(end);
        const beforeSeparator = before && !/(?:\r\n|\n)$/.test(before) ? '\n' : '';
        const afterSeparator = after && !/^(?:\r\n|\n)/.test(after) ? '\n' : '';
        const nextValue = before + beforeSeparator + target + afterSeparator + after;
        const caret = start + beforeSeparator.length + target.length;
        return { value: nextValue, selectionStart: caret, selectionEnd: caret };
    };

    const removeRarePresetLine = (value, preset, selectionStart) => {
        const source = String(value ?? '');
        const target = String(preset ?? '').trim();
        const clampPosition = position => Math.max(
            0,
            Math.min(source.length, Number.isFinite(Number(position)) ? Math.trunc(Number(position)) : source.length)
        );
        const point = clampPosition(selectionStart);
        if (!target) {
            return { value: source, selectionStart: point, selectionEnd: point, removed: false };
        }

        const lines = source.split(/\r?\n/);
        let offset = 0;
        let removeStart = -1;
        let removeEnd = -1;
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const lineStart = offset;
            const lineEnd = lineStart + line.length;
            const hasFollowingBreak = index < lines.length - 1;
            const separatorLength = hasFollowingBreak
                ? (source.slice(lineEnd, lineEnd + 2) === '\r\n' ? 2 : 1)
                : 0;
            if (line.trim() === target) {
                if (hasFollowingBreak) {
                    removeStart = lineStart;
                    removeEnd = lineEnd + separatorLength;
                } else if (lineStart > 0) {
                    const newlineIndex = source.lastIndexOf('\n', lineStart - 1);
                    const previousBreakStart = newlineIndex > 0 && source[newlineIndex - 1] === '\r'
                        ? newlineIndex - 1
                        : newlineIndex;
                    removeStart = previousBreakStart;
                    removeEnd = lineEnd;
                } else {
                    removeStart = lineStart;
                    removeEnd = lineEnd;
                }
                break;
            }
            offset = lineEnd + separatorLength;
        }

        if (removeStart < 0) {
            return { value: source, selectionStart: point, selectionEnd: point, removed: false };
        }

        const nextValue = source.slice(0, removeStart) + source.slice(removeEnd);
        const nextCaret = point <= removeStart
            ? point
            : point >= removeEnd
                ? point - (removeEnd - removeStart)
                : removeStart;
        const caret = Math.min(nextCaret, nextValue.length);
        return { value: nextValue, selectionStart: caret, selectionEnd: caret, removed: true };
    };

    const api = {
        RARE_BACKGROUND_SEARCH_FILTER,
        RARE_BACKGROUND_PREFIX,
        isRareBackgroundSearchQuery,
        normalizeRareBackgroundList,
        mergeRareBackgroundLists,
        insertRarePresetAtCaret,
        removeRarePresetLine
    };

    if (globalScope) globalScope.RareBackgroundScanHelpers = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
