(function (global) {
    'use strict';

    const HUNDO_LEGENDARY_QUERY = '傳說的寶可夢,幻,究極異獸&4*';
    const SMART_IMAGE_TYPE = 'HUNDO_LEGENDARY_SCREEN';
    const INDEPENDENT_STATE_VALUES = new Set(['yes', 'no', 'uncertain']);
    const ROCKET_STATE_VALUES = new Set(['normal', 'shadow', 'purified', 'uncertain']);
    const BACKGROUND_TYPE_VALUES = new Set(['none', 'commemorative', 'special', 'uncertain']);
    const EFFECTIVE_STATE_DEFAULTS = Object.freeze({
        shiny: 'uncertain',
        lucky: 'uncertain',
        favorite: 'uncertain',
        rocket: 'uncertain',
        background: 'uncertain'
    });
    const REGION_VISIBILITY_VALUES = new Set(['clear', 'partially_occluded', 'cropped', 'not_visible', 'uncertain']);
    const SHINY_POSITION_VALUES = new Set(['none', 'cp_area', 'lower_left', 'upper_right', 'around_pokemon', 'other', 'uncertain']);
    const SHINY_COLOR_VALUES = new Set(['none', 'dark_blue', 'blue_black', 'teal_blue', 'dark_blue_teal', 'light_cyan', 'yellow', 'purple', 'other', 'uncertain']);
    const SHINY_SHAPE_VALUES = new Set(['none', 'multiple_four_point_sparkles', 'single_radial_sparkle', 'five_point_star', 'flame_or_smoke', 'other', 'uncertain']);
    const LUCKY_POSITION_VALUES = new Set(['none', 'behind_pokemon', 'other', 'uncertain']);
    const LUCKY_APPEARANCE_VALUES = new Set(['none', 'large_gold_shimmering_background', 'other', 'uncertain']);
    const FAVORITE_POSITION_VALUES = new Set(['none', 'upper_right', 'other', 'uncertain']);
    const FAVORITE_APPEARANCE_VALUES = new Set(['none', 'filled_yellow_five_point_star', 'other', 'uncertain']);
    const ROCKET_POSITION_VALUES = new Set(['none', 'lower_left', 'lower_side', 'around_pokemon', 'other', 'uncertain']);
    const ROCKET_COLOR_VALUES = new Set(['none', 'light_blue', 'light_cyan', 'purple', 'other', 'uncertain']);
    const ROCKET_SHAPE_VALUES = new Set(['none', 'single_radial_sparkle', 'purification_starburst', 'flower_like_symbol', 'purple_flame', 'purple_smoke', 'shadow_aura', 'other', 'uncertain']);
    const BACKGROUND_POSITION_VALUES = new Set(['none', 'near_pokemon_or_card_background', 'other', 'uncertain']);
    const BADGE_TYPE_VALUES = new Set(['none', 'commemorative_location_badge', 'special_background_badge', 'other', 'uncertain']);
    const BACKGROUND_APPEARANCE_VALUES = new Set(['none', 'location_style_background', 'event_special_background', 'other', 'uncertain']);
    const STATE_VALUES = INDEPENDENT_STATE_VALUES;
    const RECOGNITION_VALUES = new Set(['recognized', 'partial', 'uncertain']);

    const stringValue = (value) => value === undefined || value === null ? '' : String(value).trim();

    const normalizeSearchQuery = (value) => String(value || '')
        .normalize('NFKC')
        .replace(/，/g, ',')
        .replace(/＆/g, '&')
        .replace(/＊/g, '*')
        .replace(/[\s\p{White_Space}]+/gu, '');

    const isSmartHundoClassification = (classification = {}) => (
        classification?.image_type === SMART_IMAGE_TYPE
        && normalizeSearchQuery(classification?.search_query) === HUNDO_LEGENDARY_QUERY
    );

    const partitionImageJobs = (jobs = []) => (Array.isArray(jobs) ? jobs : []).reduce((partitioned, job) => {
        partitioned[isSmartHundoClassification(job?.classification) ? 'smartHundoJobs' : 'normalJobs'].push(job);
        return partitioned;
    }, { normalJobs: [], smartHundoJobs: [] });

    const clampConfidence = (value) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.min(1, Math.max(0, number));
    };

    const normalizeCoordinate = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.trunc(number) : 0;
    };

    const normalizeSmartHundoCoordinate = (value) => {
        const number = Number(value);
        return Number.isInteger(number) && number >= 1 ? number : 0;
    };

    const normalizeCount = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
    };

    const normalizeState = (value) => {
        const state = stringValue(value).toLowerCase();
        return STATE_VALUES.has(state) ? state : 'uncertain';
    };

    const normalizeRawValue = (value, fallback = 'uncertain') => {
        const normalized = stringValue(value).toLowerCase();
        return normalized || fallback;
    };

    const normalizeEnum = (value, values, fallback = 'uncertain') => {
        const normalized = normalizeRawValue(value, fallback);
        return values.has(normalized) ? normalized : fallback;
    };

    const normalizeIndependentState = (value) => normalizeEnum(value, INDEPENDENT_STATE_VALUES);
    const normalizeRocketState = (value) => normalizeEnum(value, ROCKET_STATE_VALUES);
    const normalizeBackgroundType = (value) => normalizeEnum(value, BACKGROUND_TYPE_VALUES);

    const adaptLegacyRocketState = (card = {}) => {
        const shadow = stringValue(card?.shadow_state).toLowerCase();
        const purified = stringValue(card?.purified_state).toLowerCase();
        if (!['yes', 'no'].includes(shadow) || !['yes', 'no'].includes(purified)) return 'uncertain';
        if (shadow === 'yes' && purified === 'no') return 'shadow';
        if (shadow === 'no' && purified === 'yes') return 'purified';
        if (shadow === 'no' && purified === 'no') return 'normal';
        return 'uncertain';
    };

    const normalizeShinyEvidence = (evidence = {}) => ({
        present: evidence?.present === true,
        region_visibility: normalizeEnum(evidence?.region_visibility, REGION_VISIBILITY_VALUES),
        position: normalizeEnum(evidence?.position, SHINY_POSITION_VALUES, 'none'),
        color: normalizeEnum(evidence?.color, SHINY_COLOR_VALUES, 'none'),
        shape: normalizeEnum(evidence?.shape, SHINY_SHAPE_VALUES, 'none')
    });

    const normalizeLuckyEvidence = (evidence = {}) => ({
        present: evidence?.present === true,
        region_visibility: normalizeEnum(evidence?.region_visibility, REGION_VISIBILITY_VALUES),
        position: normalizeEnum(evidence?.position, LUCKY_POSITION_VALUES, 'none'),
        appearance: normalizeEnum(evidence?.appearance, LUCKY_APPEARANCE_VALUES, 'none')
    });

    const normalizeFavoriteEvidence = (evidence = {}) => ({
        present: evidence?.present === true,
        region_visibility: normalizeEnum(evidence?.region_visibility, REGION_VISIBILITY_VALUES),
        position: normalizeEnum(evidence?.position, FAVORITE_POSITION_VALUES, 'none'),
        appearance: normalizeEnum(evidence?.appearance, FAVORITE_APPEARANCE_VALUES, 'none')
    });

    const normalizeRocketEvidence = (evidence = {}) => ({
        present: evidence?.present === true,
        region_visibility: normalizeEnum(evidence?.region_visibility, REGION_VISIBILITY_VALUES),
        position: normalizeEnum(evidence?.position, ROCKET_POSITION_VALUES, 'none'),
        color: normalizeEnum(evidence?.color, ROCKET_COLOR_VALUES, 'none'),
        shape: normalizeEnum(evidence?.shape, ROCKET_SHAPE_VALUES, 'none')
    });

    const normalizeBackgroundEvidence = (evidence = {}) => ({
        present: evidence?.present === true,
        region_visibility: normalizeEnum(evidence?.region_visibility, REGION_VISIBILITY_VALUES),
        position: normalizeEnum(evidence?.position, BACKGROUND_POSITION_VALUES, 'none'),
        badge_type: normalizeEnum(evidence?.badge_type, BADGE_TYPE_VALUES, 'none'),
        appearance: normalizeEnum(evidence?.appearance, BACKGROUND_APPEARANCE_VALUES, 'none')
    });

    const normalizeRecognitionStatus = (value) => {
        const status = stringValue(value).toLowerCase();
        return RECOGNITION_VALUES.has(status) ? status : 'uncertain';
    };

    const normalizeWith = (normalizer, value) => {
        const normalized = typeof normalizer === 'function' ? normalizer(value) : value;
        return stringValue(normalized);
    };

    const normalizeSmartHundoCard = (card = {}, normalizeOfficialName, options = {}) => {
        const screenshotIndex = normalizeCoordinate(options?.screenshotIndex);
        const hasRocketState = card?.rocket_state !== undefined && card?.rocket_state !== null;
        const rawStates = {
            shiny: normalizeRawValue(card?.shiny_state),
            lucky: normalizeRawValue(card?.lucky_state),
            favorite: normalizeRawValue(card?.favorite_state),
            rocket: hasRocketState ? normalizeRawValue(card?.rocket_state) : adaptLegacyRocketState(card),
            background: normalizeRawValue(card?.background_type)
        };
        const rawConfidences = {
            shiny: card?.shiny_confidence,
            lucky: card?.lucky_confidence,
            favorite: card?.favorite_confidence,
            rocket: card?.rocket_confidence,
            background: card?.background_confidence
        };
        const rawEvidence = {
            shiny: normalizeShinyEvidence(card?.shiny_evidence),
            lucky: normalizeLuckyEvidence(card?.lucky_evidence),
            favorite: normalizeFavoriteEvidence(card?.favorite_evidence),
            rocket: normalizeRocketEvidence(card?.rocket_evidence),
            background: normalizeBackgroundEvidence(card?.background_evidence)
        };
        const order = normalizeSmartHundoCoordinate(card?.order);
        const row = normalizeSmartHundoCoordinate(card?.row);
        const column = normalizeSmartHundoCoordinate(card?.column);

        return {
            screenshot_index: screenshotIndex,
            card_id: `${screenshotIndex}:${order}:${row}:${column}`,
            order,
            row,
            column,
            visible_label: stringValue(card?.visible_label),
            official_name: normalizeWith(normalizeOfficialName, card?.official_name),
            recognition_status: normalizeRecognitionStatus(card?.recognition_status),
            species_confidence: clampConfidence(card?.species_confidence),
            cp: stringValue(card?.cp),
            shiny_state: normalizeIndependentState(rawStates.shiny),
            shiny_confidence: clampConfidence(rawConfidences.shiny),
            lucky_state: normalizeIndependentState(rawStates.lucky),
            lucky_confidence: clampConfidence(rawConfidences.lucky),
            favorite_state: normalizeIndependentState(rawStates.favorite),
            favorite_confidence: clampConfidence(rawConfidences.favorite),
            rocket_state: normalizeRocketState(rawStates.rocket),
            rocket_confidence: clampConfidence(rawConfidences.rocket),
            background_type: normalizeBackgroundType(rawStates.background),
            background_confidence: clampConfidence(rawConfidences.background),
            shiny_evidence: rawEvidence.shiny,
            lucky_evidence: rawEvidence.lucky,
            favorite_evidence: rawEvidence.favorite,
            rocket_evidence: rawEvidence.rocket,
            background_evidence: rawEvidence.background,
            effective_shiny_state: EFFECTIVE_STATE_DEFAULTS.shiny,
            effective_lucky_state: EFFECTIVE_STATE_DEFAULTS.lucky,
            effective_favorite_state: EFFECTIVE_STATE_DEFAULTS.favorite,
            effective_rocket_state: EFFECTIVE_STATE_DEFAULTS.rocket,
            effective_background_type: EFFECTIVE_STATE_DEFAULTS.background,
            manual_review_reasons: [],
            raw: {
                states: rawStates,
                confidences: rawConfidences,
                evidence: rawEvidence
            }
        };
    };

    const normalizeSmartHundoResult = (result = {}, normalizeOfficialName, options = {}) => ({
        detected_card_count: normalizeCount(result?.detected_card_count),
        scan_complete: result?.scan_complete === true,
        bottom_edge_checked: result?.bottom_edge_checked === true,
        enumeration_confidence: clampConfidence(result?.enumeration_confidence),
        cards: (Array.isArray(result?.cards) ? result.cards : [])
            .map(card => normalizeSmartHundoCard(card, normalizeOfficialName, options))
    });

    const normalizeCard = (card = {}, normalizeOfficialName) => ({
        order: normalizeCoordinate(card?.order),
        row: normalizeCoordinate(card?.row),
        column: normalizeCoordinate(card?.column),
        visible_label: stringValue(card?.visible_label),
        official_name: normalizeWith(normalizeOfficialName, card?.official_name),
        recognition_status: normalizeRecognitionStatus(card?.recognition_status),
        species_confidence: clampConfidence(card?.species_confidence),
        shiny_state: normalizeState(card?.shiny_state),
        shiny_confidence: clampConfidence(card?.shiny_confidence),
        purified_state: normalizeState(card?.purified_state),
        purified_confidence: clampConfidence(card?.purified_confidence),
        shadow_state: normalizeState(card?.shadow_state),
        shadow_confidence: clampConfidence(card?.shadow_confidence)
    });

    const compareCards = (left, right) => (
        left.order - right.order
        || left.row - right.row
        || left.column - right.column
    );

    const normalizeCards = (cards, normalizeOfficialName) => {
        const seen = new Set();
        return (Array.isArray(cards) ? cards : [])
            .map(card => normalizeCard(card, normalizeOfficialName))
            .filter(card => {
                const position = `${card.order}|${card.row}|${card.column}`;
                const identity = `${position}|${JSON.stringify(card)}`;
                if (seen.has(identity)) return false;
                seen.add(identity);
                return true;
            })
            .sort(compareCards);
    };

    const normalizeLegacySmartHundoResult = (result = {}, normalizeNumber, normalizeOfficialName) => ({
        hundo_leg: normalizeWith(normalizeNumber, result?.hundo_leg),
        hundo_leg_confidence: clampConfidence(result?.hundo_leg_confidence),
        detected_card_count: normalizeCount(result?.detected_card_count),
        cards: normalizeCards(result?.cards, normalizeOfficialName)
    });

    const HUNDO_REVIEW_REASON_MESSAGES = Object.freeze({
        species_uncertain: '物種需人工確認',
        shiny_uncertain: '色違狀態需人工確認',
        lucky_uncertain: '亮晶晶狀態需人工確認',
        favorite_uncertain: '我的最愛狀態需人工確認',
        rocket_state_uncertain: '暗影／淨化狀態需人工確認',
        background_uncertain: '背卡狀態需人工確認',
        incomplete_card_enumeration: '卡片列舉不完整，需人工確認',
        hundo_count_uncertain: '百神總數需人工確認',
        hundo_count_conflict: '百神總數結果衝突',
        screenshot_overlap_uncertain: '截圖重疊需人工確認',
        smart_hundo_request_failed: '百神辨識請求失敗'
    });

    const isHundoReviewReason = (reason) => Object.prototype.hasOwnProperty.call(HUNDO_REVIEW_REASON_MESSAGES, reason);

    const reviewReasonCodes = (card = {}) => {
        const reasons = Array.isArray(card?.manual_review_reasons)
            ? card.manual_review_reasons.filter(isHundoReviewReason)
            : [];
        const officialName = stringValue(card?.official_name);
        if (card?.recognition_status !== 'recognized' || !officialName) reasons.push('species_uncertain');
        if (card?.effective_shiny_state === 'uncertain') reasons.push('shiny_uncertain');
        if (card?.effective_lucky_state === 'uncertain') reasons.push('lucky_uncertain');
        if (card?.effective_favorite_state === 'uncertain') reasons.push('favorite_uncertain');
        if (card?.effective_rocket_state === 'uncertain') reasons.push('rocket_state_uncertain');
        if (card?.effective_background_type === 'uncertain') reasons.push('background_uncertain');
        return [...new Set(reasons)];
    };

    const screenshotReviewReasonCodes = (screenshotReasons) => {
        const reasons = Array.isArray(screenshotReasons)
            ? screenshotReasons
            : Array.isArray(screenshotReasons?.manual_review_reasons)
                ? screenshotReasons.manual_review_reasons
                : Array.isArray(screenshotReasons?.reasons)
                    ? screenshotReasons.reasons
                    : [];
        return reasons.filter(isHundoReviewReason);
    };

    const buildHundoDisplayName = (card = {}, normalizeOfficialName) => {
        const officialName = normalizeWith(normalizeOfficialName, card?.official_name);
        const prefix = [
            card?.effective_shiny_state === 'yes' ? '色違' : '',
            card?.effective_rocket_state === 'shadow' ? '暗影' : '',
            card?.effective_background_type === 'commemorative' ? '紀念背卡' : '',
            card?.effective_background_type === 'special' ? '特別背卡' : ''
        ].join('');
        return `${prefix}${officialName}`;
    };

    const summarizeHundoManualReview = (cards = [], screenshotReasons = []) => {
        const reviewCardIds = new Set();
        const reviewReasonCounts = {};
        const reasonCodes = [];
        const addReason = (reason, cardId) => {
            reviewReasonCounts[reason] = (reviewReasonCounts[reason] || 0) + 1;
            if (!reasonCodes.includes(reason)) reasonCodes.push(reason);
            if (cardId) reviewCardIds.add(cardId);
        };

        (Array.isArray(cards) ? cards : []).forEach(card => {
            const cardId = stringValue(card?.card_id);
            reviewReasonCodes(card).forEach(reason => addReason(reason, cardId));
        });
        screenshotReviewReasonCodes(screenshotReasons).forEach(reason => addReason(reason));

        return {
            review_card_count: reviewCardIds.size,
            review_reason_counts: reviewReasonCounts,
            manual_review_reasons: reasonCodes.map(reason => HUNDO_REVIEW_REASON_MESSAGES[reason])
        };
    };

    const smartHundoCardsToPokemonList = (cards = [], normalizeOfficialName) => {
        const displayGroups = new Map();
        let recognizedCount = 0;

        (Array.isArray(cards) ? cards : []).forEach(card => {
            const officialName = normalizeWith(normalizeOfficialName, card?.official_name);
            if (card?.recognition_status !== 'recognized' || !officialName) return;

            const displayName = buildHundoDisplayName(card, normalizeOfficialName);
            displayGroups.set(displayName, (displayGroups.get(displayName) || 0) + 1);
            recognizedCount += 1;
        });

        const manualReview = summarizeHundoManualReview(cards);
        return {
            pokemon_list: [...displayGroups].map(([name, count]) => count > 1 ? `${name}*${count}` : name).join(','),
            recognized_count: recognizedCount,
            review_card_count: manualReview.review_card_count,
            review_reason_counts: manualReview.review_reason_counts
        };
    };

    const legacySmartHundoCardsToPokemonList = (cards = [], normalizeOfficialName, normalizePokemonList) => {
        const normalizedCards = (Array.isArray(cards) ? cards : [])
            .map(card => normalizeCard(card, normalizeOfficialName))
            .sort(compareCards);
        const usableNames = [];
        let uncertainCount = 0;
        let recognizedCount = 0;

        normalizedCards.forEach(card => {
            const usable = card.recognition_status === 'recognized' && card.official_name !== '';
            const hasUncertainState = [card.shiny_state, card.purified_state, card.shadow_state].includes('uncertain');
            if (!usable || hasUncertainState) uncertainCount += 1;
            if (!usable) return;

            const officialName = normalizeWith(normalizeOfficialName, card.official_name);
            if (!officialName) {
                uncertainCount += hasUncertainState ? 0 : 1;
                return;
            }
            const prefix = `${card.shiny_state === 'yes' ? '色違' : ''}${card.shadow_state === 'yes' ? '暗影' : ''}`;
            usableNames.push(`${prefix}${officialName}`);
            recognizedCount += 1;
        });

        const rawList = usableNames.join(',');
        return {
            pokemon_list: normalizeWith(normalizePokemonList, rawList),
            uncertain_count: uncertainCount,
            recognized_count: recognizedCount
        };
    };

    const mergeSmartHundoScanResults = (results = [], normalizeNumber, normalizeOfficialName, normalizePokemonList) => {
        const normalizedResults = (Array.isArray(results) ? results : [])
            .map(result => normalizeLegacySmartHundoResult(result, normalizeNumber, normalizeOfficialName));
        const hundoLegValues = normalizedResults.map(result => result.hundo_leg).filter(Boolean);
        const cards = normalizedResults.flatMap(result => result.cards);
        const conversion = legacySmartHundoCardsToPokemonList(cards, normalizeOfficialName, normalizePokemonList);

        return {
            hundo_leg: hundoLegValues[0] || '',
            cards,
            pokemon_list: conversion.pokemon_list,
            uncertain_count: conversion.uncertain_count,
            recognized_count: conversion.recognized_count,
            detected_card_count: normalizedResults.reduce((total, result) => total + result.detected_card_count, 0),
            hundo_leg_conflict: new Set(hundoLegValues).size > 1
        };
    };

    const api = {
        normalizeSearchQuery,
        isSmartHundoClassification,
        partitionImageJobs,
        adaptLegacyRocketState,
        normalizeSmartHundoCard,
        normalizeSmartHundoResult,
        normalizeLegacySmartHundoResult,
        HUNDO_REVIEW_REASON_MESSAGES,
        buildHundoDisplayName,
        smartHundoCardsToPokemonList,
        summarizeHundoManualReview,
        legacySmartHundoCardsToPokemonList,
        mergeSmartHundoScanResults
    };

    global.SmartHundoHelpers = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
