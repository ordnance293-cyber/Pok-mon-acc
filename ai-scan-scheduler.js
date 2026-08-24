(function (global) {
    'use strict';

    const AI_CLASSIFICATION_CONCURRENCY = 3;
    const SMART_HUNDO_CONCURRENCY = 1;
    const ORDINARY_EXTRACTION_CONCURRENCY = 3;
    const STORAGE_VERIFICATION_CONCURRENCY = 2;
    const TRAINER_TEAM_CONCURRENCY = 1;
    const SMART_HUNDO_MAX_QUALITY_RETRIES = 1;
    const SMART_HUNDO_QUALITY_MIN_SAMPLE_CARDS = 4;
    const SMART_HUNDO_MIN_RECOGNIZED_SPECIES_RATIO = 0.60;
    const SMART_HUNDO_MIN_RESOLVED_DISPLAY_RATIO = 0.40;

    const settleMapWithConcurrency = async (items, concurrency, worker, options = {}) => {
        const list = Array.from(items || []);
        const limit = Math.max(1, Math.trunc(Number(concurrency) || 1));
        const shouldContinue = typeof options.shouldContinue === 'function'
            ? options.shouldContinue
            : () => true;
        const results = new Array(list.length);
        let nextIndex = 0;
        const runner = async () => {
            while (nextIndex < list.length && shouldContinue()) {
                const index = nextIndex;
                nextIndex += 1;
                try {
                    const value = await worker(list[index], index);
                    results[index] = { status: 'fulfilled', value };
                } catch (reason) {
                    results[index] = { status: 'rejected', reason };
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, list.length) }, runner));
        return results;
    };

    const isConfidentSpecies = (card, helpers) => (
        card?.recognition_status === 'recognized'
        && Boolean(String(card?.base_species || card?.species_name || '').trim())
        && Number(card?.species_confidence || 0) >= Number(helpers?.SPECIES_CONFIDENCE_THRESHOLD || 0.7)
    );

    const evaluateSmartHundoQuality = (result = {}, helpers = global.SmartHundoHelpers) => {
        const cards = Array.isArray(result?.card_result?.cards) ? result.card_result.cards : [];
        const detected = Number(result?.card_result?.detected_card_count || 0);
        const recognized = cards.filter(card => isConfidentSpecies(card, helpers)).length;
        const resolved = cards.filter(card => {
            if (!helpers?.buildHundoListEntry) return isConfidentSpecies(card, helpers);
            return helpers.buildHundoListEntry(card).status !== 'unresolved';
        }).length;
        const recognizedRatio = cards.length ? recognized / cards.length : 0;
        const resolvedRatio = cards.length ? resolved / cards.length : 0;
        const reasons = [];
        if (result.card_operation_succeeded !== true) reasons.push('card_operation_failed');
        if (result?.structure?.structurally_complete !== true) reasons.push('structurally_incomplete');
        if (Number(result?.card_result?.enumeration_confidence || 0) < Number(helpers?.ENUMERATION_CONFIDENCE_THRESHOLD || 0.8)) reasons.push('low_enumeration_confidence');
        if (/length|truncat/i.test(String(result?.finish_reason || ''))) reasons.push('finish_reason_truncated');
        if (detected !== cards.length) reasons.push('detected_card_count_mismatch');
        const coordinates = new Set();
        if (cards.some(card => {
            const coordinate = [card?.order, card?.row, card?.column];
            if (coordinate.some(value => !Number.isInteger(value) || value < 1)) return true;
            const key = coordinate.join(':');
            if (coordinates.has(key)) return true;
            coordinates.add(key);
            return false;
        })) reasons.push('invalid_or_duplicate_card_coordinates');
        if (result?.count?.valid === true && Number(result.count.hundo_leg) > 0 && cards.length === 0) reasons.push('nonzero_count_without_cards');
        if (cards.length >= SMART_HUNDO_QUALITY_MIN_SAMPLE_CARDS) {
            if (recognizedRatio < SMART_HUNDO_MIN_RECOGNIZED_SPECIES_RATIO) reasons.push('low_recognized_species_ratio');
            if (resolvedRatio < SMART_HUNDO_MIN_RESOLVED_DISPLAY_RATIO) reasons.push('low_resolved_display_ratio');
        } else if (cards.length > 0 && recognized === 0) reasons.push('small_sample_unrecognized');
        return {
            passed: reasons.length === 0,
            reasons,
            detected_card_count: detected,
            cards_length: cards.length,
            recognized_species_count: recognized,
            recognized_species_ratio: recognizedRatio,
            resolved_display_count: resolved,
            resolved_display_ratio: resolvedRatio
        };
    };

    const compareFailedAttempts = (left, right) => {
        const score = item => [
            item.result?.structure?.structurally_complete === true ? 1 : 0,
            item.quality.recognized_species_ratio,
            item.quality.resolved_display_ratio,
            Number(item.result?.card_result?.enumeration_confidence || 0),
            item.quality.cards_length
        ];
        const a = score(left); const b = score(right);
        for (let index = 0; index < a.length; index += 1) {
            if (a[index] !== b[index]) return a[index] > b[index] ? left : right;
        }
        return left;
    };

    const runSmartHundoJobWithQualityRetry = async ({ runCount, runCards, combine, helpers, onQualityRetry }) => {
        const countPromise = runCount();
        const firstCardsPromise = runCards(1);
        const [countSettlement, firstCardSettlement] = await Promise.allSettled([countPromise, firstCardsPromise]);
        const makeResult = cardSettlement => combine(countSettlement, cardSettlement);
        const firstResult = makeResult(firstCardSettlement);
        const firstQuality = evaluateSmartHundoQuality(firstResult, helpers);
        if (firstQuality.passed || SMART_HUNDO_MAX_QUALITY_RETRIES === 0) return {
            ...firstResult, ...firstQuality, quality_passed: firstQuality.passed,
            quality_reasons: firstQuality.reasons, quality_retry_used: false,
            quality_attempt_count: 1, accepted_for_merge: firstQuality.passed
        };
        onQualityRetry?.();
        const secondSettlement = await Promise.resolve().then(() => runCards(2)).then(
            value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason })
        );
        const secondResult = makeResult(secondSettlement);
        const secondQuality = evaluateSmartHundoQuality(secondResult, helpers);
        const chosen = secondQuality.passed
            ? { result: secondResult, quality: secondQuality }
            : compareFailedAttempts(
                { result: firstResult, quality: firstQuality },
                { result: secondResult, quality: secondQuality }
            );
        return {
            ...chosen.result, ...chosen.quality, quality_passed: secondQuality.passed,
            quality_reasons: chosen.quality.reasons, quality_retry_used: true,
            quality_attempt_count: 2, accepted_for_merge: secondQuality.passed
        };
    };

    const mergeSmartHundoScreenshotsAdjacent = (screenshots = [], helpers = global.SmartHundoHelpers) => {
        const ordered = [...screenshots].sort((a, b) => a.smartQueueIndex - b.smartQueueIndex);
        const cards = [];
        const overlap_decisions = [];
        const manual_review_reasons = [];
        ordered.forEach((screenshot, index) => {
            let append = [...(screenshot.cards || [])];
            const previous = ordered[index - 1];
            if (previous && previous.smartQueueIndex + 1 === screenshot.smartQueueIndex) {
                const decision = helpers.detectScreenshotOverlap(previous, screenshot);
                overlap_decisions.push({ left_index: previous.index, right_index: screenshot.index, ...decision });
                if (decision.direction === 'left_suffix_right_prefix' && decision.overlap_count >= 2 && !decision.ambiguous) {
                    append = append.slice(decision.overlap_count);
                } else if (decision.direction !== 'none' || decision.ambiguous || decision.overlap_count > 0) {
                    manual_review_reasons.push('screenshot_overlap_uncertain');
                }
            }
            cards.push(...append);
        });
        return { cards, overlap_decisions, manual_review_reasons: [...new Set(manual_review_reasons)] };
    };

    const api = {
        AI_CLASSIFICATION_CONCURRENCY, SMART_HUNDO_CONCURRENCY,
        ORDINARY_EXTRACTION_CONCURRENCY, STORAGE_VERIFICATION_CONCURRENCY,
        TRAINER_TEAM_CONCURRENCY, SMART_HUNDO_MAX_QUALITY_RETRIES,
        SMART_HUNDO_QUALITY_MIN_SAMPLE_CARDS,
        SMART_HUNDO_MIN_RECOGNIZED_SPECIES_RATIO,
        SMART_HUNDO_MIN_RESOLVED_DISPLAY_RATIO,
        settleMapWithConcurrency, evaluateSmartHundoQuality,
        runSmartHundoJobWithQualityRetry, mergeSmartHundoScreenshotsAdjacent
    };
    global.AiScanScheduler = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
