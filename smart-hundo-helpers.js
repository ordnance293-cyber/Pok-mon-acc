(function (global) {
    'use strict';

    const HUNDO_LEGENDARY_QUERY = '傳說的寶可夢,幻,究極異獸&4*';
    const SMART_IMAGE_TYPE = 'HUNDO_LEGENDARY_SCREEN';
    // Count/enumeration gates are consumed by screenshot-level validation in Task 4.
    const HUNDO_COUNT_CONFIDENCE_THRESHOLD = 0.85;
    const ENUMERATION_CONFIDENCE_THRESHOLD = 0.85;
    // Species and state gates are consumed by card validation and list conversion.
    const SPECIES_CONFIDENCE_THRESHOLD = 0.80;
    const FORM_CONFIDENCE_THRESHOLD = 0.85;
    const FORM_PARTIAL_VISIBILITY_THRESHOLD = 0.93;
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
    const SHINY_POSITION_VALUES = new Set(['none', 'cp_area', 'other', 'uncertain']);
    const SHINY_COLOR_VALUES = new Set(['none', 'dark_blue', 'blue_black', 'teal_blue', 'dark_blue_teal', 'light_cyan', 'yellow', 'purple', 'other', 'uncertain']);
    const SHINY_SHAPE_VALUES = new Set(['none', 'multiple_four_point_sparkles', 'single_radial_sparkle', 'five_point_star', 'flame_or_smoke', 'other', 'uncertain']);
    const LUCKY_POSITION_VALUES = new Set(['none', 'behind_pokemon', 'other', 'uncertain']);
    const LUCKY_APPEARANCE_VALUES = new Set(['none', 'large_gold_shimmering_background', 'other', 'uncertain']);
    const FAVORITE_POSITION_VALUES = new Set(['none', 'upper_right', 'other', 'uncertain']);
    const FAVORITE_APPEARANCE_VALUES = new Set(['none', 'filled_yellow_five_point_star', 'other', 'uncertain']);
    const ROCKET_POSITION_VALUES = new Set(['none', 'lower_left', 'other', 'uncertain']);
    const ROCKET_COLOR_VALUES = new Set(['none', 'light_blue', 'light_cyan', 'purple', 'other', 'uncertain']);
    const ROCKET_SHAPE_VALUES = new Set(['none', 'single_radial_sparkle', 'purification_starburst', 'flower_like_symbol', 'purple_flame', 'purple_smoke', 'shadow_aura', 'other', 'uncertain']);
    const BACKGROUND_POSITION_VALUES = new Set(['none', 'lower_right', 'other', 'uncertain']);
    const HUNDO_STATE_POSITION_VALUES = Object.freeze({
        shiny: Object.freeze([...SHINY_POSITION_VALUES]),
        favorite: Object.freeze([...FAVORITE_POSITION_VALUES]),
        rocket: Object.freeze([...ROCKET_POSITION_VALUES]),
        background: Object.freeze([...BACKGROUND_POSITION_VALUES])
    });
    const BADGE_TYPE_VALUES = new Set(['none', 'commemorative_location_badge', 'special_background_badge', 'other', 'uncertain']);
    const BACKGROUND_APPEARANCE_VALUES = new Set(['none', 'location_style_background', 'event_special_background', 'other', 'uncertain']);
    const RECOGNITION_VALUES = new Set(['recognized', 'partial', 'uncertain']);
    const HUNDO_COUNT_ACTIVE_TAB_VALUES = new Set(['pokemon', 'egg', 'unknown']);
    const HUNDO_COUNT_SOURCE_VALUES = new Set(['pokemon_search_result_summary', 'other', 'uncertain']);
    const HUNDO_COUNT_POSITION_VALUES = new Set(['associated_with_active_pokemon_tab', 'other', 'uncertain']);
    const HUNDO_FORM_CANONICAL_NAMES = Object.freeze({
        articuno_standard: '急凍鳥',
        articuno_galarian: '伽勒爾急凍鳥',
        zapdos_standard: '閃電鳥',
        zapdos_galarian: '伽勒爾閃電鳥',
        moltres_standard: '火焰鳥',
        moltres_galarian: '伽勒爾火焰鳥',
        zacian_standard: '蒼響',
        zacian_crowned: '蒼響劍盾型態',
        zamazenta_standard: '藏瑪然特',
        zamazenta_crowned: '藏瑪然特劍盾型態',
        dialga_standard: '帝牙盧卡',
        dialga_origin: '起源帝牙盧卡',
        palkia_standard: '帕路奇亞',
        palkia_origin: '起源帕路奇亞',
        zygarde_10: '基格爾德（10%形態）',
        zygarde_50: '基格爾德（50%形態）',
        zygarde_complete: '基格爾德（完全體形態）',
        necrozma_base: '奈克洛茲瑪',
        necrozma_dusk_mane: '奈克洛茲瑪（黃昏之鬃）',
        necrozma_dawn_wings: '奈克洛茲瑪（拂曉之翼）',
        kyurem_base: '酋雷姆',
        kyurem_white: '焰白酋雷姆',
        kyurem_black: '闇黑酋雷姆'
    });
    const HUNDO_FORMS_BY_BASE_SPECIES = Object.freeze({
        急凍鳥: Object.freeze(['articuno_standard', 'articuno_galarian']),
        閃電鳥: Object.freeze(['zapdos_standard', 'zapdos_galarian']),
        火焰鳥: Object.freeze(['moltres_standard', 'moltres_galarian']),
        蒼響: Object.freeze(['zacian_standard', 'zacian_crowned']),
        藏瑪然特: Object.freeze(['zamazenta_standard', 'zamazenta_crowned']),
        帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin']),
        帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin']),
        基格爾德: Object.freeze(['zygarde_10', 'zygarde_50', 'zygarde_complete']),
        奈克洛茲瑪: Object.freeze(['necrozma_base', 'necrozma_dusk_mane', 'necrozma_dawn_wings']),
        酋雷姆: Object.freeze(['kyurem_base', 'kyurem_white', 'kyurem_black'])
    });
    const FORM_CONTROL_IDS = new Set(['not_applicable', 'uncertain', 'unsupported']);
    const HUNDO_SUPPORTED_FORM_IDS = new Set(Object.keys(HUNDO_FORM_CANONICAL_NAMES));
    const HUNDO_FORM_ID_VALUES = new Set([...FORM_CONTROL_IDS, ...HUNDO_SUPPORTED_FORM_IDS]);
    const FORM_VISUAL_SIGNATURE_VALUES = new Set([
        ...HUNDO_SUPPORTED_FORM_IDS,
        'not_applicable',
        'other',
        'uncertain'
    ]);
    const FORM_RECOGNITION_BASIS_VALUES = new Set([
        'direct_visual_match',
        'visual_and_label',
        'label_only',
        'uncertain'
    ]);
    const FORM_LABEL_RELATIONSHIP_VALUES = new Set([
        'exact_form',
        'base_species_only',
        'custom_nickname',
        'conflicting',
        'unreadable',
        'not_applicable',
        'uncertain'
    ]);
    const HUNDO_FORM_ALIASES = Object.freeze({
        急凍鳥: Object.freeze({ base_species: '急凍鳥' }),
        伽勒爾急凍鳥: Object.freeze({ base_species: '急凍鳥', candidate_form_id: 'articuno_galarian' }),
        閃電鳥: Object.freeze({ base_species: '閃電鳥' }),
        伽勒爾閃電鳥: Object.freeze({ base_species: '閃電鳥', candidate_form_id: 'zapdos_galarian' }),
        火焰鳥: Object.freeze({ base_species: '火焰鳥' }),
        伽勒爾火焰鳥: Object.freeze({ base_species: '火焰鳥', candidate_form_id: 'moltres_galarian' }),
        蒼響: Object.freeze({ base_species: '蒼響' }),
        蒼響劍王: Object.freeze({ base_species: '蒼響', candidate_form_id: 'zacian_crowned' }),
        '蒼響（劍之王）': Object.freeze({ base_species: '蒼響', candidate_form_id: 'zacian_crowned' }),
        '蒼響(劍之王)': Object.freeze({ base_species: '蒼響', candidate_form_id: 'zacian_crowned' }),
        蒼響劍盾型態: Object.freeze({ base_species: '蒼響', candidate_form_id: 'zacian_crowned' }),
        藏瑪然特: Object.freeze({ base_species: '藏瑪然特' }),
        藏瑪然特盾王: Object.freeze({ base_species: '藏瑪然特', candidate_form_id: 'zamazenta_crowned' }),
        '藏瑪然特（盾之王）': Object.freeze({ base_species: '藏瑪然特', candidate_form_id: 'zamazenta_crowned' }),
        '藏瑪然特(盾之王)': Object.freeze({ base_species: '藏瑪然特', candidate_form_id: 'zamazenta_crowned' }),
        藏瑪然特劍盾型態: Object.freeze({ base_species: '藏瑪然特', candidate_form_id: 'zamazenta_crowned' }),
        帝牙盧卡: Object.freeze({ base_species: '帝牙盧卡' }),
        '帝牙盧卡（起源形態）': Object.freeze({ base_species: '帝牙盧卡', candidate_form_id: 'dialga_origin' }),
        '帝牙盧卡(起源形態)': Object.freeze({ base_species: '帝牙盧卡', candidate_form_id: 'dialga_origin' }),
        起源型態帝牙盧卡: Object.freeze({ base_species: '帝牙盧卡', candidate_form_id: 'dialga_origin' }),
        起源帝牙盧卡: Object.freeze({ base_species: '帝牙盧卡', candidate_form_id: 'dialga_origin' }),
        帕路奇亞: Object.freeze({ base_species: '帕路奇亞' }),
        '帕路奇亞（起源形態）': Object.freeze({ base_species: '帕路奇亞', candidate_form_id: 'palkia_origin' }),
        '帕路奇亞(起源形態)': Object.freeze({ base_species: '帕路奇亞', candidate_form_id: 'palkia_origin' }),
        起源型態帕路奇亞: Object.freeze({ base_species: '帕路奇亞', candidate_form_id: 'palkia_origin' }),
        起源帕路奇亞: Object.freeze({ base_species: '帕路奇亞', candidate_form_id: 'palkia_origin' }),
        基格爾德: Object.freeze({ base_species: '基格爾德' }),
        '基格爾德（10%形態）': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_10' }),
        '基格爾德(10%形態)': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_10' }),
        '基格爾德（50%形態）': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_50' }),
        '基格爾德(50%形態)': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_50' }),
        '基格爾德（完全體形態）': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_complete' }),
        '基格爾德(完全體形態)': Object.freeze({ base_species: '基格爾德', candidate_form_id: 'zygarde_complete' }),
        奈克洛茲瑪: Object.freeze({ base_species: '奈克洛茲瑪' }),
        '奈克洛茲瑪（黃昏之鬃）': Object.freeze({ base_species: '奈克洛茲瑪', candidate_form_id: 'necrozma_dusk_mane' }),
        '奈克洛茲瑪(黃昏之鬃)': Object.freeze({ base_species: '奈克洛茲瑪', candidate_form_id: 'necrozma_dusk_mane' }),
        '奈克洛茲瑪（拂曉之翼）': Object.freeze({ base_species: '奈克洛茲瑪', candidate_form_id: 'necrozma_dawn_wings' }),
        '奈克洛茲瑪(拂曉之翼)': Object.freeze({ base_species: '奈克洛茲瑪', candidate_form_id: 'necrozma_dawn_wings' }),
        酋雷姆: Object.freeze({ base_species: '酋雷姆' }),
        焰白酋雷姆: Object.freeze({ base_species: '酋雷姆', candidate_form_id: 'kyurem_white' }),
        炎白酋雷姆: Object.freeze({ base_species: '酋雷姆', candidate_form_id: 'kyurem_white' }),
        闇黑酋雷姆: Object.freeze({ base_species: '酋雷姆', candidate_form_id: 'kyurem_black' })
    });

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

    const clampStrictConfidence = value => (
        typeof value === 'number' && Number.isFinite(value) ? clampConfidence(value) : 0
    );

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
        const exactQuery = (
            normalizeSearchQuery(classification?.search_query) === HUNDO_LEGENDARY_QUERY
        );
        const rawMatch = normalized.raw_count_text.match(/^\(\s*(\d+)\s*\)$/);
        const parsedNumber = rawMatch ? Number(rawMatch[1]) : NaN;
        const parsedCount = Number.isFinite(parsedNumber) ? String(parsedNumber) : '';
        const strictSemanticValid = (
            exactQuery
            && normalized.active_tab === 'pokemon'
            && normalized.count_source === 'pokemon_search_result_summary'
            && normalized.relative_position === 'associated_with_active_pokemon_tab'
            && normalized.has_parentheses === true
            && normalized.has_slash === false
            && rawMatch !== null
            && normalized.hundo_leg === parsedCount
            && normalized.confidence >= HUNDO_COUNT_CONFIDENCE_THRESHOLD
        );
        const rawTextContainsSlash = /[\/／]/.test(normalized.raw_count_text);
        const hasExplicitContextContradiction = (
            normalized.active_tab === 'egg'
            || normalized.count_source === 'other'
            || normalized.relative_position === 'other'
        );
        const exactParenthesizedTextValid = (
            exactQuery
            && rawMatch !== null
            && normalized.hundo_leg === parsedCount
            && rawTextContainsSlash === false
            && hasExplicitContextContradiction === false
        );
        const valid = strictSemanticValid || exactParenthesizedTextValid;

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
            evidence?.position === 'lower_left'
            && ['light_blue', 'light_cyan'].includes(evidence?.color)
            && ['single_radial_sparkle', 'purification_starburst', 'flower_like_symbol'].includes(evidence?.shape)
        );
        if (isPurified) return 'purified';

        const isShadow = (
            evidence?.position === 'lower_left'
            && evidence?.color === 'purple'
            && ['purple_flame', 'purple_smoke', 'shadow_aura'].includes(evidence?.shape)
        );
        return isShadow ? 'shadow' : 'uncertain';
    };

    const deriveBackgroundTypeFromEvidence = (evidence = {}) => {
        if (isExactNegativeEvidence(evidence, ['position', 'badge_type', 'appearance'])) return 'none';
        if (
            !isClearPresentEvidence(evidence)
            || evidence?.position !== 'lower_right'
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

    const SMART_HUNDO_PRESENTATION_PREFIX_PATTERN = /^(?:[\s\p{White_Space}:：,，、;；/／|｜·•・_\-－—–【】\[\]［］()（）]*)(?:global_background|紀念背卡|特別背卡|全球背卡|我的最愛|亮晶晶|色違|異色|暗影|淨化|global)(?:[\s\p{White_Space}:：,，、;；/／|｜·•・_\-－—–【】\[\]［］()（）]*)/iu;

    const stripSmartHundoPresentationPrefixes = (value) => {
        let normalized = stringValue(value).normalize('NFKC').trim();
        while (normalized) {
            const stripped = normalized.replace(SMART_HUNDO_PRESENTATION_PREFIX_PATTERN, '');
            if (stripped === normalized) break;
            normalized = stripped;
        }
        return normalized.trim();
    };

    const normalizeSmartHundoOfficialName = (value, normalizer) => {
        const sanitized = stripSmartHundoPresentationPrefixes(value);
        return stripSmartHundoPresentationPrefixes(normalizeWith(normalizer, sanitized));
    };

    const normalizeHundoBaseSpecies = (value, normalizeOfficialName) => {
        const sanitized = stripSmartHundoPresentationPrefixes(value);
        const directAlias = HUNDO_FORM_ALIASES[sanitized];
        if (directAlias) return directAlias.base_species;
        const normalized = stripSmartHundoPresentationPrefixes(normalizeWith(normalizeOfficialName, sanitized));
        return HUNDO_FORM_ALIASES[normalized]?.base_species || normalized;
    };

    const normalizeHundoFormId = (value) => {
        const formId = value === undefined || value === null ? '' : String(value).toLowerCase();
        return HUNDO_FORM_ID_VALUES.has(formId) ? formId : 'uncertain';
    };

    const normalizeHundoFormEvidence = (evidence = {}) => {
        const regionVisibility = stringValue(evidence?.region_visibility).toLowerCase();
        const recognitionBasis = stringValue(evidence?.recognition_basis).toLowerCase();
        const visualSignature = stringValue(evidence?.visual_signature).toLowerCase();
        const labelRelationship = stringValue(evidence?.label_relationship).toLowerCase();
        return {
            region_visibility: REGION_VISIBILITY_VALUES.has(regionVisibility) ? regionVisibility : 'uncertain',
            recognition_basis: FORM_RECOGNITION_BASIS_VALUES.has(recognitionBasis) ? recognitionBasis : 'uncertain',
            visual_signature: FORM_VISUAL_SIGNATURE_VALUES.has(visualSignature) ? visualSignature : 'uncertain',
            key_features_visible: evidence?.key_features_visible === true,
            label_relationship: FORM_LABEL_RELATIONSHIP_VALUES.has(labelRelationship) ? labelRelationship : 'uncertain'
        };
    };

    const adaptLegacyHundoForm = (card = {}, normalizeOfficialName) => {
        const legacyValue = stringValue(card?.official_name) || stringValue(card?.base_species);
        const sanitized = stripSmartHundoPresentationPrefixes(legacyValue);
        const alias = HUNDO_FORM_ALIASES[sanitized];
        const baseSpecies = normalizeHundoBaseSpecies(legacyValue, normalizeOfficialName);
        return {
            base_species: baseSpecies,
            form_id: alias?.candidate_form_id || (Object.hasOwn(HUNDO_FORMS_BY_BASE_SPECIES, baseSpecies)
                ? 'uncertain'
                : 'not_applicable')
        };
    };

    const normalizeSmartHundoCard = (card = {}, normalizeOfficialName, options = {}) => {
        const bboxContract = global.SmartHundoFormVerifier
            ? global.SmartHundoFormVerifier.normalizeHundoBboxContract(card)
            : {
                card_bbox: null,
                pokemon_bbox: null,
                bbox_confidence: 0,
                bbox_visibility: 'uncertain',
                bbox_valid: false
            };
        const screenshotIndex = normalizeCoordinate(options?.screenshotIndex);
        const formContractPresent = ['base_species', 'form_id', 'form_confidence', 'form_evidence']
            .some(field => Object.hasOwn(card || {}, field));
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
        const rawForm = {
            base_species: stringValue(card?.base_species),
            form_id: card?.form_id === undefined || card?.form_id === null ? '' : String(card?.form_id).toLowerCase(),
            form_confidence: card?.form_confidence,
            form_evidence: normalizeHundoFormEvidence(card?.form_evidence)
        };
        const legacyForm = adaptLegacyHundoForm(card, normalizeOfficialName);
        const baseSpecies = normalizeHundoBaseSpecies(rawForm.base_species || legacyForm.base_species, normalizeOfficialName);
        const formId = normalizeHundoFormId(rawForm.form_id || (rawForm.base_species ? 'uncertain' : legacyForm.form_id));
        const officialName = normalizeSmartHundoOfficialName(card?.official_name, normalizeOfficialName);
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
            official_name: officialName,
            recognition_status: normalizeRecognitionStatus(card?.recognition_status),
            species_confidence: clampStrictConfidence(card?.species_confidence),
            base_species: baseSpecies,
            form_id: formId,
            form_confidence: clampStrictConfidence(rawForm.form_confidence),
            form_evidence: rawForm.form_evidence,
            card_bbox: bboxContract.card_bbox,
            pokemon_bbox: bboxContract.pokemon_bbox,
            bbox_confidence: bboxContract.bbox_confidence,
            bbox_visibility: bboxContract.bbox_visibility,
            bbox_valid: bboxContract.bbox_valid,
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
            effective_form_id: 'uncertain',
            canonical_official_name: '',
            manual_review_reasons: [],
            raw: {
                states: rawStates,
                confidences: rawConfidences,
                evidence: rawEvidence,
                form: rawForm,
                form_contract_present: formContractPresent
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
        normalizeVisibleLabel(card?.visible_label),
        stringValue(card?.base_species),
        stringValue(card?.verified_form_id),
        stringValue(card?.effective_form_id),
        stringValue(card?.canonical_official_name),
        stringValue(card?.effective_shiny_state),
        stringValue(card?.effective_lucky_state),
        stringValue(card?.effective_favorite_state),
        stringValue(card?.effective_rocket_state),
        stringValue(card?.effective_background_type)
    ]);

    const hasUsableCanonicalOverlapIdentity = (card = {}) => (
        stringValue(card?.cp) !== ''
        && normalizeVisibleLabel(card?.visible_label) !== ''
        && stringValue(card?.canonical_official_name) !== ''
    );

    const hasUsableOverlapIdentity = (card = {}) => hasUsableCanonicalOverlapIdentity(card);

    const overlapCardsMatch = (leftCard = {}, rightCard = {}) => {
        if (
            hasUsableCanonicalOverlapIdentity(leftCard)
            && hasUsableCanonicalOverlapIdentity(rightCard)
        ) {
            return overlapCardSignature(leftCard) === overlapCardSignature(rightCard);
        }
        return false;
    };

    const boundaryOverlapCount = (suffixCards, prefixCards) => {
        const maximum = Math.min(suffixCards.length, prefixCards.length);
        for (let count = maximum; count >= 1; count -= 1) {
            const suffixStart = suffixCards.length - count;
            const matches = Array.from({ length: count }, (_, index) => {
                const suffixCard = suffixCards[suffixStart + index];
                const prefixCard = prefixCards[index];
                return (
                    hasUsableOverlapIdentity(suffixCard)
                    && hasUsableOverlapIdentity(prefixCard)
                    && overlapCardsMatch(suffixCard, prefixCard)
                );
            }).every(Boolean);
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

    const mergeSmartHundoScreenshots = (screenshots = []) => {
        const screenshotList = Array.isArray(screenshots) ? screenshots : [];
        const pairRecords = [];

        for (let leftIndex = 0; leftIndex < screenshotList.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < screenshotList.length; rightIndex += 1) {
                pairRecords.push({
                    leftIndex,
                    rightIndex,
                    decision: detectScreenshotOverlap(
                        screenshotList[leftIndex],
                        screenshotList[rightIndex]
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
        const manualReviewReasons = overlapDecisions.flatMap(decision => (
            decision.manual_review_reasons.filter(reason => reason === 'screenshot_overlap_uncertain')
        ));

        return {
            cards,
            overlap_decisions: overlapDecisions,
            manual_review_reasons: manualReviewReasons
        };
    };

    const DIAGNOSTIC_FORBIDDEN_VALUE_PATTERN = /data:image\/|authorization|bearer|api[\s_-]*key|test[\s_-]*key|credentials?|password|firebase(?:[\s_-]*(?:api[\s_-]*key|secret))?|gas[\s_-]*secret|AIza[0-9a-z_-]{20,}|AKfycb[0-9a-z_-]{20,}|(?:^|[^a-z0-9])sk-[a-z0-9_-]{8,}/i;
    const STRUCTURAL_RETRY_REASON_VALUES = new Set([
        'detected_card_count_mismatch',
        'scan_incomplete',
        'bottom_edge_not_checked',
        'invalid_card_coordinates',
        'duplicate_card_coordinates',
        'finish_reason_length'
    ]);
    const RAW_BACKGROUND_DIAGNOSTIC_VALUES = new Set([...BACKGROUND_TYPE_VALUES, 'global']);
    const sanitizeDiagnosticString = (value) => {
        if (!['string', 'number', 'boolean'].includes(typeof value)) return '';
        const normalized = String(value).normalize('NFKC');
        return DIAGNOSTIC_FORBIDDEN_VALUE_PATTERN.test(normalized) ? '' : normalized;
    };
    const diagnosticString = sanitizeDiagnosticString;
    const diagnosticNonnegativeInteger = (value) => {
        const number = Number(value);
        return Number.isInteger(number) && number >= 0 ? number : 0;
    };
    const diagnosticStrings = (values) => (Array.isArray(values) ? values : [])
        .filter(value => ['string', 'number', 'boolean'].includes(typeof value))
        .map(diagnosticString)
        .filter(Boolean);
    const diagnosticEnum = (value, values, fallback = 'uncertain') => {
        const normalized = diagnosticString(value).toLowerCase();
        return values.has(normalized) ? normalized : fallback;
    };
    const diagnosticReviewReasons = (values) => diagnosticStrings(values).filter(isHundoReviewReason);
    const diagnosticStructuralReasons = (values) => diagnosticStrings(values)
        .filter(reason => STRUCTURAL_RETRY_REASON_VALUES.has(reason));
    const diagnosticEvidence = (evidence, enumFields) => {
        const source = evidence && typeof evidence === 'object' ? evidence : {};
        return Object.fromEntries(Object.entries(enumFields).map(([field, values]) => [
            field,
            field === 'present'
                ? source[field] === true
                : diagnosticEnum(source[field], values)
        ]));
    };
    const diagnosticFormEvidence = (evidence) => {
        const source = evidence && typeof evidence === 'object' ? evidence : {};
        return {
            region_visibility: diagnosticEnum(source.region_visibility, REGION_VISIBILITY_VALUES),
            recognition_basis: diagnosticEnum(source.recognition_basis, FORM_RECOGNITION_BASIS_VALUES),
            visual_signature: diagnosticEnum(source.visual_signature, FORM_VISUAL_SIGNATURE_VALUES),
            key_features_visible: source.key_features_visible === true,
            label_relationship: diagnosticEnum(source.label_relationship, FORM_LABEL_RELATIONSHIP_VALUES)
        };
    };
    const DIAGNOSTIC_CROP_VISIBILITY_VALUES = new Set(['clear', 'partially_visible', 'cropped', 'not_visible', 'uncertain']);
    const DIAGNOSTIC_VERIFICATION_STATUS_VALUES = new Set([
        'pending', 'verified', 'uncertain', 'low_confidence', 'species_mismatch',
        'evidence_mismatch', 'invalid_result', 'structural_incomplete', 'request_failed', 'failed'
    ]);
    const diagnosticVerifierContract = () => {
        const evidence = globalThis.SmartHundoFormVerifier?.REQUIRED_VERIFIED_FORM_EVIDENCE || {};
        const values = field => new Set(['uncertain', ...Object.values(evidence).map(item => item?.[field]).filter(value => typeof value === 'string')]);
        return {
            verifiedForms: new Set(['uncertain', ...Object.keys(HUNDO_FORM_CANONICAL_NAMES)]),
            bodyPlans: values('body_plan'),
            limbLayouts: values('limb_layout'),
            fusionHosts: values('fusion_host'),
            decisiveFeatures: values('decisive_feature')
        };
    };
    const diagnosticStrictNonnegativeInteger = (value) => (
        typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : 0
    );
    const diagnosticOwnObjectValue = (value, field) => {
        try {
            if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
        } catch (_error) {
            return undefined;
        }
    };
    const diagnosticBbox = (bbox) => {
        const xMin = diagnosticOwnObjectValue(bbox, 'x_min');
        const yMin = diagnosticOwnObjectValue(bbox, 'y_min');
        const xMax = diagnosticOwnObjectValue(bbox, 'x_max');
        const yMax = diagnosticOwnObjectValue(bbox, 'y_max');
        if (![xMin, yMin, xMax, yMax].every(value => (
            typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 1000
        )) || xMin >= xMax || yMin >= yMax) return null;
        return { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax };
    };
    const diagnosticCropSourceSize = (size) => {
        const width = diagnosticOwnObjectValue(size, 'width');
        const height = diagnosticOwnObjectValue(size, 'height');
        if (![width, height].every(value => (
            typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
        ))) return null;
        return { width, height };
    };
    const diagnosticVerificationEvidence = (evidence) => {
        const value = field => diagnosticOwnObjectValue(evidence, field);
        const contract = diagnosticVerifierContract();
        return {
            crop_visibility: diagnosticEnum(value('crop_visibility'), DIAGNOSTIC_CROP_VISIBILITY_VALUES),
            body_plan: diagnosticEnum(value('body_plan'), contract.bodyPlans),
            limb_layout: diagnosticEnum(value('limb_layout'), contract.limbLayouts),
            fusion_host: diagnosticEnum(value('fusion_host'), contract.fusionHosts),
            decisive_feature: diagnosticEnum(value('decisive_feature'), contract.decisiveFeatures),
            key_features_visible: value('key_features_visible') === true
        };
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
        const rawForm = card?.raw?.form && typeof card.raw.form === 'object'
            ? card.raw.form
            : {};
        const rawState = (dimension, field, values) => diagnosticEnum(
            rawStates[dimension] ?? card?.[field],
            values
        );
        const rawConfidence = (dimension, field) => clampConfidence(
            rawConfidences[dimension] ?? card?.[field]
        );
        const evidence = (dimension, field, enumFields) => diagnosticEvidence(
            rawEvidence[dimension] ?? card?.[field],
            enumFields
        );
        const diagnosticBaseSpecies = diagnosticString(card?.base_species);
        const rawFormId = diagnosticEnum(rawForm.form_id ?? card?.form_id, HUNDO_FORM_ID_VALUES);
        const effectiveFormId = diagnosticEnum(card?.effective_form_id, HUNDO_FORM_ID_VALUES);
        const isTargetFormCard = Object.hasOwn(HUNDO_FORMS_BY_BASE_SPECIES, diagnosticBaseSpecies);
        const verifierContract = diagnosticVerifierContract();

        return {
            card_id: diagnosticString(card?.card_id),
            order: diagnosticNonnegativeInteger(card?.order),
            row: diagnosticNonnegativeInteger(card?.row),
            column: diagnosticNonnegativeInteger(card?.column),
            cp: diagnosticString(card?.cp),
            visible_label: diagnosticString(card?.visible_label),
            official_name: diagnosticString(stripSmartHundoPresentationPrefixes(card?.official_name)),
            recognition_status: diagnosticEnum(card?.recognition_status, RECOGNITION_VALUES),
            raw_states: {
                shiny: rawState('shiny', 'shiny_state', INDEPENDENT_STATE_VALUES),
                lucky: rawState('lucky', 'lucky_state', INDEPENDENT_STATE_VALUES),
                favorite: rawState('favorite', 'favorite_state', INDEPENDENT_STATE_VALUES),
                rocket: rawState('rocket', 'rocket_state', ROCKET_STATE_VALUES),
                background: rawState('background', 'background_type', RAW_BACKGROUND_DIAGNOSTIC_VALUES)
            },
            raw_confidences: {
                shiny: rawConfidence('shiny', 'shiny_confidence'),
                lucky: rawConfidence('lucky', 'lucky_confidence'),
                favorite: rawConfidence('favorite', 'favorite_confidence'),
                rocket: rawConfidence('rocket', 'rocket_confidence'),
                background: rawConfidence('background', 'background_confidence')
            },
            raw_evidence: {
                shiny: evidence('shiny', 'shiny_evidence', {
                    present: null,
                    region_visibility: REGION_VISIBILITY_VALUES,
                    position: SHINY_POSITION_VALUES,
                    color: SHINY_COLOR_VALUES,
                    shape: SHINY_SHAPE_VALUES
                }),
                lucky: evidence('lucky', 'lucky_evidence', {
                    present: null,
                    region_visibility: REGION_VISIBILITY_VALUES,
                    position: LUCKY_POSITION_VALUES,
                    appearance: LUCKY_APPEARANCE_VALUES
                }),
                favorite: evidence('favorite', 'favorite_evidence', {
                    present: null,
                    region_visibility: REGION_VISIBILITY_VALUES,
                    position: FAVORITE_POSITION_VALUES,
                    appearance: FAVORITE_APPEARANCE_VALUES
                }),
                rocket: evidence('rocket', 'rocket_evidence', {
                    present: null,
                    region_visibility: REGION_VISIBILITY_VALUES,
                    position: ROCKET_POSITION_VALUES,
                    color: ROCKET_COLOR_VALUES,
                    shape: ROCKET_SHAPE_VALUES
                }),
                background: evidence('background', 'background_evidence', {
                    present: null,
                    region_visibility: REGION_VISIBILITY_VALUES,
                    position: BACKGROUND_POSITION_VALUES,
                    badge_type: BADGE_TYPE_VALUES,
                    appearance: BACKGROUND_APPEARANCE_VALUES
                })
            },
            effective_states: {
                shiny: diagnosticEnum(card?.effective_shiny_state, INDEPENDENT_STATE_VALUES),
                lucky: diagnosticEnum(card?.effective_lucky_state, INDEPENDENT_STATE_VALUES),
                favorite: diagnosticEnum(card?.effective_favorite_state, INDEPENDENT_STATE_VALUES),
                rocket: diagnosticEnum(card?.effective_rocket_state, ROCKET_STATE_VALUES),
                background: diagnosticEnum(card?.effective_background_type, BACKGROUND_TYPE_VALUES)
            },
            base_species: diagnosticBaseSpecies,
            raw_form_id: rawFormId,
            form_confidence: clampConfidence(rawForm.form_confidence ?? card?.form_confidence),
            form_evidence: diagnosticFormEvidence(rawForm.form_evidence ?? card?.form_evidence),
            effective_form_id: effectiveFormId,
            canonical_official_name: HUNDO_SUPPORTED_FORM_IDS.has(effectiveFormId)
                ? HUNDO_FORM_CANONICAL_NAMES[effectiveFormId]
                : effectiveFormId === 'not_applicable'
                    ? diagnosticString(card?.canonical_official_name)
                    : '',
            ...(isTargetFormCard ? {
                primary_form_id: diagnosticEnum(card?.primary_form_id, HUNDO_FORM_ID_VALUES),
                primary_effective_form_id: diagnosticEnum(card?.primary_effective_form_id, HUNDO_FORM_ID_VALUES),
                primary_form_confidence: clampStrictConfidence(card?.primary_form_confidence),
                card_bbox: diagnosticBbox(card?.card_bbox),
                pokemon_bbox: diagnosticBbox(card?.pokemon_bbox),
                bbox_confidence: clampStrictConfidence(card?.bbox_confidence),
                bbox_visibility: diagnosticEnum(card?.bbox_visibility, DIAGNOSTIC_CROP_VISIBILITY_VALUES),
                crop_source_size: diagnosticCropSourceSize(card?.crop_source_size),
                contact_sheet_id: /^\d+:form:\d+$/.test(diagnosticString(card?.contact_sheet_id))
                    ? diagnosticString(card?.contact_sheet_id)
                    : '',
                tile_id: /^T[1-6]$/.test(diagnosticString(card?.tile_id)) ? diagnosticString(card?.tile_id) : '',
                stage2_candidate_form_ids: diagnosticStrings(card?.stage2_candidate_form_ids)
                    .filter(value => verifierContract.verifiedForms.has(value)),
                verified_form_id: diagnosticEnum(card?.verified_form_id, verifierContract.verifiedForms),
                verification_confidence: clampStrictConfidence(card?.verification_confidence),
                verification_evidence: diagnosticVerificationEvidence(card?.verification_evidence),
                verification_status: diagnosticEnum(card?.verification_status, DIAGNOSTIC_VERIFICATION_STATUS_VALUES)
            } : {}),
            primary_background_type: diagnosticEnum(card?.primary_background_type, BACKGROUND_TYPE_VALUES),
            primary_effective_background_type: diagnosticEnum(card?.primary_effective_background_type, BACKGROUND_TYPE_VALUES),
            verified_background_type: diagnosticEnum(card?.verified_background_type, BACKGROUND_TYPE_VALUES),
            background_verification_status: diagnosticString(card?.background_verification_status),
            manual_review_reasons: diagnosticReviewReasons(card?.manual_review_reasons)
        };
    };
    const diagnosticOverlapDecision = (decision = {}) => ({
        direction: ['left_suffix_right_prefix', 'right_suffix_left_prefix'].includes(decision?.direction)
            ? decision.direction
            : 'none',
        overlap_count: diagnosticNonnegativeInteger(decision?.overlap_count),
        ambiguous: decision?.ambiguous === true,
        matched_card_ids: diagnosticStrings(decision?.matched_card_ids),
        manual_review_reasons: diagnosticReviewReasons(decision?.manual_review_reasons)
    });
    const diagnosticFormVerificationMetrics = (source = {}) => ({
        target_candidate_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'target_candidate_count')),
        background_candidate_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'background_candidate_count')),
        background_verified_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'background_verified_count')),
        target_verified_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'target_verified_count')),
        target_review_card_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'target_review_card_count')),
        contact_sheet_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'contact_sheet_count')),
        verifier_request_count: diagnosticStrictNonnegativeInteger(diagnosticOwnObjectValue(source, 'verifier_request_count')),
        form_verify_model: diagnosticString(diagnosticOwnObjectValue(source, 'form_verify_model')) === 'gpt-5.6-sol' ? 'gpt-5.6-sol' : ''
    });
    const shapeSmartHundoDiagnostics = (session = {}) => ({
        scan_session_id: diagnosticString(session?.scan_session_id),
        screenshots: (Array.isArray(session?.screenshots) ? session.screenshots : []).map(screenshot => ({
            index: diagnosticNonnegativeInteger(screenshot?.index),
            classification: {
                image_type: diagnosticString(screenshot?.classification?.image_type),
                search_query: diagnosticString(screenshot?.classification?.search_query)
            },
            normalized_search_query: diagnosticString(screenshot?.normalized_search_query),
            raw_count_text: diagnosticString(screenshot?.raw_count_text),
            validated_count: /^(0|[1-9]\d*)$/.test(diagnosticString(screenshot?.validated_count))
                ? diagnosticString(screenshot?.validated_count)
                : '',
            count_source: diagnosticEnum(screenshot?.count_source, HUNDO_COUNT_SOURCE_VALUES),
            count_confidence: clampConfidence(screenshot?.count_confidence),
            detected_card_count: diagnosticNonnegativeInteger(screenshot?.detected_card_count),
            cards_length: diagnosticNonnegativeInteger(screenshot?.cards_length),
            scan_complete: screenshot?.scan_complete === true,
            bottom_edge_checked: screenshot?.bottom_edge_checked === true,
            finish_reason: diagnosticString(screenshot?.finish_reason),
            classification_model: diagnosticString(screenshot?.classification_model),
            hundo_count_model: diagnosticString(screenshot?.hundo_count_model),
            smart_hundo_requested_model: diagnosticString(screenshot?.smart_hundo_requested_model),
            smart_hundo_returned_model: diagnosticString(screenshot?.smart_hundo_returned_model),
            smart_hundo_reasoning_effort: diagnosticString(screenshot?.smart_hundo_reasoning_effort),
            structural_retry_used: screenshot?.structural_retry_used === true,
            structural_retry_reason: diagnosticStructuralReasons(screenshot?.structural_retry_reason),
            cards: (Array.isArray(screenshot?.cards) ? screenshot.cards : []).map(diagnosticCard),
            ...diagnosticFormVerificationMetrics(screenshot)
        })),
        count_candidates: (Array.isArray(session?.count_candidates) ? session.count_candidates : [])
            .filter(candidate => (
                /^(0|[1-9]\d*)$/.test(diagnosticString(candidate?.value))
                && Number.isInteger(candidate?.votes)
                && candidate.votes >= 0
            ))
            .map(candidate => ({
                value: diagnosticString(candidate?.value),
                votes: candidate.votes,
                confidence: clampConfidence(candidate?.confidence)
            })),
        count_conflict: session?.count_conflict === true,
        overlap_decisions: (Array.isArray(session?.overlap_decisions) ? session.overlap_decisions : [])
            .map(diagnosticOverlapDecision),
        manual_review_reasons: diagnosticReviewReasons(session?.manual_review_reasons),
        pokemon_list: diagnosticString(session?.pokemon_list),
        ...diagnosticFormVerificationMetrics(session)
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
        smart_hundo_request_failed: '百神辨識請求失敗',
        smart_hundo_model_request_failed: 'GPT-5.4 Mini 百神卡片辨識失敗，請人工確認',
        form_uncertain: '型態需人工確認',
        form_species_mismatch: '物種與型態結果衝突',
        form_region_not_clear: '型態主要外觀區域看不清楚',
        form_confidence_low: '型態辨識信心不足',
        form_label_only: '型態只有文字證據，需人工確認',
        form_signature_mismatch: '型態與視覺證據不一致',
        unsupported_form: '此型態尚未納入支援範圍',
        form_crop_missing: '找不到可用的寶可夢本體裁切區域',
        form_crop_not_clear: '寶可夢本體裁切不完整，型態需人工確認',
        form_crop_too_small: '寶可夢本體像素太小，型態需人工確認',
        form_verifier_uncertain: '放大型態複核仍無法確定',
        form_verifier_low_confidence: '放大型態複核信心不足',
        form_verifier_species_mismatch: '型態複核物種與原卡片不一致',
        form_verifier_evidence_mismatch: '型態複核結果與身體結構證據不一致',
        form_verifier_invalid_result: '型態複核回傳格式或卡片對應錯誤',
        form_verifier_structural_incomplete: '型態複核未回傳全部候選卡片',
        form_verification_request_failed: '型態複核請求失敗',
        background_crop_not_clear: '背卡徽章區域裁切不完整，需人工確認',
        background_verifier_evidence_mismatch: '背卡複核證據不一致',
        background_verifier_low_confidence: '背卡複核信心不足',
        background_verifier_invalid_result: '背卡複核卡片對應錯誤',
        background_verifier_structural_incomplete: '背卡複核未回傳全部候選卡片',
        background_verification_request_failed: '背卡複核請求失敗'
    });

    const isHundoReviewReason = (reason) => Object.prototype.hasOwnProperty.call(HUNDO_REVIEW_REASON_MESSAGES, reason);

    const hasConfidentRecognizedBaseSpecies = (card = {}) => (
        card?.recognition_status === 'recognized'
        && (
            stringValue(card?.base_species) !== ''
            || stripSmartHundoPresentationPrefixes(card?.official_name) !== ''
        )
        && Number(card?.species_confidence) >= SPECIES_CONFIDENCE_THRESHOLD
    );

    const hasUsableRecognizedSpecies = (card = {}) => (
        hasConfidentRecognizedBaseSpecies(card)
        && stringValue(card?.canonical_official_name) !== ''
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

    const deriveEffectiveShinyState = (rawState, confidence, evidence) => deriveIndependentState(
        rawState, confidence, evidence, isValidShinyEvidence, ['position', 'color', 'shape']
    );

    const deriveEffectiveFavoriteState = (rawState, confidence, evidence) => deriveIndependentState(
        rawState, confidence, evidence, isValidFavoriteEvidence, ['position', 'appearance']
    );

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
            shiny: deriveEffectiveShinyState(card?.shiny_state, card?.shiny_confidence, card?.shiny_evidence),
            lucky: deriveIndependentState(
                card?.lucky_state,
                card?.lucky_confidence,
                card?.lucky_evidence,
                isValidLuckyEvidence,
                ['position', 'appearance']
            ),
            favorite: deriveEffectiveFavoriteState(card?.favorite_state, card?.favorite_confidence, card?.favorite_evidence),
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
        if (!hasConfidentRecognizedBaseSpecies(card)) appendReasonOnce('species_uncertain');
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

    const FORM_VALIDATION_REASON_CODES = new Set([
        'form_uncertain',
        'form_species_mismatch',
        'form_region_not_clear',
        'form_confidence_low',
        'form_label_only',
        'form_signature_mismatch',
        'unsupported_form'
    ]);

    const buildHundoCanonicalOfficialName = (card = {}, normalizeOfficialName) => {
        if (HUNDO_SUPPORTED_FORM_IDS.has(card?.effective_form_id)) {
            return HUNDO_FORM_CANONICAL_NAMES[card.effective_form_id];
        }
        if (card?.effective_form_id === 'not_applicable') {
            return normalizeHundoBaseSpecies(card?.base_species, normalizeOfficialName);
        }
        return '';
    };

    const validateHundoPokemonForm = (card = {}, normalizeOfficialName) => {
        const existingReasons = Array.isArray(card?.manual_review_reasons)
            ? card.manual_review_reasons.filter(reason => !FORM_VALIDATION_REASON_CODES.has(reason))
            : [];
        const manualReviewReasons = [...new Set(existingReasons)];
        const reject = (...reasons) => {
            reasons.forEach(reason => {
                if (!manualReviewReasons.includes(reason)) manualReviewReasons.push(reason);
            });
            return {
                ...card,
                effective_form_id: 'uncertain',
                canonical_official_name: '',
                manual_review_reasons: manualReviewReasons
            };
        };
        const baseSpecies = card?.base_species;
        const formId = card?.form_id;
        const formEvidence = card?.form_evidence || {};
        const speciesConfidence = clampStrictConfidence(card?.species_confidence);
        const formConfidence = clampStrictConfidence(card?.form_confidence);

        if (!Object.hasOwn(HUNDO_FORMS_BY_BASE_SPECIES, baseSpecies)) {
            const hasRawFormSnapshot = card?.raw?.form && typeof card.raw.form === 'object';
            const rawForm = hasRawFormSnapshot ? card.raw.form : {};
            const hasFormContractFlag = card?.raw
                && typeof card.raw === 'object'
                && Object.hasOwn(card.raw, 'form_contract_present');
            const hasStructuredForm = hasFormContractFlag
                ? card.raw.form_contract_present === true
                : hasRawFormSnapshot
                    ? stringValue(rawForm.base_species) !== '' || stringValue(rawForm.form_id) !== ''
                    : ['base_species', 'form_id', 'form_confidence', 'form_evidence']
                        .some(field => Object.hasOwn(card || {}, field));
            if (hasStructuredForm) {
                const validationReasons = [];
                const addValidationReason = (reason) => {
                    if (!validationReasons.includes(reason)) validationReasons.push(reason);
                };
                const structuredFormId = hasRawFormSnapshot
                    ? stringValue(rawForm.form_id).toLowerCase()
                    : stringValue(formId).toLowerCase();
                const structuredVisualSignature = hasRawFormSnapshot
                    ? rawForm.form_evidence?.visual_signature
                    : formEvidence.visual_signature;
                if (structuredFormId === 'uncertain') addValidationReason('form_uncertain');
                else if (structuredFormId === 'unsupported') addValidationReason('unsupported_form');
                else if (HUNDO_SUPPORTED_FORM_IDS.has(structuredFormId)) addValidationReason('form_species_mismatch');
                else if (structuredFormId !== 'not_applicable') addValidationReason('form_uncertain');
                if (structuredVisualSignature !== 'not_applicable') {
                    addValidationReason('form_signature_mismatch');
                }
                if (validationReasons.length > 0) return reject(...validationReasons);
            }
            const result = {
                ...card,
                effective_form_id: 'not_applicable',
                manual_review_reasons: manualReviewReasons
            };
            return {
                ...result,
                canonical_official_name: buildHundoCanonicalOfficialName(result, normalizeOfficialName)
            };
        }
        if (formId === 'unsupported') return reject('unsupported_form');
        if (formId === 'uncertain' || !HUNDO_SUPPORTED_FORM_IDS.has(formId)) return reject('form_uncertain');
        if (!HUNDO_FORMS_BY_BASE_SPECIES[baseSpecies].includes(formId)) return reject('form_species_mismatch');
        if (formEvidence.visual_signature !== formId) return reject('form_signature_mismatch');
        const validationReasons = [];
        const addValidationReason = (reason) => {
            if (!validationReasons.includes(reason)) validationReasons.push(reason);
        };
        const isPartiallyOccluded = formEvidence.region_visibility === 'partially_occluded';
        if (formEvidence.label_relationship === 'conflicting') addValidationReason('form_species_mismatch');
        if (formEvidence.recognition_basis === 'label_only') addValidationReason('form_label_only');
        if (!['clear', 'partially_occluded'].includes(formEvidence.region_visibility)) {
            addValidationReason('form_region_not_clear');
        }
        if (speciesConfidence < SPECIES_CONFIDENCE_THRESHOLD) {
            addValidationReason('species_uncertain');
            addValidationReason('form_uncertain');
        }
        const minimumFormConfidence = isPartiallyOccluded
            ? FORM_PARTIAL_VISIBILITY_THRESHOLD
            : FORM_CONFIDENCE_THRESHOLD;
        if (formConfidence < minimumFormConfidence) {
            if (isPartiallyOccluded) addValidationReason('form_region_not_clear');
            addValidationReason('form_confidence_low');
        }
        if (!['direct_visual_match', 'visual_and_label'].includes(formEvidence.recognition_basis)) {
            addValidationReason('form_uncertain');
        }
        if (formEvidence.key_features_visible !== true) addValidationReason('form_uncertain');
        if (
            isPartiallyOccluded
            && (formEvidence.recognition_basis !== 'direct_visual_match' || formEvidence.key_features_visible !== true)
        ) {
            addValidationReason('form_region_not_clear');
        }
        if (validationReasons.length > 0) return reject(...validationReasons);

        const result = {
            ...card,
            effective_form_id: formId,
            manual_review_reasons: manualReviewReasons
        };
        return {
            ...result,
            canonical_official_name: buildHundoCanonicalOfficialName(result, normalizeOfficialName)
        };
    };

    const reviewReasonCodes = (card = {}) => {
        const reasons = Array.isArray(card?.manual_review_reasons)
            ? card.manual_review_reasons.filter(isHundoReviewReason)
            : [];
        if (!hasConfidentRecognizedBaseSpecies(card)) reasons.push('species_uncertain');
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

    const buildHundoDisplayName = (card = {}) => {
        if (!hasUsableRecognizedSpecies(card)) return '';
        const canonicalOfficialName = stringValue(card?.canonical_official_name);
        if (!canonicalOfficialName) return '';
        const prefix = [
            card?.effective_shiny_state === 'yes' ? '色違' : '',
            deriveRocketDisplayClass(card) === 'shadow' ? '暗影' : '',
            card?.effective_background_type === 'commemorative' ? '紀念背卡' : '',
            card?.effective_background_type === 'special' ? '特別背卡' : ''
        ].join('');
        return `${prefix}${canonicalOfficialName}`;
    };

    const deriveRocketDisplayClass = (card = {}) => {
        const effectiveState = card?.effective_rocket_state;
        if (effectiveState === 'shadow') return 'shadow';
        if (effectiveState === 'normal' || effectiveState === 'purified') return 'ordinary';

        const rawState = card?.rocket_state;
        const evidence = card?.rocket_evidence || {};
        const shadowLikeEvidence = (
            evidence.color === 'purple'
            || ['purple_flame', 'purple_smoke', 'shadow_aura'].includes(evidence.shape)
            || deriveRocketStateFromEvidence(evidence) === 'shadow'
        );
        if (
            ['normal', 'purified'].includes(rawState)
            && evidence.region_visibility === 'clear'
            && !shadowLikeEvidence
        ) return 'ordinary';
        return 'uncertain';
    };

    const hasDisplayAffectingUncertainty = (card = {}) => (
        !hasUsableRecognizedSpecies(card)
        || !stringValue(card?.canonical_official_name)
        || card?.effective_form_id === 'uncertain'
        || card?.effective_shiny_state === 'uncertain'
        || deriveRocketDisplayClass(card) === 'uncertain'
        || card?.effective_background_type === 'uncertain'
    );

    const buildHundoListEntry = (card = {}) => {
        if (!hasDisplayAffectingUncertainty(card)) {
            return { value: buildHundoDisplayName(card), status: 'resolved' };
        }
        const digits = stringValue(card?.cp).normalize('NFKC').replace(/\D/g, '');
        return { value: digits ? `待確認（CP${digits}）` : '待確認', status: 'unresolved' };
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

    const smartHundoCardsToPokemonList = (cards = []) => {
        const entries = [];
        const displayGroups = new Map();
        let recognizedCount = 0;

        (Array.isArray(cards) ? cards : []).forEach(card => {
            const entry = buildHundoListEntry(card);
            if (entry.status === 'unresolved') {
                entries.push(entry);
                return;
            }
            if (!displayGroups.has(entry.value)) {
                displayGroups.set(entry.value, { count: 0, index: entries.length });
                entries.push(entry);
            }
            displayGroups.get(entry.value).count += 1;
            recognizedCount += 1;
        });

        const manualReview = summarizeHundoManualReview(cards);
        return {
            pokemon_list: entries.map(entry => {
                if (entry.status === 'unresolved') return entry.value;
                const count = displayGroups.get(entry.value).count;
                return count > 1 ? `${entry.value}*${count}` : entry.value;
            }).join(','),
            recognized_count: recognizedCount,
            review_card_count: manualReview.review_card_count,
            review_reason_counts: manualReview.review_reason_counts
        };
    };

    const api = {
        normalizeSearchQuery,
        isSmartHundoClassification,
        partitionImageJobs,
        adaptLegacyRocketState,
        HUNDO_STATE_POSITION_VALUES,
        HUNDO_FORM_CANONICAL_NAMES,
        HUNDO_FORMS_BY_BASE_SPECIES,
        normalizeHundoBaseSpecies,
        normalizeHundoFormId,
        normalizeHundoFormEvidence,
        adaptLegacyHundoForm,
        normalizeSmartHundoCard,
        normalizeSmartHundoResult,
        normalizeVisibleLabel,
        detectScreenshotOverlap,
        mergeSmartHundoScreenshots,
        shapeSmartHundoDiagnostics,
        validateSmartHundoStructure,
        normalizeHundoCountResult,
        validateHundoCountEvidence,
        mergeHundoCountResults,
        HUNDO_COUNT_CONFIDENCE_THRESHOLD,
        SPECIES_CONFIDENCE_THRESHOLD,
        FORM_CONFIDENCE_THRESHOLD,
        FORM_PARTIAL_VISIBILITY_THRESHOLD,
        STATE_YES_CONFIDENCE_THRESHOLD,
        STATE_NEGATIVE_CONFIDENCE_THRESHOLD,
        ENUMERATION_CONFIDENCE_THRESHOLD,
        isValidShinyEvidence,
        isValidLuckyEvidence,
        isValidFavoriteEvidence,
        deriveRocketStateFromEvidence,
        deriveBackgroundTypeFromEvidence,
        deriveEffectiveShinyState,
        deriveEffectiveFavoriteState,
        deriveEffectiveRocketState,
        deriveEffectiveBackgroundType,
        validateHundoCardStates,
        validateHundoPokemonForm,
        buildHundoCanonicalOfficialName,
        HUNDO_REVIEW_REASON_MESSAGES,
        deriveRocketDisplayClass,
        buildHundoDisplayName,
        hasDisplayAffectingUncertainty,
        buildHundoListEntry,
        smartHundoCardsToPokemonList,
        summarizeHundoManualReview
    };

    global.SmartHundoHelpers = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
