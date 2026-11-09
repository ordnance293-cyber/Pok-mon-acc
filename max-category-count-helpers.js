'use strict';
(function attachMaxCategoryCountHelpers(globalScope) {
    const MAX_CATEGORY_IMAGE_TYPES = Object.freeze([
        'CATEGORY_OVERVIEW_SCREEN', 'DYNA_CATEGORY_SCREEN', 'GIGA_CATEGORY_SCREEN'
    ]);
    const MAX_CATEGORY_FIELDS_BY_TYPE = Object.freeze({
        CATEGORY_OVERVIEW_SCREEN: ['dyna', 'giga'],
        DYNA_CATEGORY_SCREEN: ['dyna'],
        GIGA_CATEGORY_SCREEN: ['giga']
    });
    const EXPECTED_LABELS = Object.freeze({ dyna: '極巨化', giga: '超極巨化' });
    const FIELD_DISPLAY_LABELS = Object.freeze({ dyna: '極巨化', giga: '超極巨化' });

    // A numeric string must come from the label's own count, not a nearby badge or card.
    const normalizeExactCount = value => {
        const raw = String(value ?? '').trim().replace(/[０-９]/g, digit =>
            String(digit.charCodeAt(0) - 0xff10));
        return /^(?:0|[1-9][0-9]{0,5})$/.test(raw) ? raw : '';
    };

    const expectedFields = imageType => MAX_CATEGORY_FIELDS_BY_TYPE[imageType] || [];
    const validateMaxCategoryEvidence = (raw = {}, imageType = '') => {
        const values = { dyna: '', giga: '' };
        const unverified_fields = [];
        for (const field of expectedFields(imageType)) {
            const label = String(raw?.[`${field}_label`] ?? '').replace(/\s+/g, '');
            const count = normalizeExactCount(raw?.[`${field}_count`]);
            // Exact labels matter: 超極巨化 contains 極巨化, but they are NOT interchangeable.
            const valid = label === EXPECTED_LABELS[field]
                && raw?.[`${field}_position`] === 'directly_below_label'
                && count !== '';
            if (valid) values[field] = count;
            else unverified_fields.push(field);
        }
        return { image_type: imageType, values, unverified_fields };
    };

    const reconcileMaxCategoryEvidence = (records = []) => {
        const result = { dyna: '', giga: '', audited_fields: [], review_messages: { dyna: '', giga: '' } };
        for (const field of ['dyna', 'giga']) {
            const applicable = (Array.isArray(records) ? records : []).filter(record =>
                expectedFields(record?.image_type).includes(field));
            if (!applicable.length) continue;
            result.audited_fields.push(field);
            const validCounts = [...new Set(applicable.map(record => record?.values?.[field]).filter(value =>
                normalizeExactCount(value) !== ''))];
            if (validCounts.length === 1 && applicable.every(record => record?.values?.[field] === validCounts[0])) {
                result[field] = validCounts[0];
            } else if (validCounts.length > 1) {
                result.review_messages[field] = `${FIELD_DISPLAY_LABELS[field]}數量在不同截圖間衝突，請核對原圖後手動填入。`;
            } else {
                result.review_messages[field] = `${FIELD_DISPLAY_LABELS[field]}的文字標籤及正下方數字未完成複核，請核對原圖後手動填入。`;
            }
        }
        return result;
    };

    const api = {
        MAX_CATEGORY_IMAGE_TYPES,
        expectedFields,
        normalizeExactCount,
        validateMaxCategoryEvidence,
        reconcileMaxCategoryEvidence
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (globalScope) globalScope.MaxCategoryCountHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
