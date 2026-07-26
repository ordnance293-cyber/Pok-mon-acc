(function (global) {
    'use strict';

    const TARGET_HUNDO_FORM_BASE_SPECIES = Object.freeze([
        '帝牙盧卡',
        '帕路奇亞',
        '奈克洛茲瑪'
    ]);
    const VERIFIED_FORM_IDS_BY_BASE_SPECIES = Object.freeze({
        帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin', 'uncertain']),
        帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin', 'uncertain']),
        奈克洛茲瑪: Object.freeze([
            'necrozma_base',
            'necrozma_dusk_mane',
            'necrozma_dawn_wings',
            'uncertain'
        ])
    });
    const REQUIRED_VERIFIED_FORM_EVIDENCE = Object.freeze({
        dialga_standard: Object.freeze({
            base_species: '帝牙盧卡',
            body_plan: 'dialga_stocky_wide_quadruped',
            limb_layout: 'four_standard_legs',
            fusion_host: 'not_applicable',
            decisive_feature: 'dialga_standard_stocky_neck_chest'
        }),
        dialga_origin: Object.freeze({
            base_species: '帝牙盧卡',
            body_plan: 'dialga_elongated_equine_quadruped',
            limb_layout: 'four_long_legs',
            fusion_host: 'not_applicable',
            decisive_feature: 'dialga_origin_elongated_neck_chest'
        }),
        palkia_standard: Object.freeze({
            base_species: '帕路奇亞',
            body_plan: 'palkia_upright_biped_with_arms',
            limb_layout: 'two_arms_two_legs',
            fusion_host: 'not_applicable',
            decisive_feature: 'palkia_standard_visible_arms'
        }),
        palkia_origin: Object.freeze({
            base_species: '帕路奇亞',
            body_plan: 'palkia_centaur_quadruped',
            limb_layout: 'four_legs_no_standard_arms',
            fusion_host: 'not_applicable',
            decisive_feature: 'palkia_origin_centaur_body'
        }),
        necrozma_base: Object.freeze({
            base_species: '奈克洛茲瑪',
            body_plan: 'necrozma_upright_crystalline',
            limb_layout: 'upright_crystalline_limbs',
            fusion_host: 'none',
            decisive_feature: 'necrozma_base_crystal_body'
        }),
        necrozma_dusk_mane: Object.freeze({
            base_species: '奈克洛茲瑪',
            body_plan: 'necrozma_quadruped_lion',
            limb_layout: 'quadruped_lion',
            fusion_host: 'solgaleo',
            decisive_feature: 'necrozma_dusk_mane_lion_crystal_armor'
        }),
        necrozma_dawn_wings: Object.freeze({
            base_species: '奈克洛茲瑪',
            body_plan: 'necrozma_wide_moon_wings',
            limb_layout: 'giant_wings_no_lion_body',
            fusion_host: 'lunala',
            decisive_feature: 'necrozma_dawn_wings_moon_wings'
        })
    });
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
            const plannedCard = prepareTargetCard(
                card,
                bboxContract,
                candidateReady ? 'pending' : 'not_requested',
                reason,
                candidateIdentity
            );
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
            plannedCards[candidatePlan.planned_card_index] = prepareTargetCard(
                candidatePlan.input_card,
                candidatePlan.bbox_contract,
                'not_requested',
                'form_crop_missing',
                candidatePlan.candidate
            );
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
        isTargetHundoFormBaseSpecies,
        planTargetHundoFormCandidates,
        planHundoFormVerificationBatches,
        markHundoFormVerificationFailure
    });

    global.SmartHundoFormVerifier = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
