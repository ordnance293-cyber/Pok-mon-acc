(function (global) {
    'use strict';

    if (!global.SmartHundoVisualRules && typeof require === 'function') global.SmartHundoVisualRules = require('./smart-hundo-visual-rules.js');
    const sharedVisualRules = global.SmartHundoVisualRules;
    if (!sharedVisualRules) throw new Error('SmartHundoVisualRules must be loaded before SmartHundoFormVerifier');

    const VERIFIED_FORM_IDS_BY_BASE_SPECIES = Object.freeze({
        急凍鳥: Object.freeze(['articuno_standard', 'articuno_galarian', 'uncertain']),
        閃電鳥: Object.freeze(['zapdos_standard', 'zapdos_galarian', 'uncertain']),
        火焰鳥: Object.freeze(['moltres_standard', 'moltres_galarian', 'uncertain']),
        蒼響: Object.freeze(['zacian_standard', 'zacian_crowned', 'uncertain']),
        藏瑪然特: Object.freeze(['zamazenta_standard', 'zamazenta_crowned', 'uncertain']),
        帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin', 'uncertain']),
        帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin', 'uncertain']),
        基格爾德: Object.freeze(['zygarde_10', 'zygarde_50', 'zygarde_complete', 'uncertain']),
        奈克洛茲瑪: Object.freeze(['necrozma_base', 'necrozma_dusk_mane', 'necrozma_dawn_wings', 'uncertain']),
        酋雷姆: Object.freeze(['kyurem_base', 'kyurem_white', 'kyurem_black', 'uncertain'])
    });
    const TARGET_HUNDO_FORM_BASE_SPECIES = Object.freeze(Object.keys(VERIFIED_FORM_IDS_BY_BASE_SPECIES));
    const REQUIRED_VERIFIED_FORM_EVIDENCE = Object.freeze({
        articuno_standard: Object.freeze({ base_species: '急凍鳥', body_plan: 'articuno_broad_seabird', limb_layout: 'two_broad_rounded_wings', fusion_host: 'not_applicable', decisive_feature: 'articuno_standard_crest_and_long_tail', visual_rule: sharedVisualRules.visualRuleForForm('articuno_standard') }),
        articuno_galarian: Object.freeze({ base_species: '急凍鳥', body_plan: 'articuno_slender_raptor', limb_layout: 'two_angular_swept_wings', fusion_host: 'not_applicable', decisive_feature: 'articuno_galarian_mask_and_angular_wings', visual_rule: sharedVisualRules.visualRuleForForm('articuno_galarian') }),
        zapdos_standard: Object.freeze({ base_species: '閃電鳥', body_plan: 'zapdos_spiky_bird', limb_layout: 'two_jagged_spread_wings', fusion_host: 'not_applicable', decisive_feature: 'zapdos_standard_spikes_and_short_legs', visual_rule: sharedVisualRules.visualRuleForForm('zapdos_standard') }),
        zapdos_galarian: Object.freeze({ base_species: '閃電鳥', body_plan: 'zapdos_tall_running_bird', limb_layout: 'reduced_wings_and_long_running_legs', fusion_host: 'not_applicable', decisive_feature: 'zapdos_galarian_long_legs_and_runner_posture', visual_rule: sharedVisualRules.visualRuleForForm('zapdos_galarian') }),
        moltres_standard: Object.freeze({ base_species: '火焰鳥', body_plan: 'moltres_broad_flying_bird', limb_layout: 'two_broad_flame_edged_wings', fusion_host: 'not_applicable', decisive_feature: 'moltres_standard_flame_wings_and_tail', visual_rule: sharedVisualRules.visualRuleForForm('moltres_standard') }),
        moltres_galarian: Object.freeze({ base_species: '火焰鳥', body_plan: 'moltres_vulture_like_bird', limb_layout: 'two_long_angular_wings', fusion_host: 'not_applicable', decisive_feature: 'moltres_galarian_vulture_posture_and_flame_aura', visual_rule: sharedVisualRules.visualRuleForForm('moltres_galarian') }),
        zacian_standard: Object.freeze({ base_species: '蒼響', body_plan: 'zacian_ordinary_wolf', limb_layout: 'four_unarmored_wolf_legs', fusion_host: 'not_applicable', decisive_feature: 'zacian_standard_no_mouth_sword', visual_rule: sharedVisualRules.visualRuleForForm('zacian_standard') }),
        zacian_crowned: Object.freeze({ base_species: '蒼響', body_plan: 'zacian_armored_sword_wolf', limb_layout: 'four_armored_wolf_legs', fusion_host: 'not_applicable', decisive_feature: 'zacian_crowned_visible_mouth_sword', visual_rule: sharedVisualRules.visualRuleForForm('zacian_crowned') }),
        zamazenta_standard: Object.freeze({ base_species: '藏瑪然特', body_plan: 'zamazenta_ordinary_wolf', limb_layout: 'four_unarmored_wolf_legs', fusion_host: 'not_applicable', decisive_feature: 'zamazenta_standard_clear_head_neck_chest_without_shield_mane', visual_rule: sharedVisualRules.visualRuleForForm('zamazenta_standard') }),
        zamazenta_crowned: Object.freeze({ base_species: '藏瑪然特', body_plan: 'zamazenta_shield_armored_wolf', limb_layout: 'four_shield_armored_wolf_legs', fusion_host: 'not_applicable', decisive_feature: 'zamazenta_crowned_shield_mane_and_chest_armor', visual_rule: sharedVisualRules.visualRuleForForm('zamazenta_crowned') }),
        dialga_standard: Object.freeze({ base_species: '帝牙盧卡', body_plan: 'dialga_stocky_wide_quadruped', limb_layout: 'four_standard_legs', fusion_host: 'not_applicable', decisive_feature: 'dialga_standard_stocky_neck_chest', visual_rule: sharedVisualRules.visualRuleForForm('dialga_standard') }),
        dialga_origin: Object.freeze({ base_species: '帝牙盧卡', body_plan: 'dialga_elongated_equine_quadruped', limb_layout: 'four_long_legs', fusion_host: 'not_applicable', decisive_feature: 'dialga_origin_elongated_neck_chest', visual_rule: sharedVisualRules.visualRuleForForm('dialga_origin') }),
        palkia_standard: Object.freeze({ base_species: '帕路奇亞', body_plan: 'palkia_upright_biped_with_arms', limb_layout: 'two_arms_two_legs', fusion_host: 'not_applicable', decisive_feature: 'palkia_standard_visible_arms', visual_rule: sharedVisualRules.visualRuleForForm('palkia_standard') }),
        palkia_origin: Object.freeze({ base_species: '帕路奇亞', body_plan: 'palkia_centaur_quadruped', limb_layout: 'four_legs_no_standard_arms', fusion_host: 'not_applicable', decisive_feature: 'palkia_origin_centaur_body', visual_rule: sharedVisualRules.visualRuleForForm('palkia_origin') }),
        zygarde_10: Object.freeze({ base_species: '基格爾德', body_plan: 'zygarde_canid_low_body', limb_layout: 'four_canid_legs', fusion_host: 'not_applicable', decisive_feature: 'zygarde_10_dog_architecture', visual_rule: sharedVisualRules.visualRuleForForm('zygarde_10') }),
        zygarde_50: Object.freeze({ base_species: '基格爾德', body_plan: 'zygarde_serpentine_cobra', limb_layout: 'serpentine_no_legs', fusion_host: 'not_applicable', decisive_feature: 'zygarde_50_cobra_hood_architecture', visual_rule: sharedVisualRules.visualRuleForForm('zygarde_50') }),
        zygarde_complete: Object.freeze({ base_species: '基格爾德', body_plan: 'zygarde_complete_humanoid_giant', limb_layout: 'two_massive_legs_and_wing_arms', fusion_host: 'not_applicable', decisive_feature: 'zygarde_complete_humanoid_architecture', visual_rule: sharedVisualRules.visualRuleForForm('zygarde_complete') }),
        necrozma_base: Object.freeze({ base_species: '奈克洛茲瑪', body_plan: 'necrozma_upright_crystalline', limb_layout: 'upright_crystalline_limbs', fusion_host: 'none', decisive_feature: 'necrozma_base_crystal_body', visual_rule: sharedVisualRules.visualRuleForForm('necrozma_base') }),
        necrozma_dusk_mane: Object.freeze({ base_species: '奈克洛茲瑪', body_plan: 'necrozma_quadruped_lion', limb_layout: 'quadruped_lion', fusion_host: 'solgaleo', decisive_feature: 'necrozma_dusk_mane_lion_crystal_armor', visual_rule: sharedVisualRules.visualRuleForForm('necrozma_dusk_mane') }),
        necrozma_dawn_wings: Object.freeze({ base_species: '奈克洛茲瑪', body_plan: 'necrozma_wide_moon_wings', limb_layout: 'giant_wings_no_lion_body', fusion_host: 'lunala', decisive_feature: 'necrozma_dawn_wings_moon_wings', visual_rule: sharedVisualRules.visualRuleForForm('necrozma_dawn_wings') }),
        kyurem_base: Object.freeze({ base_species: '酋雷姆', body_plan: 'kyurem_hunched_asymmetric_dragon', limb_layout: 'two_arms_two_legs_asymmetric_wings', fusion_host: 'none', decisive_feature: 'kyurem_base_unfused_hunched_architecture', visual_rule: sharedVisualRules.visualRuleForForm('kyurem_base') }),
        kyurem_white: Object.freeze({ base_species: '酋雷姆', body_plan: 'kyurem_reshiram_fusion_dragon', limb_layout: 'two_arms_two_legs_feathered_wings', fusion_host: 'reshiram', decisive_feature: 'kyurem_white_reshiram_wings_and_turbine_tail', visual_rule: sharedVisualRules.visualRuleForForm('kyurem_white') }),
        kyurem_black: Object.freeze({ base_species: '酋雷姆', body_plan: 'kyurem_zekrom_fusion_dragon', limb_layout: 'two_arms_two_legs_angular_wings', fusion_host: 'zekrom', decisive_feature: 'kyurem_black_zekrom_arms_and_generator_tail', visual_rule: sharedVisualRules.visualRuleForForm('kyurem_black') })
    });
    sharedVisualRules.validateCoverage(Object.values(VERIFIED_FORM_IDS_BY_BASE_SPECIES).flat().filter(id => id !== 'uncertain'));
    const HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD = 0.80;
    const HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD = 0.90;
    const HUNDO_FORM_VERIFY_PARTIAL_THRESHOLD = 0.95;
    const HUNDO_FORM_VERIFY_BATCH_SIZE = 6;
    const HUNDO_FORM_MIN_SOURCE_PIXELS = 64;
    const HUNDO_FORM_VERIFIER_REVIEW_REASON_MESSAGES = Object.freeze({
        form_crop_missing: '找不到可用的寶可夢本體裁切區域',
        form_crop_not_clear: '寶可夢本體裁切不完整，型態需人工確認',
        form_crop_too_small: '寶可夢本體像素太小，型態需人工確認',
        form_verifier_uncertain: '放大型態複核仍無法確定',
        form_verifier_low_confidence: '放大型態複核信心不足',
        form_verifier_species_mismatch: '型態複核物種與原卡片不一致',
        form_verifier_evidence_mismatch: '型態複核結果與身體結構證據不一致',
        form_verifier_invalid_result: '型態複核回傳格式或卡片對應錯誤',
        form_verifier_structural_incomplete: '型態複核未回傳全部候選卡片',
        form_verification_request_failed: '型態複核請求失敗'
    });
    const BBOX_KEYS = Object.freeze(['x_min', 'y_min', 'x_max', 'y_max']);
    const BBOX_VISIBILITY_VALUES = new Set(['clear', 'partially_visible', 'cropped', 'not_visible', 'uncertain']);
    const USABLE_BBOX_VISIBILITY_VALUES = new Set(['clear', 'partially_visible']);
    const FORM_VALIDATION_REASON_CODES = new Set([
        'form_uncertain',
        'form_species_mismatch',
        'form_region_not_clear',
        'form_confidence_low',
        'form_label_only',
        'form_signature_mismatch',
        'unsupported_form'
    ]);
    const HUNDO_FORM_VERIFIER_RESULT_FIELDS = Object.freeze([
        'tile_id',
        'card_id',
        'base_species',
        'verified_form_id',
        'verification_confidence',
        'crop_visibility',
        'body_plan',
        'limb_layout',
        'fusion_host',
        'decisive_feature',
        'key_features_visible'
    ]);
    const HUNDO_FORM_VERIFIER_FORM_IDS = new Set([
        'uncertain',
        ...Object.keys(REQUIRED_VERIFIED_FORM_EVIDENCE)
    ]);
    const HUNDO_FORM_VERIFIER_VISIBILITY_VALUES = new Set([
        'clear', 'partially_visible', 'cropped', 'not_visible', 'uncertain'
    ]);
    const HUNDO_FORM_VERIFIER_EVIDENCE_ENUM_VALUES = Object.freeze({
        body_plan: Object.freeze(['uncertain', ...Object.values(REQUIRED_VERIFIED_FORM_EVIDENCE).map(value => value.body_plan)]),
        limb_layout: Object.freeze(['uncertain', ...Object.values(REQUIRED_VERIFIED_FORM_EVIDENCE).map(value => value.limb_layout)]),
        fusion_host: Object.freeze(['uncertain', ...Object.values(REQUIRED_VERIFIED_FORM_EVIDENCE).map(value => value.fusion_host)]),
        decisive_feature: Object.freeze(['uncertain', ...Object.values(REQUIRED_VERIFIED_FORM_EVIDENCE).map(value => value.decisive_feature)])
    });
    const HUNDO_FORM_VERIFIER_CONTROLLED_STATUS_VALUES = Object.freeze([
        'verified',
        'uncertain',
        'low_confidence',
        'species_mismatch',
        'evidence_mismatch',
        'invalid_result',
        'structural_incomplete',
        'request_failed'
    ]);
    const HUNDO_FORM_VERIFIER_CANONICAL_NAMES = Object.freeze({
        articuno_standard: '急凍鳥', articuno_galarian: '伽勒爾急凍鳥',
        zapdos_standard: '閃電鳥', zapdos_galarian: '伽勒爾閃電鳥',
        moltres_standard: '火焰鳥', moltres_galarian: '伽勒爾火焰鳥',
        zacian_standard: '蒼響', zacian_crowned: '蒼響劍盾型態',
        zamazenta_standard: '藏瑪然特', zamazenta_crowned: '藏瑪然特劍盾型態',
        dialga_standard: '帝牙盧卡', dialga_origin: '起源帝牙盧卡',
        palkia_standard: '帕路奇亞', palkia_origin: '起源帕路奇亞',
        zygarde_10: '基格爾德（10%形態）', zygarde_50: '基格爾德（50%形態）', zygarde_complete: '基格爾德（完全體形態）',
        necrozma_base: '奈克洛茲瑪', necrozma_dusk_mane: '奈克洛茲瑪（黃昏之鬃）', necrozma_dawn_wings: '奈克洛茲瑪（拂曉之翼）',
        kyurem_base: '酋雷姆', kyurem_white: '焰白酋雷姆', kyurem_black: '闇黑酋雷姆'
    });

    const isFinitePrimitiveNumber = value => typeof value === 'number' && Number.isFinite(value);
    const isFinitePrimitiveInteger = value => isFinitePrimitiveNumber(value) && Number.isInteger(value);
    const isSafeNonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
    const emptyBboxContract = () => ({
        card_bbox: null,
        pokemon_bbox: null,
        bbox_confidence: 0,
        bbox_visibility: 'uncertain',
        bbox_valid: false
    });
    const verificationEvidenceDefaults = () => ({
        crop_visibility: 'uncertain',
        body_plan: 'uncertain',
        limb_layout: 'uncertain',
        fusion_host: 'uncertain',
        decisive_feature: 'uncertain',
        key_features_visible: false
    });
    const isPlainObject = value => value !== null
        && typeof value === 'object'
        && Object.getPrototypeOf(value) === Object.prototype;
    const hasOnlyOwnFields = (value, fields) => isPlainObject(value)
        && Reflect.ownKeys(value).length === fields.length
        && fields.every(field => Object.hasOwn(value, field))
        && Reflect.ownKeys(value).every(field => typeof field === 'string' && fields.includes(field));
    const isDensePlainArray = value => Array.isArray(value)
        && Object.getPrototypeOf(value) === Array.prototype
        && Reflect.ownKeys(value).length === value.length + 1
        && Reflect.ownKeys(value).every(key => key === 'length' || /^(0|[1-9]\d*)$/.test(key))
        && Array.from({ length: value.length }, (_unused, index) => Object.hasOwn(value, index)).every(Boolean);

    const normalizeHundoFormVerifierCard = value => {
        if (!hasOnlyOwnFields(value, HUNDO_FORM_VERIFIER_RESULT_FIELDS)) return null;
        if (![value.tile_id, value.card_id, value.base_species, value.verified_form_id,
            value.crop_visibility, value.body_plan, value.limb_layout, value.fusion_host,
            value.decisive_feature].every(field => typeof field === 'string')) return null;
        if (!isFinitePrimitiveNumber(value.verification_confidence)
            || value.verification_confidence < 0 || value.verification_confidence > 1
            || typeof value.key_features_visible !== 'boolean'
            || !TARGET_HUNDO_FORM_BASE_SPECIES.includes(value.base_species)
            || !HUNDO_FORM_VERIFIER_FORM_IDS.has(value.verified_form_id)
            || !HUNDO_FORM_VERIFIER_VISIBILITY_VALUES.has(value.crop_visibility)
            || !HUNDO_FORM_VERIFIER_EVIDENCE_ENUM_VALUES.body_plan.includes(value.body_plan)
            || !HUNDO_FORM_VERIFIER_EVIDENCE_ENUM_VALUES.limb_layout.includes(value.limb_layout)
            || !HUNDO_FORM_VERIFIER_EVIDENCE_ENUM_VALUES.fusion_host.includes(value.fusion_host)
            || !HUNDO_FORM_VERIFIER_EVIDENCE_ENUM_VALUES.decisive_feature.includes(value.decisive_feature)) return null;
        return {
            tile_id: value.tile_id,
            card_id: value.card_id,
            base_species: value.base_species,
            verified_form_id: value.verified_form_id,
            verification_confidence: value.verification_confidence,
            crop_visibility: value.crop_visibility,
            body_plan: value.body_plan,
            limb_layout: value.limb_layout,
            fusion_host: value.fusion_host,
            decisive_feature: value.decisive_feature,
            key_features_visible: value.key_features_visible
        };
    };

    const normalizeHundoFormVerifierResult = result => {
        if (!hasOnlyOwnFields(result, ['cards']) || !isDensePlainArray(result.cards)) return null;
        const cards = result.cards.map(normalizeHundoFormVerifierCard);
        return cards.every(Boolean) ? { cards } : null;
    };

    const isValidHundoFormVerifierJob = job => isPlainObject(job)
        && Object.hasOwn(job, 'tile_id')
        && Object.hasOwn(job, 'card_id')
        && Object.hasOwn(job, 'base_species')
        && Object.hasOwn(job, 'candidate_form_ids')
        && typeof job.tile_id === 'string'
        && typeof job.card_id === 'string'
        && typeof job.base_species === 'string'
        && Array.isArray(job.candidate_form_ids);

    const validateHundoFormVerifierStructure = (result, jobs, finishReason) => {
        const retryReasons = new Set();
        const normalized = normalizeHundoFormVerifierResult(result);
        const requestedJobs = isDensePlainArray(jobs) ? jobs : null;
        if (!normalized || !requestedJobs) {
            return { complete: false, retry_reasons: ['invalid_required_field'], normalized: null };
        }
        if (!requestedJobs.every(isValidHundoFormVerifierJob)) {
            return { complete: false, retry_reasons: ['invalid_required_field'], normalized };
        }
        if (['length', 'truncated', 'truncation'].includes(finishReason)) retryReasons.add('truncation');
        const jobsByTile = new Map();
        const jobsByCard = new Map();
        requestedJobs.forEach(job => {
            if (jobsByTile.has(job.tile_id) || jobsByCard.has(job.card_id)) {
                retryReasons.add('invalid_required_field');
                return;
            }
            jobsByTile.set(job.tile_id, job);
            jobsByCard.set(job.card_id, job);
        });
        const seenTiles = new Set();
        const seenCards = new Set();
        const matchedCards = new Set();
        normalized.cards.forEach(card => {
            if (seenTiles.has(card.tile_id)) retryReasons.add('duplicate_tile');
            seenTiles.add(card.tile_id);
            if (seenCards.has(card.card_id)) retryReasons.add('duplicate_card');
            seenCards.add(card.card_id);
            const job = jobsByTile.get(card.tile_id);
            if (!job || job.card_id !== card.card_id || jobsByCard.get(card.card_id) !== job) {
                retryReasons.add('unexpected');
                return;
            }
            matchedCards.add(card.card_id);
        });
        requestedJobs.forEach(job => {
            if (!matchedCards.has(job.card_id)) retryReasons.add('missing');
        });
        return {
            complete: retryReasons.size === 0,
            retry_reasons: [...retryReasons],
            normalized,
            cards_by_id: new Map(normalized.cards.map(card => [card.card_id, card]))
        };
    };

    const validateHundoVerifiedForm = (resultCard, job) => {
        const card = normalizeHundoFormVerifierCard(resultCard);
        if (!card || !isPlainObject(job)
            || card.tile_id !== job.tile_id || card.card_id !== job.card_id) {
            return { valid: false, reason: 'form_verifier_invalid_result' };
        }
        if (card.base_species !== job.base_species) {
            return { valid: false, reason: 'form_verifier_species_mismatch' };
        }
        if (card.verified_form_id === 'uncertain') {
            return { valid: false, reason: 'form_verifier_uncertain' };
        }
        const evidence = REQUIRED_VERIFIED_FORM_EVIDENCE[card.verified_form_id];
        if (!evidence || evidence.base_species !== card.base_species
            || !Array.isArray(job.candidate_form_ids)
            || !job.candidate_form_ids.includes(card.verified_form_id)) {
            return { valid: false, reason: 'form_verifier_species_mismatch' };
        }
        if (!['clear', 'partially_visible'].includes(card.crop_visibility)
            || card.key_features_visible !== true
            || card.body_plan !== evidence.body_plan
            || card.limb_layout !== evidence.limb_layout
            || card.fusion_host !== evidence.fusion_host
            || card.decisive_feature !== evidence.decisive_feature) {
            return { valid: false, reason: 'form_verifier_evidence_mismatch' };
        }
        const threshold = card.crop_visibility === 'partially_visible'
            ? HUNDO_FORM_VERIFY_PARTIAL_THRESHOLD
            : HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD;
        if (card.verification_confidence < threshold) {
            return { valid: false, reason: 'form_verifier_low_confidence' };
        }
        return { valid: true, result: card };
    };

    const verificationFailure = (card, reason) => {
        const statusByReason = {
            form_verifier_uncertain: 'uncertain',
            form_verifier_low_confidence: 'low_confidence',
            form_verifier_species_mismatch: 'species_mismatch',
            form_verifier_evidence_mismatch: 'evidence_mismatch',
            form_verifier_invalid_result: 'invalid_result',
            form_verifier_structural_incomplete: 'structural_incomplete',
            form_verification_request_failed: 'request_failed'
        };
        const status = statusByReason[reason] || 'invalid_result';
        return {
            ...card,
            verified_form_id: 'uncertain',
            verification_confidence: 0,
            verification_evidence: verificationEvidenceDefaults(),
            verification_status: HUNDO_FORM_VERIFIER_CONTROLLED_STATUS_VALUES.includes(status) ? status : 'invalid_result',
            effective_form_id: 'uncertain',
            canonical_official_name: '',
            manual_review_reasons: addReason(
                Array.isArray(card?.manual_review_reasons) ? card.manual_review_reasons.slice() : [],
                reason
            )
        };
    };

    const mergeHundoFormVerificationResults = (cards, jobs, result, structure, canonicalNames) => {
        const requestedJobs = Array.isArray(jobs) ? jobs : [];
        const jobsByCard = new Map(requestedJobs.map(job => [job?.card_id, job]));
        const evaluatedStructure = structure && typeof structure === 'object'
            ? structure
            : validateHundoFormVerifierStructure(result, requestedJobs);
        const normalized = evaluatedStructure?.normalized || normalizeHundoFormVerifierResult(result);
        const resultsByCard = evaluatedStructure?.cards_by_id instanceof Map
            ? evaluatedStructure.cards_by_id
            : new Map((normalized?.cards || []).map(card => [card.card_id, card]));
        const structuralReason = evaluatedStructure?.request_failed === true
            ? 'form_verification_request_failed'
            : evaluatedStructure?.complete === true
                ? null
                : (evaluatedStructure?.retry_reasons || []).some(reason => [
                    'invalid_required_field', 'duplicate_tile', 'duplicate_card', 'unexpected'
                ].includes(reason))
                    ? 'form_verifier_invalid_result'
                    : 'form_verifier_structural_incomplete';
        return Array.isArray(cards) ? cards.map(card => {
            const ownCardId = Object.hasOwn(card || {}, 'card_id') ? canonicalCardId(card.card_id) : null;
            const safeFallbackCardId = ownCardId ? ownCardId : cardIdFor(card, {});
            const job = jobsByCard.get(safeFallbackCardId);
            if (!job) {
                return isTargetHundoFormBaseSpecies(card?.base_species)
                    ? verificationFailure(card, 'form_verifier_invalid_result')
                    : card;
            }
            if (structuralReason) return verificationFailure(card, structuralReason);
            const verdict = validateHundoVerifiedForm(resultsByCard.get(job.card_id), job);
            if (!verdict.valid) return verificationFailure(card, verdict.reason);
            const verified = verdict.result;
            const canonicalName = canonicalNames?.[verified.verified_form_id];
            if (!Object.hasOwn(canonicalNames || {}, verified.verified_form_id)
                || canonicalName !== HUNDO_FORM_VERIFIER_CANONICAL_NAMES[verified.verified_form_id]) {
                return verificationFailure(card, 'form_verifier_invalid_result');
            }
            return {
                ...card,
                verified_form_id: verified.verified_form_id,
                verification_confidence: verified.verification_confidence,
                verification_evidence: {
                    crop_visibility: verified.crop_visibility,
                    body_plan: verified.body_plan,
                    limb_layout: verified.limb_layout,
                    fusion_host: verified.fusion_host,
                    decisive_feature: verified.decisive_feature,
                    key_features_visible: verified.key_features_visible
                },
                verification_status: 'verified',
                effective_form_id: verified.verified_form_id,
                canonical_official_name: canonicalName
            };
        }) : [];
    };

    const normalizeHundoBoundingBox = value => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.length !== BBOX_KEYS.length || !BBOX_KEYS.every(key => Object.hasOwn(value, key))) return null;
        if (!keys.every(key => BBOX_KEYS.includes(key))) return null;
        if (!BBOX_KEYS.every(key => isFinitePrimitiveInteger(value[key]) && value[key] >= 0 && value[key] <= 1000)) return null;
        if (value.x_min >= value.x_max || value.y_min >= value.y_max) return null;
        return {
            x_min: value.x_min,
            y_min: value.y_min,
            x_max: value.x_max,
            y_max: value.y_max
        };
    };

    const hasValidBboxGeometry = (cardBbox, pokemonBbox) => {
        if (!cardBbox || !pokemonBbox) return false;
        const intersects = pokemonBbox.x_min <= cardBbox.x_max
            && pokemonBbox.x_max >= cardBbox.x_min
            && pokemonBbox.y_min <= cardBbox.y_max
            && pokemonBbox.y_max >= cardBbox.y_min;
        const centerX = (pokemonBbox.x_min + pokemonBbox.x_max) / 2;
        const centerY = (pokemonBbox.y_min + pokemonBbox.y_max) / 2;
        return intersects
            && centerX >= cardBbox.x_min && centerX <= cardBbox.x_max
            && centerY >= cardBbox.y_min && centerY <= cardBbox.y_max;
    };

    const normalizeHundoBboxContract = card => {
        const cardBbox = normalizeHundoBoundingBox(card?.card_bbox);
        const pokemonBbox = normalizeHundoBoundingBox(card?.pokemon_bbox);
        if (!cardBbox || !pokemonBbox) return emptyBboxContract();
        const confidence = card?.bbox_confidence;
        const confidenceValid = isFinitePrimitiveNumber(confidence) && confidence >= 0 && confidence <= 1;
        const visibility = BBOX_VISIBILITY_VALUES.has(card?.bbox_visibility) ? card.bbox_visibility : 'uncertain';
        return {
            card_bbox: cardBbox,
            pokemon_bbox: pokemonBbox,
            bbox_confidence: confidenceValid ? confidence : 0,
            bbox_visibility: visibility,
            bbox_valid: hasValidBboxGeometry(cardBbox, pokemonBbox)
                && confidenceValid
                && BBOX_VISIBILITY_VALUES.has(card?.bbox_visibility)
        };
    };

    const isTargetHundoFormBaseSpecies = value => TARGET_HUNDO_FORM_BASE_SPECIES.includes(value);

    const canonicalCardId = value => typeof value === 'string' && value.trim() !== '' && value === value.trim()
        ? value
        : null;
    const screenshotIndexFor = (card, options) => isSafeNonNegativeInteger(card?.screenshot_index)
        ? card.screenshot_index
        : isSafeNonNegativeInteger(options?.screenshotIndex) ? options.screenshotIndex : null;
    const candidateIdentityFor = (card, options) => {
        const screenshotIndex = screenshotIndexFor(card, options);
        if (screenshotIndex === null) return null;
        const cardId = canonicalCardId(card?.card_id);
        if (cardId) return { card_id: cardId, screenshot_index: screenshotIndex };
        if (![card?.order, card?.row, card?.column].every(isSafeNonNegativeInteger)) return null;
        return {
            card_id: `${screenshotIndex}:${card.order}:${card.row}:${card.column}`,
            screenshot_index: screenshotIndex
        };
    };
    const cardIdFor = (card, options) => candidateIdentityFor(card, options)?.card_id || null;
    const addReason = (reasons, reason) => reason && !reasons.includes(reason) ? [...reasons, reason] : reasons;
    const prepareTargetCard = (card, bboxContract, status, reason, candidateIdentity = null) => {
        const preservedReasons = Array.isArray(card?.manual_review_reasons)
            ? card.manual_review_reasons.filter(value => !FORM_VALIDATION_REASON_CODES.has(value))
            : [];
        const manualReviewReasons = addReason(preservedReasons, reason);
        return {
            ...card,
            ...bboxContract,
            ...(candidateIdentity ? {
                card_id: candidateIdentity.card_id,
                screenshot_index: candidateIdentity.screenshot_index
            } : {}),
            primary_form_id: card?.form_id,
            primary_effective_form_id: card?.effective_form_id,
            primary_form_confidence: card?.form_confidence,
            primary_form_evidence: card?.form_evidence,
            stage2_candidate_form_ids: VERIFIED_FORM_IDS_BY_BASE_SPECIES[card?.base_species]?.slice() || [],
            verified_form_id: 'uncertain',
            verification_confidence: 0,
            verification_evidence: verificationEvidenceDefaults(),
            verification_status: status,
            effective_form_id: 'uncertain',
            canonical_official_name: '',
            manual_review_reasons: manualReviewReasons
        };
    };

    const planTargetHundoFormCandidates = (cards, options = {}) => {
        const inputCards = Array.isArray(cards) ? cards : [];
        const candidatePlans = [];
        let targetCardCount = 0;
        const plannedCards = inputCards.map((card, cardIndex) => {
            if (!isTargetHundoFormBaseSpecies(card?.base_species)) return card;
            targetCardCount += 1;
            if (card?.effective_form_id !== 'uncertain' && card?.base_species !== '蒼響') return card;
            const bboxContract = normalizeHundoBboxContract(card);
            const eligibleSpecies = ['recognized', 'partial'].includes(card?.recognition_status)
                && isFinitePrimitiveNumber(card?.species_confidence)
                && card.species_confidence >= HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD;
            const geometricallyValid = hasValidBboxGeometry(bboxContract.card_bbox, bboxContract.pokemon_bbox);
            const usableCrop = geometricallyValid
                && bboxContract.bbox_confidence >= HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD
                && USABLE_BBOX_VISIBILITY_VALUES.has(bboxContract.bbox_visibility);
            const candidateIdentity = candidateIdentityFor(card, options);
            let reason = null;
            if (eligibleSpecies && !geometricallyValid) {
                reason = 'form_crop_missing';
            } else if (eligibleSpecies && !usableCrop) {
                reason = 'form_crop_not_clear';
            } else if (eligibleSpecies && !candidateIdentity) {
                reason = 'form_crop_missing';
            }
            const candidateReady = eligibleSpecies && usableCrop && candidateIdentity !== null;
            const plannedCard = candidateReady
                ? prepareTargetCard(card, bboxContract, 'pending', reason, candidateIdentity)
                : card;
            if (candidateReady) {
                candidatePlans.push({
                    input_card: card,
                    planned_card_index: cardIndex,
                    bbox_contract: bboxContract,
                    candidate: {
                        card_id: candidateIdentity.card_id,
                        screenshot_index: candidateIdentity.screenshot_index,
                        base_species: card.base_species,
                        candidate_form_ids: VERIFIED_FORM_IDS_BY_BASE_SPECIES[card.base_species],
                        requested_dimensions: ['form'],
                        pokemon_bbox: { ...bboxContract.pokemon_bbox }
                    }
                });
            }
            return plannedCard;
        });
        const candidateIdCounts = new Map();
        candidatePlans.forEach(({ candidate }) => {
            candidateIdCounts.set(candidate.card_id, (candidateIdCounts.get(candidate.card_id) || 0) + 1);
        });
        const candidates = candidatePlans.flatMap(candidatePlan => {
            if (candidateIdCounts.get(candidatePlan.candidate.card_id) === 1) return [candidatePlan.candidate];
            plannedCards[candidatePlan.planned_card_index] = candidatePlan.input_card;
            return [];
        });
        return {
            cards: plannedCards,
            candidates,
            target_card_count: targetCardCount,
            target_candidate_count: candidates.length
        };
    };

    const planHundoFormVerificationBatches = candidates => {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];
        const jobIds = new Set();
        const hasInvalidJob = candidates.some(candidate => {
            const cardId = canonicalCardId(candidate?.card_id);
            if (!cardId || !isSafeNonNegativeInteger(candidate?.screenshot_index) || jobIds.has(cardId)) return true;
            jobIds.add(cardId);
            return false;
        });
        if (hasInvalidJob) return [];
        const candidatesByScreenshot = new Map();
        candidates.forEach(candidate => {
            const screenshotIndex = candidate.screenshot_index;
            const group = candidatesByScreenshot.get(screenshotIndex) || [];
            group.push(candidate);
            candidatesByScreenshot.set(screenshotIndex, group);
        });
        const batches = [];
        candidatesByScreenshot.forEach((screenshotCandidates, screenshotIndex) => {
            for (let start = 0, sheetNumber = 1; start < screenshotCandidates.length; start += HUNDO_FORM_VERIFY_BATCH_SIZE, sheetNumber += 1) {
                const jobs = screenshotCandidates.slice(start, start + HUNDO_FORM_VERIFY_BATCH_SIZE).map((candidate, index) => ({
                    tile_id: `T${index + 1}`,
                    card_id: candidate.card_id,
                    screenshot_index: candidate.screenshot_index,
                    base_species: candidate.base_species,
                    requested_dimensions: Array.isArray(candidate.requested_dimensions) ? candidate.requested_dimensions.slice() : ['form'],
                    candidate_form_ids: Array.isArray(candidate.candidate_form_ids)
                        ? candidate.candidate_form_ids.slice()
                        : []
                }));
                batches.push({
                    contact_sheet_id: `${screenshotIndex}:form:${sheetNumber}`,
                    jobs
                });
            }
        });
        return batches;
    };

    const markHundoFormVerificationFailure = (cards, cardIds, reason, status = 'failed') => {
        const failedCardIds = new Set(Array.isArray(cardIds) ? cardIds : []);
        return Array.isArray(cards) ? cards.map(card => {
            if (!failedCardIds.has(cardIdFor(card, {}))) return card;
            const reasons = Array.isArray(card?.manual_review_reasons) ? card.manual_review_reasons.slice() : [];
            return {
                ...card,
                verified_form_id: 'uncertain',
                verification_confidence: 0,
                verification_evidence: verificationEvidenceDefaults(),
                verification_status: status,
                effective_form_id: 'uncertain',
                canonical_official_name: '',
                manual_review_reasons: addReason(reasons, reason)
            };
        }) : [];
    };

    const backgroundNeedsVerification = card => {
        const evidence = card?.background_evidence || {};
        return ['commemorative', 'special'].includes(card?.background_type)
            || card?.effective_background_type === 'uncertain'
            || evidence.present === true
            || ['other', 'uncertain'].includes(evidence.badge_type)
            || ['other', 'uncertain'].includes(evidence.appearance);
    };

    // Coalesces form and background review into one identity-bound job per card.
    const planTargetHundoAttributeCandidates = (cards, options = {}) => {
        const formPlan = planTargetHundoFormCandidates(cards, options);
        const byId = new Map(formPlan.candidates.map(candidate => [candidate.card_id, { ...candidate }]));
        const plannedCards = formPlan.cards.slice();
        cards.forEach((original, index) => {
            if (!backgroundNeedsVerification(original)) return;
            const identity = candidateIdentityFor(original, options);
            const bbox = normalizeHundoBoundingBox(original?.card_bbox);
            const usable = identity && bbox
                && isFinitePrimitiveNumber(original?.bbox_confidence)
                && original.bbox_confidence >= HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD
                && USABLE_BBOX_VISIBILITY_VALUES.has(original?.bbox_visibility);
            if (!usable) {
                plannedCards[index] = {
                    ...plannedCards[index],
                    primary_background_type: original?.background_type,
                    primary_effective_background_type: original?.effective_background_type,
                    effective_background_type: 'uncertain',
                    manual_review_reasons: addReason(original?.manual_review_reasons || [], 'background_crop_not_clear')
                };
                return;
            }
            const existing = byId.get(identity.card_id);
            byId.set(identity.card_id, {
                ...(existing || {
                    card_id: identity.card_id, screenshot_index: identity.screenshot_index,
                    base_species: original?.base_species || '', candidate_form_ids: [],
                    pokemon_bbox: normalizeHundoBoundingBox(original?.pokemon_bbox) || bbox
                }),
                card_bbox: bbox,
                requested_dimensions: [...new Set([...(existing?.requested_dimensions || []), 'background'])]
            });
            const current = plannedCards[index];
            plannedCards[index] = {
                ...current,
                primary_background_type: original?.background_type,
                primary_effective_background_type: original?.effective_background_type,
                primary_background_confidence: original?.background_confidence,
                primary_background_evidence: original?.background_evidence,
                effective_background_type: 'uncertain',
                background_verification_status: 'pending'
            };
        });
        return { ...formPlan, cards: plannedCards, candidates: [...byId.values()],
            target_candidate_count: byId.size,
            background_candidate_count: [...byId.values()].filter(c => c.requested_dimensions.includes('background')).length };
    };

    const validateVerifiedBackground = result => {
        const visibility = result?.background_region_visibility;
        const associated = result?.background_card_association === 'same_card';
        const confidence = result?.background_verification_confidence;
        if (!associated || visibility !== 'clear' || !isFinitePrimitiveNumber(confidence))
            return { valid: false, reason: 'background_verifier_evidence_mismatch' };
        if (confidence < HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD)
            return { valid: false, reason: 'background_verifier_low_confidence' };
        const type = result?.verified_background_type;
        const positive = type === 'commemorative'
            ? result.observed_icon_class === 'location_globe_badge'
                && result.badge_type === 'commemorative_location_badge' && result.appearance === 'location_style_background'
            : type === 'special'
                ? result.observed_icon_class === 'special_flower_badge'
                    && result.badge_type === 'special_background_badge' && result.appearance === 'event_special_background'
                : false;
        const negative = type === 'none' && result.badge_type === 'none' && result.appearance === 'none'
            && ['none', 'pink_dynamax_x', 'purification_starburst'].includes(result.observed_icon_class);
        if (!positive && !negative) return { valid: false, reason: 'background_verifier_evidence_mismatch' };
        return { valid: true, type };
    };

    const validateHundoAttributeVerifierStructure = (results, jobs, finishReason = '') => {
        const list = Array.isArray(results?.cards) ? results.cards : null;
        if (!list || !Array.isArray(jobs)) return { complete: false, reason: 'invalid_result' };
        if (['length', 'truncated', 'truncation'].includes(String(finishReason || '').toLowerCase())) {
            return { complete: false, reason: 'structural_incomplete' };
        }
        const jobCards = new Set();
        const jobTiles = new Set();
        for (const job of jobs) {
            if (!job?.card_id || !job?.tile_id || jobCards.has(job.card_id) || jobTiles.has(job.tile_id)) {
                return { complete: false, reason: 'invalid_result' };
            }
            jobCards.add(job.card_id); jobTiles.add(job.tile_id);
        }
        const resultCards = new Set();
        const resultTiles = new Set();
        for (const result of list) {
            if (!result?.card_id || !result?.tile_id || resultCards.has(result.card_id) || resultTiles.has(result.tile_id)
                || !jobCards.has(result.card_id) || !jobTiles.has(result.tile_id)) {
                return { complete: false, reason: 'invalid_result' };
            }
            resultCards.add(result.card_id); resultTiles.add(result.tile_id);
        }
        if (resultCards.size !== jobCards.size) return { complete: false, reason: 'structural_incomplete' };
        return { complete: true, reason: '' };
    };

    const mergeHundoAttributeVerificationResults = (cards, jobs, results, canonicalNames, structure) => {
        const list = Array.isArray(results?.cards) ? results.cards : [];
        const structural = structure || validateHundoAttributeVerifierStructure(results, jobs);
        const counts = new Map(); list.forEach(r => counts.set(r?.card_id, (counts.get(r?.card_id) || 0) + 1));
        const byId = new Map(list.map(r => [r?.card_id, r]));
        const jobIds = new Set(jobs.map(j => j.card_id));
        const foreign = list.some(r => !jobIds.has(r?.card_id));
        return cards.map(card => {
            const job = jobs.find(j => j.card_id === card?.card_id);
            if (!job) return card;
            const result = byId.get(job.card_id);
            const identityValid = structural.complete === true && !foreign && counts.get(job.card_id) === 1 && result
                && result.card_id === job.card_id && result.tile_id === job.tile_id
                && result.screenshot_index === job.screenshot_index
                && result.base_species === job.base_species
                && result.base_species === card.base_species
                && Array.isArray(result.requested_dimensions)
                && result.requested_dimensions.length === job.requested_dimensions.length
                && result.requested_dimensions.every((value, index) => value === job.requested_dimensions[index]);
            let merged = card;
            if (job.requested_dimensions.includes('form')) {
                if (!identityValid) merged = verificationFailure(merged, structural.reason === 'structural_incomplete'
                    ? 'form_verifier_structural_incomplete' : 'form_verifier_invalid_result');
                else {
                    const verdict = validateHundoVerifiedForm({ tile_id: result.tile_id, card_id: result.card_id, base_species: result.base_species, verified_form_id: result.verified_form_id, verification_confidence: result.verification_confidence, crop_visibility: result.crop_visibility, body_plan: result.body_plan, limb_layout: result.limb_layout, fusion_host: result.fusion_host, decisive_feature: result.decisive_feature, key_features_visible: result.key_features_visible }, job);
                    if (!verdict.valid) merged = verificationFailure(merged, verdict.reason);
                    else merged = { ...merged, verified_form_id: verdict.result.verified_form_id,
                        verification_confidence: verdict.result.verification_confidence,
                        verification_evidence: { crop_visibility: verdict.result.crop_visibility, body_plan: verdict.result.body_plan,
                            limb_layout: verdict.result.limb_layout, fusion_host: verdict.result.fusion_host,
                            decisive_feature: verdict.result.decisive_feature, key_features_visible: verdict.result.key_features_visible },
                        verification_status: 'verified', effective_form_id: verdict.result.verified_form_id,
                        canonical_official_name: canonicalNames[verdict.result.verified_form_id] };
                }
            }
            if (job.requested_dimensions.includes('background')) {
                const verdict = identityValid ? validateVerifiedBackground(result) : { valid: false, reason: structural.reason === 'structural_incomplete'
                    ? 'background_verifier_structural_incomplete' : 'background_verifier_invalid_result' };
                merged = verdict.valid ? { ...merged, verified_background_type: verdict.type,
                    background_verification_status: 'verified', effective_background_type: verdict.type,
                    manual_review_reasons: (merged.manual_review_reasons || []).filter(reason => ![
                        'background_uncertain', 'background_crop_not_clear', 'background_verifier_evidence_mismatch',
                        'background_verifier_low_confidence', 'background_verifier_invalid_result', 'background_verifier_structural_incomplete',
                        'background_verification_request_failed'
                    ].includes(reason)) }
                    : { ...merged, verified_background_type: 'uncertain', background_verification_status: 'failed',
                        effective_background_type: 'uncertain', manual_review_reasons: addReason(merged.manual_review_reasons || [], verdict.reason) };
            }
            return merged;
        });
    };

    const api = Object.freeze({
        TARGET_HUNDO_FORM_BASE_SPECIES,
        VERIFIED_FORM_IDS_BY_BASE_SPECIES,
        REQUIRED_VERIFIED_FORM_EVIDENCE,
        HUNDO_FORM_BBOX_CONFIDENCE_THRESHOLD,
        HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD,
        HUNDO_FORM_VERIFY_PARTIAL_THRESHOLD,
        HUNDO_FORM_VERIFY_BATCH_SIZE,
        HUNDO_FORM_MIN_SOURCE_PIXELS,
        HUNDO_FORM_VERIFIER_REVIEW_REASON_MESSAGES,
        normalizeHundoBoundingBox,
        normalizeHundoBboxContract,
        normalizeHundoFormVerifierResult,
        validateHundoFormVerifierStructure,
        validateHundoVerifiedForm,
        mergeHundoFormVerificationResults,
        isTargetHundoFormBaseSpecies,
        planTargetHundoFormCandidates,
        planTargetHundoAttributeCandidates,
        backgroundNeedsVerification,
        validateVerifiedBackground,
        validateHundoAttributeVerifierStructure,
        mergeHundoAttributeVerificationResults,
        planHundoFormVerificationBatches,
        markHundoFormVerificationFailure
    });

    global.SmartHundoFormVerifier = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
