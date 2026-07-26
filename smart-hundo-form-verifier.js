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
        body_plan: Object.freeze(['uncertain', 'dialga_stocky_wide_quadruped', 'dialga_elongated_equine_quadruped', 'palkia_upright_biped_with_arms', 'palkia_centaur_quadruped', 'necrozma_upright_crystalline', 'necrozma_quadruped_lion', 'necrozma_wide_moon_wings']),
        limb_layout: Object.freeze(['uncertain', 'four_standard_legs', 'four_long_legs', 'two_arms_two_legs', 'four_legs_no_standard_arms', 'upright_crystalline_limbs', 'quadruped_lion', 'giant_wings_no_lion_body']),
        fusion_host: Object.freeze(['uncertain', 'not_applicable', 'none', 'solgaleo', 'lunala']),
        decisive_feature: Object.freeze(['uncertain', 'dialga_standard_stocky_neck_chest', 'dialga_origin_elongated_neck_chest', 'palkia_standard_visible_arms', 'palkia_origin_centaur_body', 'necrozma_base_crystal_body', 'necrozma_dusk_mane_lion_crystal_armor', 'necrozma_dawn_wings_moon_wings'])
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
        dialga_standard: '\u5e1d\u7259\u76e7\u5361',
        dialga_origin: '\u8d77\u6e90\u5e1d\u7259\u76e7\u5361',
        palkia_standard: '\u5e15\u8def\u5947\u4e9e',
        palkia_origin: '\u8d77\u6e90\u5e15\u8def\u5947\u4e9e',
        necrozma_base: '\u5948\u514b\u6d1b\u8332\u746a',
        necrozma_dusk_mane: '\u5948\u514b\u6d1b\u8332\u746a\uff08\u9ec3\u660f\u4e4b\u9b03\uff09',
        necrozma_dawn_wings: '\u5948\u514b\u6d1b\u8332\u746a\uff08\u62c2\u66c9\u4e4b\u7ffc\uff09'
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
        normalizeHundoFormVerifierResult,
        validateHundoFormVerifierStructure,
        validateHundoVerifiedForm,
        mergeHundoFormVerificationResults,
        isTargetHundoFormBaseSpecies,
        planTargetHundoFormCandidates,
        planHundoFormVerificationBatches,
        markHundoFormVerificationFailure
    });

    global.SmartHundoFormVerifier = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
