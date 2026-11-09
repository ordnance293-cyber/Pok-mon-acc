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

    // Treat the focused verifier as additional evidence, not the sole source of truth.
    // A failed or unreadable verification must never silently erase a usable first-pass value.
    const reconcileMaxCategoryEvidence = (records = [], primaryCounts = {}) => {
        const result = { dyna: '', giga: '', audited_fields: [], review_messages: { dyna: '', giga: '' } };
        const relevant = Array.isArray(records) ? records : [];
        const initial = {
            dyna: normalizeExactCount(primaryCounts?.dyna),
            giga: normalizeExactCount(primaryCounts?.giga)
        };
        const hasOverview = relevant.some(record => record?.image_type === 'CATEGORY_OVERVIEW_SCREEN');
        const identicalOverviewCounts = hasOverview && initial.dyna !== '' && initial.dyna !== '0'
            && initial.dyna === initial.giga;

        for (const field of ['dyna', 'giga']) {
            const applicable = relevant.filter(record => expectedFields(record?.image_type).includes(field));
            if (!applicable.length) continue;
            result.audited_fields.push(field);

            const verifiedCounts = [...new Set(applicable
                .map(record => normalizeExactCount(record?.values?.[field]))
                .filter(Boolean))];

            if (verifiedCounts.length > 1) {
                result.review_messages[field] = `${FIELD_DISPLAY_LABELS[field]}的不同原圖複核結果互相衝突，請核對原圖後手動填入。`;
                continue;
            }
            if (verifiedCounts.length === 1) {
                result[field] = verifiedCounts[0];
                continue;
            }

            // On the overview page, identical initial counts are particularly susceptible
            // to copying the upper row's Dynamax number into the lower Gigantamax row.
            // Keep Dynamax's tentative count but require proof for the duplicate Gigantamax.
            if (field === 'giga' && identicalOverviewCounts) {
                result.review_messages[field] = '超極巨化初步數字與極巨化相同，且原圖複核未確認；請核對原圖後手動填入。';
                continue;
            }
            if (initial[field] !== '') {
                result[field] = initial[field];
                result.review_messages[field] = `${FIELD_DISPLAY_LABELS[field]}已保留初步辨識 ${initial[field]}，高解析度複核未完成，請核對原圖。`;
            } else {
                result.review_messages[field] = `${FIELD_DISPLAY_LABELS[field]}沒有可靠數字，請核對原圖後手動填入。`;
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
