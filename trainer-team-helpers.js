(function (global) {
    'use strict';

    const TRAINER_TEAM_CONFIDENCE_THRESHOLD = 0.85;
    const TEAM_COLORS = new Set(['yellow', 'blue', 'red', 'uncertain']);
    const USABLE_COLORS = new Set(['yellow', 'blue', 'red']);
    const VISIBILITY_VALUES = new Set(['clear', 'partial', 'hidden', 'uncertain']);
    const PRIMARY_KEYS = ['level_number', 'xp_bar_fill', 'xp_value_text'];
    const SECONDARY_KEYS = ['profile_name_block', 'arrow_or_progress_accent'];
    const EVIDENCE_KEYS = [...PRIMARY_KEYS, ...SECONDARY_KEYS];
    const TEAM_BY_COLOR = Object.freeze({ yellow: '黃隊', blue: '藍隊', red: '紅隊' });
    const ALLOWED_REASON_CODES = new Set([
        'primary_conflict',
        'no_primary_evidence',
        'low_confidence',
        'strong_primary_consensus',
        'limited_primary_consensus',
        'insufficient_secondary_consensus',
        'model_evidence_disagreement',
        'no_valid_team_evidence',
        'team_conflict'
    ]);

    const objectValue = (value) => value !== null && typeof value === 'object' ? value : {};
    const normalizedString = (value) => {
        if (value === undefined || value === null) return '';
        try {
            return String(value).trim().toLowerCase();
        } catch (_error) {
            return '';
        }
    };
    const safeNumber = (value) => {
        try {
            return Number(value);
        } catch (_error) {
            return NaN;
        }
    };
    const clampConfidence = (value) => {
        const number = safeNumber(value);
        return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
    };
    const normalizeColor = (value) => {
        const color = normalizedString(value);
        return TEAM_COLORS.has(color) ? color : 'uncertain';
    };
    const normalizeVisibility = (value) => {
        const visibility = normalizedString(value);
        return VISIBILITY_VALUES.has(visibility) ? visibility : 'uncertain';
    };
    const normalizeEvidence = (value) => {
        const source = objectValue(value);
        return {
            visibility: normalizeVisibility(source.visibility),
            color: normalizeColor(source.color)
        };
    };
    const normalizeScreenshotIndex = (value) => {
        const number = safeNumber(value);
        return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
    };
    const teamForColor = (color) => TEAM_BY_COLOR[color] || '';
    const isUsableSource = (source) => source.visibility === 'clear' && USABLE_COLORS.has(source.color);
    const safeReasonCodes = (values) => (Array.isArray(values) ? values : [])
        .filter(reason => typeof reason === 'string' && ALLOWED_REASON_CODES.has(reason));
    const safeConflict = (conflict) => {
        const source = objectValue(conflict);
        const entries = Array.isArray(source.sources) ? source.sources : [];
        const safeSources = entries
            .map(entry => objectValue(entry))
            .filter(entry => EVIDENCE_KEYS.includes(entry.key) && USABLE_COLORS.has(normalizeColor(entry.color)))
            .map(entry => ({ key: entry.key, color: normalizeColor(entry.color) }));
        if (source.type === 'primary_conflict') return { type: 'primary_conflict', sources: safeSources };
        if (source.type === 'model_evidence_disagreement') {
            const modelTeamCandidate = normalizeColor(source.model_team_candidate);
            const effectiveColor = normalizeColor(source.effective_color);
            if (USABLE_COLORS.has(modelTeamCandidate) && USABLE_COLORS.has(effectiveColor)) {
                return { type: 'model_evidence_disagreement', model_team_candidate: modelTeamCandidate, effective_color: effectiveColor };
            }
        }
        if (source.type === 'team_conflict') return { type: 'team_conflict', colors: [...new Set((Array.isArray(source.colors) ? source.colors : []).map(normalizeColor).filter(color => USABLE_COLORS.has(color)))].sort() };
        return null;
    };

    const normalizeTrainerTeamResult = (result = {}) => {
        const source = objectValue(result);
        const normalized = {
            model_team_candidate: normalizeColor(source.model_team_candidate),
            model_confidence: clampConfidence(source.model_confidence)
        };
        EVIDENCE_KEYS.forEach(key => { normalized[key] = normalizeEvidence(source[key]); });
        return normalized;
    };

    const makeResult = (normalized, screenshotIndex, valid, effectiveColor, reasons, conflicts) => {
        const safeReasons = safeReasonCodes(reasons);
        return {
            screenshot_index: screenshotIndex,
            model_team_candidate: normalized.model_team_candidate,
            model_confidence: normalized.model_confidence,
            fixed_ui_evidence: EVIDENCE_KEYS.reduce((evidence, key) => {
                evidence[key] = { ...normalized[key] };
                return evidence;
            }, {}),
            valid,
            effective_color: effectiveColor,
            effective_team: valid ? teamForColor(effectiveColor) : '',
            diagnostics: [...safeReasons],
            validation_reasons: [...safeReasons],
            conflicts: conflicts.map(safeConflict).filter(Boolean)
        };
    };

    const validateTrainerTeamEvidence = (result = {}, options = {}) => {
        const normalized = normalizeTrainerTeamResult(result);
        const optionSource = objectValue(options);
        const resultSource = objectValue(result);
        const screenshotIndex = normalizeScreenshotIndex(
            optionSource.screenshot_index === undefined ? resultSource.screenshot_index : optionSource.screenshot_index
        );
        const primarySources = PRIMARY_KEYS
            .filter(key => isUsableSource(normalized[key]))
            .map(key => ({ key, color: normalized[key].color }));
        const primaryColors = [...new Set(primarySources.map(source => source.color))];
        const reasons = [];
        const conflicts = [];
        let effectiveColor = 'uncertain';
        let valid = false;

        if (primaryColors.length > 1) {
            reasons.push('primary_conflict');
            conflicts.push({ type: 'primary_conflict', sources: primarySources });
        } else if (primarySources.length === 0) {
            reasons.push('no_primary_evidence');
        } else if (normalized.model_confidence < TRAINER_TEAM_CONFIDENCE_THRESHOLD) {
            reasons.push('low_confidence');
        } else if (primarySources.length >= 2) {
            effectiveColor = primaryColors[0];
            valid = true;
            reasons.push('strong_primary_consensus');
        } else {
            const primaryColor = primaryColors[0];
            const secondaryMatches = SECONDARY_KEYS.every(key => (
                isUsableSource(normalized[key]) && normalized[key].color === primaryColor
            ));
            if (secondaryMatches) {
                effectiveColor = primaryColor;
                valid = true;
                reasons.push('limited_primary_consensus');
            } else {
                reasons.push('insufficient_secondary_consensus');
            }
        }

        if (valid && USABLE_COLORS.has(normalized.model_team_candidate) && normalized.model_team_candidate !== effectiveColor) {
            reasons.push('model_evidence_disagreement');
            conflicts.push({
                type: 'model_evidence_disagreement',
                model_team_candidate: normalized.model_team_candidate,
                effective_color: effectiveColor
            });
        }
        return makeResult(normalized, screenshotIndex, valid, effectiveColor, reasons, conflicts);
    };

    const safeValidatedResult = (result = {}) => {
        const source = objectValue(result);
        const evidence = objectValue(source.fixed_ui_evidence);
        const normalized = normalizeTrainerTeamResult({
            model_team_candidate: source.model_team_candidate,
            model_confidence: source.model_confidence,
            ...evidence
        });
        const effectiveColor = normalizeColor(source.effective_color);
        const valid = source.valid === true && USABLE_COLORS.has(effectiveColor);
        const reasons = [...new Set([
            ...safeReasonCodes(source.diagnostics),
            ...safeReasonCodes(source.validation_reasons)
        ])];
        const conflicts = (Array.isArray(source.conflicts) ? source.conflicts : []).map(safeConflict).filter(Boolean);
        return {
            screenshot_index: normalizeScreenshotIndex(source.screenshot_index),
            model_team_candidate: normalized.model_team_candidate,
            model_confidence: normalized.model_confidence,
            fixed_ui_evidence: EVIDENCE_KEYS.reduce((safeEvidence, key) => {
                safeEvidence[key] = { ...normalized[key] };
                return safeEvidence;
            }, {}),
            valid,
            effective_color: valid ? effectiveColor : 'uncertain',
            effective_team: valid ? teamForColor(effectiveColor) : '',
            diagnostics: [...reasons],
            validation_reasons: [...reasons],
            conflicts
        };
    };

    const mergeTrainerTeamResults = (validatedResults = []) => {
        const screenshotResults = (Array.isArray(validatedResults) ? validatedResults : []).map(safeValidatedResult);
        const validResults = screenshotResults.filter(result => result.valid && USABLE_COLORS.has(result.effective_color));
        const colors = [...new Set(validResults.map(result => result.effective_color))];
        const base = normalizeTrainerTeamResult({});
        if (colors.length === 0) {
            const inheritedReasons = [...new Set(
                screenshotResults.flatMap(result => result.validation_reasons)
            )];
            const inheritedConflicts = screenshotResults.flatMap(result => result.conflicts);
            return {
                ...makeResult(
                    base,
                    0,
                    false,
                    'uncertain',
                    [...inheritedReasons, 'no_valid_team_evidence'],
                    inheritedConflicts
                ),
                screenshot_results: screenshotResults
            };
        }
        if (colors.length > 1) {
            return {
                ...makeResult(base, 0, false, 'uncertain', ['team_conflict'], [{ type: 'team_conflict', colors }]),
                screenshot_results: screenshotResults
            };
        }
        return {
            ...makeResult(base, 0, true, colors[0], [], []),
            screenshot_results: screenshotResults
        };
    };

    const formatTrainerTeamStatus = (result = {}) => {
        const source = objectValue(result);
        const effectiveColor = normalizeColor(source.effective_color);
        const effectiveTeam = teamForColor(effectiveColor);
        const reasons = new Set([...safeReasonCodes(source.diagnostics), ...safeReasonCodes(source.validation_reasons)]);
        const primaryConflict = (Array.isArray(source.conflicts) ? source.conflicts : [])
            .map(safeConflict)
            .find(conflict => conflict && conflict.type === 'primary_conflict');
        if (effectiveTeam && source.valid !== false) return `隊伍辨識完成：${effectiveTeam}`;
        if (reasons.has('team_conflict')) return '隊伍需人工確認：多張截圖的固定 UI 隊伍結果互相衝突';
        if (reasons.has('primary_conflict')) {
            const keys = new Set((primaryConflict?.sources || []).map(source => source.key));
            if (keys.has('level_number') && keys.has('xp_bar_fill')) return '隊伍需人工確認：等級數字與 XP 進度條顏色衝突';
            return '隊伍需人工確認：固定 UI 主要證據顏色衝突';
        }
        if (reasons.has('low_confidence')) return '隊伍需人工確認：固定 UI 證據信心不足';
        return '隊伍需人工確認：固定 UI 證據不足';
    };

    const api = Object.freeze({
        normalizeTrainerTeamResult,
        validateTrainerTeamEvidence,
        mergeTrainerTeamResults,
        formatTrainerTeamStatus,
        TRAINER_TEAM_CONFIDENCE_THRESHOLD
    });

    global.TrainerTeamHelpers = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
