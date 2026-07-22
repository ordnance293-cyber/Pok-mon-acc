(function (global) {
    'use strict';

    const HUNDO_LEGENDARY_QUERY = '傳說的寶可夢,幻,究極異獸&4*';
    const SMART_IMAGE_TYPE = 'HUNDO_LEGENDARY_SCREEN';
    const STATE_VALUES = new Set(['yes', 'no', 'uncertain']);
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

    const normalizeCount = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
    };

    const normalizeState = (value) => {
        const state = stringValue(value).toLowerCase();
        return STATE_VALUES.has(state) ? state : 'uncertain';
    };

    const normalizeRecognitionStatus = (value) => {
        const status = stringValue(value).toLowerCase();
        return RECOGNITION_VALUES.has(status) ? status : 'uncertain';
    };

    const normalizeWith = (normalizer, value) => {
        const normalized = typeof normalizer === 'function' ? normalizer(value) : value;
        return stringValue(normalized);
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

    const normalizeSmartHundoResult = (result = {}, normalizeNumber, normalizeOfficialName) => ({
        hundo_leg: normalizeWith(normalizeNumber, result?.hundo_leg),
        hundo_leg_confidence: clampConfidence(result?.hundo_leg_confidence),
        detected_card_count: normalizeCount(result?.detected_card_count),
        cards: normalizeCards(result?.cards, normalizeOfficialName)
    });

    const smartHundoCardsToPokemonList = (cards = [], normalizeOfficialName, normalizePokemonList) => {
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
            .map(result => normalizeSmartHundoResult(result, normalizeNumber, normalizeOfficialName));
        const hundoLegValues = normalizedResults.map(result => result.hundo_leg).filter(Boolean);
        const cards = normalizedResults.flatMap(result => result.cards);
        const conversion = smartHundoCardsToPokemonList(cards, normalizeOfficialName, normalizePokemonList);

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
        normalizeSmartHundoResult,
        smartHundoCardsToPokemonList,
        mergeSmartHundoScanResults
    };

    global.SmartHundoHelpers = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
