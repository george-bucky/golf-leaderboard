"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCompetitorSummary = fetchCompetitorSummary;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const http_1 = require("./http");
function fetchCompetitorSummary(tour, eventId, competitorId, selectedTour) {
    const tourCandidates = lodash_1.default.uniq([`${tour || ''}`.toLowerCase(), `${selectedTour || ''}`.toLowerCase()].filter(Boolean));
    const tryFetch = (index) => {
        if (index >= tourCandidates.length) {
            return Promise.reject(new Error('No competitor summary found for selected event'));
        }
        const tourSlug = tourCandidates[index];
        const summaryUrl = `${constants_1.siteApiBase}/${encodeURIComponent(tourSlug)}/leaderboard/${encodeURIComponent(eventId)}/competitorsummary/${encodeURIComponent(competitorId)}?region=us&lang=en`;
        return (0, http_1.fetchJson)(summaryUrl).catch(() => tryFetch(index + 1));
    };
    return tryFetch(0);
}
