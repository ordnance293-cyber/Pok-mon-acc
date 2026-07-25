(function (global) {
    'use strict';

    const HUNDO_LEGENDARY_QUERY = '傳說的寶可夢,幻,究極異獸&4*';
    const SMART_IMAGE_TYPE = 'HUNDO_LEGENDARY_SCREEN';
    // Count/enumeration gates are consumed by screenshot-level validation in Task 4.
    const HUNDO_COUNT_CONFIDENCE_THRESHOLD = 0.85;
    const ENUMERATION_CONFIDENCE_THRESHOLD = 0.85;
    // Species and state gates are consumed by card validation and list conversion.
    const SPECIES_CONFIDENCE_THRESHOLD = 0.80;
    const STATE_YES_CONFIDENCE_THRESHOLD = 0.85;
    const STATE_NEGATIVE_CONFIDENCE_THRESHOLD = 0.75;
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
    const HUNDO_COUNT_ACTIVE_TAB_VALUES = new Set(['pokemon', 'egg', 'unknown']);
    const HUNDO_COUNT_SOURCE_VALUES = new Set(['pokemon_search_result_summary', 'other', 'uncertain']);
    const HUNDO_COUNT_POSITION_VALUES = new Set(['associated_with_active_pokemon_tab', 'other', 'uncertain']);

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

    const normalizeHundoCountResult = (result = {}) => ({
        hundo_leg: String(result?.hundo_leg ?? '').normalize('NFKC').trim(),
        raw_count_text: String(result?.raw_count_text ?? '').normalize('NFKC'),
        active_tab: HUNDO_COUNT_ACTIVE_TAB_VALUES.has(stringValue(result?.active_tab).toLowerCase())
            ? stringValue(result?.active_tab).toLowerCase()
            : 'unknown',
        count_source: HUNDO_COUNT_SOURCE_VALUES.has(stringValue(result?.count_source).toLowerCase())
            ? stringValue(result?.count_source).toLowerCase()
            : 'uncertain',
        relative_position: HUNDO_COUNT_POSITION_VALUES.has(stringValue(result?.relative_position).toLowerCase())
            ? stringValue(result?.relative_position).toLowerCase()
            : 'uncertain',
        has_parentheses: result?.has_parentheses === true,
        has_slash: result?.has_slash === true,
        confidence: clampConfidence(result?.confidence)
    });

    const validateHundoCountEvidence = (result = {}, classification = {}) => {
        const normalized = normalizeHundoCountResult(result);
        const rawMatch = normalized.raw_count_text.match(/^\(\s*(\d+)\s*\)$/);
        const parsedNumber = rawMatch ? Number(rawMatch[1]) : NaN;
        const parsedCount = Number.isFinite(parsedNumber) ? String(parsedNumber) : '';
        const valid = (
            normalizeSearchQuery(classification?.search_query) === HUNDO_LEGENDARY_QUERY
            && normalized.active_tab === 'pokemon'
            && normalized.count_source === 'pokemon_search_result_summary'
            && normalized.relative_position === 'associated_with_active_pokemon_tab'
            && normalized.has_parentheses === true
            && normalized.has_slash === false
            && rawMatch !== null
            && normalized.hundo_leg === parsedCount
            && normalized.confidence >= HUNDO_COUNT_CONFIDENCE_THRESHOLD
        );

        return {
            hundo_leg: valid ? parsedCount : '',
            confidence: normalized.confidence,
            valid,
            raw_count_text: normalized.raw_count_text,
            manual_review_reasons: valid ? [] : ['hundo_count_uncertain']
        };
    };

    const mergeHundoCountResults = (results = []) => {
        const grouped = new Map();
        (Array.isArray(results) ? results : []).forEach(result => {
            const value = String(result?.hundo_leg ?? '').normalize('NFKC').trim();
            const number = Number(value);
            if (
                result?.valid !== true
                || !/^\d+$/.test(value)
                || !Number.isFinite(number)
                || String(number) !== value
            ) return;
            if (!grouped.has(value)) grouped.set(value, []);
            grouped.get(value).push(clampConfidence(result?.confidence));
        });

        const candidates = [...grouped.entries()]
            .map(([value, confidences]) => {
                return {
                    value,
                    votes: confidences.length,
                    confidence: Math.max(...confidences)
                };
            })
            .sort((left, right) => left.value.localeCompare(right.value));

        if (candidates.length === 0) {
            return {
                hundo_leg: '',
                conflict: false,
                uncertain: true,
                candidates,
                manual_review_reasons: ['hundo_count_uncertain']
            };
        }

        const conflict = candidates.length > 1;
        const highestFrequency = Math.max(...candidates.map(candidate => candidate.votes));
        const frequencyLeaders = candidates.filter(candidate => candidate.votes === highestFrequency);
        const highestConfidence = Math.max(...frequencyLeaders.map(candidate => candidate.confidence));
        const confidenceLeaders = frequencyLeaders.filter(candidate => candidate.confidence === highestConfidence);
        const unresolved = confidenceLeaders.length !== 1;

        return {
            hundo_leg: unresolved ? '' : confidenceLeaders[0].value,
            conflict,
            uncertain: unresolved,
            candidates,
            manual_review_reasons: unresolved
                ? ['hundo_count_conflict', 'hundo_count_uncertain']
                : []
        };
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

    const isClearPresentEvidence = (evidence = {}) => (
        evidence?.present === true
        && evidence?.region_visibility === 'clear'
    );

    const isExactNegativeEvidence = (evidence = {}, fields = []) => (
        evidence?.present === false
        && evidence?.region_visibility === 'clear'
        && fields.every(field => evidence?.[field] === 'none')
    );

    const isValidShinyEvidence = (evidence = {}) => (
        isClearPresentEvidence(evidence)
        && evidence?.position === 'cp_area'
        && ['dark_blue', 'blue_black', 'teal_blue', 'dark_blue_teal'].includes(evidence?.color)
        && evidence?.shape === 'multiple_four_point_sparkles'
    );

    const isValidLuckyEvidence = (evidence = {}) => (
        isClearPresentEvidence(evidence)
        && evidence?.position === 'behind_pokemon'
        && evidence?.appearance === 'large_gold_shimmering_background'
    );

    const isValidFavoriteEvidence = (evidence = {}) => (
        isClearPresentEvidence(evidence)
        && evidence?.position === 'upper_right'
        && evidence?.appearance === 'filled_yellow_five_point_star'
    );

    const deriveRocketStateFromEvidence = (evidence = {}) => {
        if (isExactNegativeEvidence(evidence, ['position', 'color', 'shape'])) return 'normal';
        if (!isClearPresentEvidence(evidence)) return 'uncertain';

        const isPurified = (
            ['lower_left', 'lower_side'].includes(evidence?.position)
            && ['light_blue', 'light_cyan'].includes(evidence?.color)
            && ['single_radial_sparkle', 'purification_starburst', 'flower_like_symbol'].includes(evidence?.shape)
        );
        if (isPurified) return 'purified';

        const isShadow = (
            ['lower_left', 'around_pokemon'].includes(evidence?.position)
            && evidence?.color === 'purple'
            && ['purple_flame', 'purple_smoke', 'shadow_aura'].includes(evidence?.shape)
        );
        return isShadow ? 'shadow' : 'uncertain';
    };

    const deriveBackgroundTypeFromEvidence = (evidence = {}) => {
        if (isExactNegativeEvidence(evidence, ['position', 'badge_type', 'appearance'])) return 'none';
        if (
            !isClearPresentEvidence(evidence)
            || evidence?.position !== 'near_pokemon_or_card_background'
        ) return 'uncertain';
        if (
            evidence?.badge_type === 'commemorative_location_badge'
            && evidence?.appearance === 'location_style_background'
        ) return 'commemorative';
        if (
            evidence?.badge_type === 'special_background_badge'
            && evidence?.appearance === 'event_special_background'
        ) return 'special';
        return 'uncertain';
    };

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

    const normalizeVisibleLabel = (value) => String(value ?? '')
        .normalize('NFKC')
        .replace(/[\s\p{White_Space}]+/gu, '');

    const overlapCardSignature = (card = {}) => JSON.stringify([
        stringValue(card?.cp),
        stringValue(card?.official_name),
        normalizeVisibleLabel(card?.visible_label),
        stringValue(card?.effective_shiny_state),
        stringValue(card?.effective_lucky_state),
        stringValue(card?.effective_favorite_state),
        stringValue(card?.effective_rocket_state),
        stringValue(card?.effective_background_type)
    ]);

    const boundaryOverlapCount = (suffixCards, prefixCards) => {
        const maximum = Math.min(suffixCards.length, prefixCards.length);
        for (let count = maximum; count >= 1; count -= 1) {
            const suffixStart = suffixCards.length - count;
            const matches = Array.from({ length: count }, (_, index) => (
                overlapCardSignature(suffixCards[suffixStart + index])
                === overlapCardSignature(prefixCards[index])
            )).every(Boolean);
            if (matches) return count;
        }
        return 0;
    };

    const uniqueCardIds = (cards = []) => [...new Set(cards.map(card => stringValue(card?.card_id)).filter(Boolean))];

    const detectScreenshotOverlap = (left = {}, right = {}) => {
        const leftCards = Array.isArray(left?.cards) ? left.cards : [];
        const rightCards = Array.isArray(right?.cards) ? right.cards : [];
        const forwardCount = boundaryOverlapCount(leftCards, rightCards);
        const reverseCount = boundaryOverlapCount(rightCards, leftCards);
        const forwardIds = uniqueCardIds(rightCards.slice(0, forwardCount));
        const reverseIds = uniqueCardIds(leftCards.slice(0, reverseCount));
        const competingDirections = forwardCount > 0 && reverseCount > 0;

        if (competingDirections) {
            return {
                direction: 'none',
                overlap_count: Math.max(forwardCount, reverseCount),
                ambiguous: true,
                matched_card_ids: [...new Set([...forwardIds, ...reverseIds])],
                manual_review_reasons: ['screenshot_overlap_uncertain']
            };
        }
        if (forwardCount >= 2) {
            return {
                direction: 'left_suffix_right_prefix',
                overlap_count: forwardCount,
                ambiguous: false,
                matched_card_ids: forwardIds,
                manual_review_reasons: []
            };
        }
        if (reverseCount >= 2) {
            return {
                direction: 'right_suffix_left_prefix',
                overlap_count: reverseCount,
                ambiguous: false,
                matched_card_ids: reverseIds,
                manual_review_reasons: []
            };
        }

        const weakCount = Math.max(forwardCount, reverseCount);
        return {
            direction: 'none',
            overlap_count: weakCount,
            ambiguous: weakCount > 0,
            matched_card_ids: [...new Set([...forwardIds, ...reverseIds])],
            manual_review_reasons: weakCount > 0 ? ['screenshot_overlap_uncertain'] : []
        };
    };

    const ambiguousOverlapDecision = (decision) => ({
        direction: 'none',
        overlap_count: decision.overlap_count,
        ambiguous: true,
        matched_card_ids: [...decision.matched_card_ids],
        manual_review_reasons: ['screenshot_overlap_uncertain']
    });

    const mergeSmartHundoScreenshots = (screenshots = [], normalizeOfficialName) => {
        const screenshotList = Array.isArray(screenshots) ? screenshots : [];
        const comparisonScreenshots = screenshotList.map(screenshot => ({
            cards: (Array.isArray(screenshot?.cards) ? screenshot.cards : []).map(card => ({
                ...card,
                official_name: normalizeWith(normalizeOfficialName, card?.official_name)
            }))
        }));
        const pairRecords = [];

        for (let leftIndex = 0; leftIndex < screenshotList.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < screenshotList.length; rightIndex += 1) {
                pairRecords.push({
                    leftIndex,
                    rightIndex,
                    decision: detectScreenshotOverlap(
                        comparisonScreenshots[leftIndex],
                        comparisonScreenshots[rightIndex]
                    )
                });
            }
        }

        const edges = pairRecords
            .filter(record => !record.decision.ambiguous && record.decision.overlap_count >= 2)
            .map(record => ({
                record,
                from: record.decision.direction === 'left_suffix_right_prefix'
                    ? record.leftIndex
                    : record.rightIndex,
                to: record.decision.direction === 'left_suffix_right_prefix'
                    ? record.rightIndex
                    : record.leftIndex,
                count: record.decision.overlap_count
            }));
        const incoming = new Map();
        const outgoing = new Map();
        edges.forEach(edge => {
            if (!incoming.has(edge.to)) incoming.set(edge.to, []);
            if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
            incoming.get(edge.to).push(edge);
            outgoing.get(edge.from).push(edge);
        });

        const unsafeNodes = new Set();
        pairRecords.forEach(record => {
            if (record.decision.ambiguous && record.decision.overlap_count > 0) {
                unsafeNodes.add(record.leftIndex);
                unsafeNodes.add(record.rightIndex);
            }
        });
        incoming.forEach((nodeEdges, node) => {
            if (nodeEdges.length > 1) unsafeNodes.add(node);
        });
        outgoing.forEach((nodeEdges, node) => {
            if (nodeEdges.length > 1) unsafeNodes.add(node);
        });

        const visiting = new Set();
        const visited = new Set();
        const visitForCycles = (node, path = []) => {
            if (visiting.has(node)) {
                const cycleStart = path.indexOf(node);
                path.slice(cycleStart).forEach(cycleNode => unsafeNodes.add(cycleNode));
                return;
            }
            if (visited.has(node)) return;
            visiting.add(node);
            (outgoing.get(node) || []).forEach(edge => visitForCycles(edge.to, [...path, node]));
            visiting.delete(node);
            visited.add(node);
        };
        screenshotList.forEach((_, index) => visitForCycles(index));

        const adjacent = new Map();
        edges.forEach(edge => {
            if (!adjacent.has(edge.from)) adjacent.set(edge.from, new Set());
            if (!adjacent.has(edge.to)) adjacent.set(edge.to, new Set());
            adjacent.get(edge.from).add(edge.to);
            adjacent.get(edge.to).add(edge.from);
        });
        const unsafeComponents = new Set();
        unsafeNodes.forEach(start => {
            const pending = [start];
            while (pending.length) {
                const node = pending.pop();
                if (unsafeComponents.has(node)) continue;
                unsafeComponents.add(node);
                (adjacent.get(node) || []).forEach(neighbor => pending.push(neighbor));
            }
        });

        edges.forEach(edge => {
            if (!unsafeComponents.has(edge.from) && !unsafeComponents.has(edge.to)) return;
            edge.record.decision = ambiguousOverlapDecision(edge.record.decision);
        });
        const safeEdges = edges.filter(edge => !unsafeComponents.has(edge.from) && !unsafeComponents.has(edge.to));
        const safeIncoming = new Map(safeEdges.map(edge => [edge.to, edge]));
        const safeOutgoing = new Map(safeEdges.map(edge => [edge.from, edge]));
        const emitted = new Set();
        const components = [];

        screenshotList.forEach((_, index) => {
            if (safeIncoming.has(index)) return;
            const component = [];
            let current = index;
            while (!emitted.has(current)) {
                component.push(current);
                emitted.add(current);
                const next = safeOutgoing.get(current);
                if (!next) break;
                current = next.to;
            }
            components.push(component);
        });
        screenshotList.forEach((_, index) => {
            if (!emitted.has(index)) components.push([index]);
        });
        components.sort((left, right) => Math.min(...left) - Math.min(...right));

        const cards = components.flatMap(component => component.flatMap(index => {
            const screenshotCards = Array.isArray(screenshotList[index]?.cards)
                ? screenshotList[index].cards
                : [];
            const incomingEdge = safeIncoming.get(index);
            return incomingEdge ? screenshotCards.slice(incomingEdge.count) : screenshotCards;
        }));
        const overlapDecisions = pairRecords.map(record => record.decision);
        const manualReviewReasons = overlapDecisions.some(decision => (
            decision.manual_review_reasons.includes('screenshot_overlap_uncertain')
        ))
            ? ['screenshot_overlap_uncertain']
            : [];

        return {
            cards,
            overlap_decisions: overlapDecisions,
            manual_review_reasons: manualReviewReasons
        };
    };

    const diagnosticString = (value) => (
        ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : ''
    );
    const diagnosticNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };
    const diagnosticStrings = (values) => (Array.isArray(values) ? values : [])
        .filter(value => ['string', 'number', 'boolean'].includes(typeof value))
        .map(diagnosticString);
    const diagnosticEvidence = (evidence, fields) => {
        const source = evidence && typeof evidence === 'object' ? evidence : {};
        return Object.fromEntries(fields.map(field => [
            field,
            field === 'present' ? source[field] === true : diagnosticString(source[field])
        ]));
    };
    const diagnosticCard = (card = {}) => {
        const rawStates = card?.raw?.states && typeof card.raw.states === 'object'
            ? card.raw.states
            : {};
        const rawConfidences = card?.raw?.confidences && typeof card.raw.confidences === 'object'
            ? card.raw.confidences
            : {};
        const rawEvidence = card?.raw?.evidence && typeof card.raw.evidence === 'object'
            ? card.raw.evidence
            : {};
        const rawState = (dimension, field) => diagnosticString(
            rawStates[dimension] ?? card?.[field]
        );
        const rawConfidence = (dimension, field) => diagnosticNumber(
            rawConfidences[dimension] ?? card?.[field]
        );
        const evidence = (dimension, field, fields) => diagnosticEvidence(
            rawEvidence[dimension] ?? card?.[field],
            fields
        );

        return {
            card_id: diagnosticString(card?.card_id),
            order: diagnosticNumber(card?.order),
            row: diagnosticNumber(card?.row),
            column: diagnosticNumber(card?.column),
            cp: diagnosticString(card?.cp),
            visible_label: diagnosticString(card?.visible_label),
            official_name: diagnosticString(card?.official_name),
            recognition_status: diagnosticString(card?.recognition_status),
            raw_states: {
                shiny: rawState('shiny', 'shiny_state'),
                lucky: rawState('lucky', 'lucky_state'),
                favorite: rawState('favorite', 'favorite_state'),
                rocket: rawState('rocket', 'rocket_state'),
                background: rawState('background', 'background_type')
            },
            raw_confidences: {
                shiny: rawConfidence('shiny', 'shiny_confidence'),
                lucky: rawConfidence('lucky', 'lucky_confidence'),
                favorite: rawConfidence('favorite', 'favorite_confidence'),
                rocket: rawConfidence('rocket', 'rocket_confidence'),
                background: rawConfidence('background', 'background_confidence')
            },
            raw_evidence: {
                shiny: evidence('shiny', 'shiny_evidence', ['present', 'region_visibility', 'position', 'color', 'shape']),
                lucky: evidence('lucky', 'lucky_evidence', ['present', 'region_visibility', 'position', 'appearance']),
                favorite: evidence('favorite', 'favorite_evidence', ['present', 'region_visibility', 'position', 'appearance']),
                rocket: evidence('rocket', 'rocket_evidence', ['present', 'region_visibility', 'position', 'color', 'shape']),
                background: evidence('background', 'background_evidence', ['present', 'region_visibility', 'position', 'badge_type', 'appearance'])
            },
            effective_states: {
                shiny: diagnosticString(card?.effective_shiny_state),
                lucky: diagnosticString(card?.effective_lucky_state),
                favorite: diagnosticString(card?.effective_favorite_state),
                rocket: diagnosticString(card?.effective_rocket_state),
                background: diagnosticString(card?.effective_background_type)
            },
            manual_review_reasons: diagnosticStrings(card?.manual_review_reasons)
        };
    };
    const diagnosticOverlapDecision = (decision = {}) => ({
        direction: ['left_suffix_right_prefix', 'right_suffix_left_prefix'].includes(decision?.direction)
            ? decision.direction
            : 'none',
        overlap_count: diagnosticNumber(decision?.overlap_count),
        ambiguous: decision?.ambiguous === true,
        matched_card_ids: diagnosticStrings(decision?.matched_card_ids),
        manual_review_reasons: diagnosticStrings(decision?.manual_review_reasons)
    });
    const shapeSmartHundoDiagnostics = (session = {}) => ({
        scan_session_id: diagnosticString(session?.scan_session_id),
        screenshots: (Array.isArray(session?.screenshots) ? session.screenshots : []).map(screenshot => ({
            index: diagnosticNumber(screenshot?.index),
            classification: {
                image_type: diagnosticString(screenshot?.classification?.image_type),
                search_query: diagnosticString(screenshot?.classification?.search_query)
            },
            normalized_search_query: diagnosticString(screenshot?.normalized_search_query),
            raw_count_text: diagnosticString(screenshot?.raw_count_text),
            validated_count: diagnosticString(screenshot?.validated_count),
            count_source: diagnosticString(screenshot?.count_source),
            count_confidence: diagnosticNumber(screenshot?.count_confidence),
            detected_card_count: diagnosticNumber(screenshot?.detected_card_count),
            cards_length: diagnosticNumber(screenshot?.cards_length),
            scan_complete: screenshot?.scan_complete === true,
            bottom_edge_checked: screenshot?.bottom_edge_checked === true,
            finish_reason: diagnosticString(screenshot?.finish_reason),
            structural_retry_used: screenshot?.structural_retry_used === true,
            structural_retry_reason: diagnosticStrings(screenshot?.structural_retry_reason),
            cards: (Array.isArray(screenshot?.cards) ? screenshot.cards : []).map(diagnosticCard)
        })),
        count_candidates: (Array.isArray(session?.count_candidates) ? session.count_candidates : []).map(candidate => ({
            value: diagnosticString(candidate?.value),
            votes: diagnosticNumber(candidate?.votes),
            confidence: diagnosticNumber(candidate?.confidence)
        })),
        count_conflict: session?.count_conflict === true,
        overlap_decisions: (Array.isArray(session?.overlap_decisions) ? session.overlap_decisions : [])
            .map(diagnosticOverlapDecision),
        manual_review_reasons: diagnosticStrings(session?.manual_review_reasons),
        pokemon_list: diagnosticString(session?.pokemon_list)
    });

    const validateSmartHundoStructure = (result = {}, finishReason = '') => {
        const cards = Array.isArray(result?.cards) ? result.cards : [];
        const detectedCardCount = normalizeCount(result?.detected_card_count);
        const scanComplete = result?.scan_complete === true;
        const bottomEdgeChecked = result?.bottom_edge_checked === true;
        const normalizedFinishReason = String(finishReason ?? '');
        const reasons = [];

        if (detectedCardCount !== cards.length) reasons.push('detected_card_count_mismatch');
        if (!scanComplete) reasons.push('scan_incomplete');
        if (!bottomEdgeChecked) reasons.push('bottom_edge_not_checked');

        const coordinates = new Set();
        let invalidCoordinates = false;
        let duplicateCoordinates = false;
        cards.forEach(card => {
            const values = [card?.order, card?.row, card?.column];
            if (values.some(value => !Number.isInteger(value) || value < 1)) {
                invalidCoordinates = true;
                return;
            }
            const coordinate = values.join(':');
            if (coordinates.has(coordinate)) duplicateCoordinates = true;
            coordinates.add(coordinate);
        });
        if (invalidCoordinates) reasons.push('invalid_card_coordinates');
        if (duplicateCoordinates) reasons.push('duplicate_card_coordinates');
        if (['length', 'truncated', 'truncation'].includes(normalizedFinishReason.toLowerCase())) {
            reasons.push('finish_reason_length');
        }

        return {
            structurally_complete: reasons.length === 0,
            reasons,
            detected_card_count: detectedCardCount,
            cards_length: cards.length,
            scan_complete: scanComplete,
            bottom_edge_checked: bottomEdgeChecked,
            finish_reason: normalizedFinishReason
        };
    };

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

    const hasUsableRecognizedSpecies = (card = {}) => (
        card?.recognition_status === 'recognized'
        && stringValue(card?.official_name) !== ''
        && Number(card?.species_confidence) >= SPECIES_CONFIDENCE_THRESHOLD
    );

    const deriveIndependentState = (rawState, confidence, evidence, positiveValidator, evidenceFields) => {
        if (
            rawState === 'yes'
            && confidence >= STATE_YES_CONFIDENCE_THRESHOLD
            && positiveValidator(evidence)
        ) return 'yes';
        if (
            rawState === 'no'
            && confidence >= STATE_NEGATIVE_CONFIDENCE_THRESHOLD
            && isExactNegativeEvidence(evidence, evidenceFields)
        ) return 'no';
        return 'uncertain';
    };

    const deriveEffectiveRocketState = (rawState, confidence, evidence) => {
        const evidenceState = deriveRocketStateFromEvidence(evidence);
        if (
            ['shadow', 'purified'].includes(rawState)
            && confidence >= STATE_YES_CONFIDENCE_THRESHOLD
            && evidenceState === rawState
        ) return rawState;
        if (
            rawState === 'normal'
            && confidence >= STATE_NEGATIVE_CONFIDENCE_THRESHOLD
            && evidenceState === 'normal'
        ) return 'normal';
        return 'uncertain';
    };

    const deriveEffectiveBackgroundType = (rawType, confidence, evidence) => {
        const evidenceType = deriveBackgroundTypeFromEvidence(evidence);
        if (
            ['commemorative', 'special'].includes(rawType)
            && confidence >= STATE_YES_CONFIDENCE_THRESHOLD
            && evidenceType === rawType
        ) return rawType;
        if (
            rawType === 'none'
            && confidence >= STATE_NEGATIVE_CONFIDENCE_THRESHOLD
            && evidenceType === 'none'
        ) return 'none';
        return 'uncertain';
    };

    const validateHundoCardStates = (card = {}) => {
        const effectiveStates = {
            shiny: deriveIndependentState(
                card?.shiny_state,
                card?.shiny_confidence,
                card?.shiny_evidence,
                isValidShinyEvidence,
                ['position', 'color', 'shape']
            ),
            lucky: deriveIndependentState(
                card?.lucky_state,
                card?.lucky_confidence,
                card?.lucky_evidence,
                isValidLuckyEvidence,
                ['position', 'appearance']
            ),
            favorite: deriveIndependentState(
                card?.favorite_state,
                card?.favorite_confidence,
                card?.favorite_evidence,
                isValidFavoriteEvidence,
                ['position', 'appearance']
            ),
            rocket: deriveEffectiveRocketState(
                card?.rocket_state,
                card?.rocket_confidence,
                card?.rocket_evidence
            ),
            background: deriveEffectiveBackgroundType(
                card?.background_type,
                card?.background_confidence,
                card?.background_evidence
            )
        };
        const stateReasonByDimension = {
            shiny: 'shiny_uncertain',
            lucky: 'lucky_uncertain',
            favorite: 'favorite_uncertain',
            rocket: 'rocket_state_uncertain',
            background: 'background_uncertain'
        };
        const derivedReasonCodes = new Set(['species_uncertain', ...Object.values(stateReasonByDimension)]);
        const manualReviewReasons = (Array.isArray(card?.manual_review_reasons) ? card.manual_review_reasons : [])
            .filter(reason => !derivedReasonCodes.has(reason));
        const appendReasonOnce = (reason) => {
            if (!manualReviewReasons.includes(reason)) manualReviewReasons.push(reason);
        };
        if (!hasUsableRecognizedSpecies(card)) appendReasonOnce('species_uncertain');
        Object.entries(effectiveStates).forEach(([dimension, state]) => {
            if (state === 'uncertain') appendReasonOnce(stateReasonByDimension[dimension]);
        });

        return {
            ...card,
            effective_shiny_state: effectiveStates.shiny,
            effective_lucky_state: effectiveStates.lucky,
            effective_favorite_state: effectiveStates.favorite,
            effective_rocket_state: effectiveStates.rocket,
            effective_background_type: effectiveStates.background,
            manual_review_reasons: manualReviewReasons
        };
    };

    const reviewReasonCodes = (card = {}) => {
        const reasons = Array.isArray(card?.manual_review_reasons)
            ? card.manual_review_reasons.filter(isHundoReviewReason)
            : [];
        if (!hasUsableRecognizedSpecies(card)) reasons.push('species_uncertain');
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
            if (!hasUsableRecognizedSpecies(card) || !officialName) return;

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
        normalizeVisibleLabel,
        detectScreenshotOverlap,
        mergeSmartHundoScreenshots,
        shapeSmartHundoDiagnostics,
        validateSmartHundoStructure,
        normalizeLegacySmartHundoResult,
        normalizeHundoCountResult,
        validateHundoCountEvidence,
        mergeHundoCountResults,
        HUNDO_COUNT_CONFIDENCE_THRESHOLD,
        SPECIES_CONFIDENCE_THRESHOLD,
        STATE_YES_CONFIDENCE_THRESHOLD,
        STATE_NEGATIVE_CONFIDENCE_THRESHOLD,
        ENUMERATION_CONFIDENCE_THRESHOLD,
        isValidShinyEvidence,
        isValidLuckyEvidence,
        isValidFavoriteEvidence,
        deriveRocketStateFromEvidence,
        deriveBackgroundTypeFromEvidence,
        validateHundoCardStates,
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
