"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerSummaryTarget = getPlayerSummaryTarget;
exports.getCachedPlayerSummary = getCachedPlayerSummary;
exports.loadPlayerSummary = loadPlayerSummary;
const espn_1 = require("../data/espn");
const store_1 = require("../state/store");
function getPlayerSummaryTarget(state, player) {
    const competitor = (0, store_1.findCompetitorForPlayerRow)(state, player);
    const eventId = state.leaderboardMeta?.id;
    const tour = state.leaderboardMeta?.tour;
    if (!competitor?.id || !eventId || !tour) {
        return null;
    }
    return {
        cacheKey: `${eventId}:${competitor.id}`,
        competitorId: competitor.id,
        eventId,
        tour,
        selectedTour: state.selectedEvent?.tour
    };
}
function getCachedPlayerSummary(state, target) {
    return state.scorecardCache[target.cacheKey] || null;
}
function loadPlayerSummary(state, target) {
    const cached = getCachedPlayerSummary(state, target);
    if (cached) {
        return Promise.resolve(cached);
    }
    return (0, espn_1.fetchCompetitorSummary)(target.tour, target.eventId, target.competitorId, target.selectedTour)
        .then((summary) => {
        state.scorecardCache[target.cacheKey] = summary;
        return summary;
    });
}
