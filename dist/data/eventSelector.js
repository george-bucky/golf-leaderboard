"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEventSelectorOptions = fetchEventSelectorOptions;
exports.loadPrimaryEventSelectorOptionsWithFallback = loadPrimaryEventSelectorOptionsWithFallback;
exports.fetchPrimaryEventSelectorOptions = fetchPrimaryEventSelectorOptions;
exports.fetchTourEventSelectorOption = fetchTourEventSelectorOption;
exports.buildEventSelectorOptionFromApiEvent = buildEventSelectorOptionFromApiEvent;
exports.buildEventSelectorOption = buildEventSelectorOption;
exports.sortEventSelectorOptions = sortEventSelectorOptions;
exports.parseEspnFittData = parseEspnFittData;
exports.formatSelectorLocation = formatSelectorLocation;
exports.isSelectorLiveStatus = isSelectorLiveStatus;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const http_1 = require("./http");
const leaderboard_1 = require("./leaderboard");
function fetchEventSelectorOptions() {
    return Promise.all([
        loadPrimaryEventSelectorOptionsWithFallback(fetchPrimaryEventSelectorOptions, fetchTourEventSelectorOption),
        Promise.all(lodash_1.default.map(constants_1.selectorTourSlugs, (tour) => fetchTourEventSelectorOption(tour).catch(() => null)))
    ]).then((results) => {
        const primary = lodash_1.default.compact(results[0] || []);
        const additionalTours = lodash_1.default.compact(results[1] || []);
        const merged = lodash_1.default.uniqBy(primary.concat(additionalTours), (entry) => `${entry.id || ''}`);
        return sortEventSelectorOptions(merged);
    });
}
function loadPrimaryEventSelectorOptionsWithFallback(primaryFetcher, tourFetcher) {
    const fetchPrimary = primaryFetcher || fetchPrimaryEventSelectorOptions;
    const fetchTour = tourFetcher || fetchTourEventSelectorOption;
    return fetchPrimary().catch(() => fetchTour('pga')
        .then((option) => lodash_1.default.compact([option]))
        .catch(() => []));
}
function fetchPrimaryEventSelectorOptions() {
    const leaderboardUrl = `${constants_1.siteApiBase}/leaderboard?region=us&lang=en`;
    return (0, http_1.fetchJson)(leaderboardUrl).then((payload) => lodash_1.default.compact(lodash_1.default.map(payload?.events || [], (event) => {
        const competition = lodash_1.default.first(event?.competitions || []);
        if (!event || !competition) {
            return null;
        }
        return buildEventSelectorOptionFromApiEvent(event, competition);
    })));
}
function fetchTourEventSelectorOption(tour) {
    const tourUrl = `${constants_1.url}?tour=${encodeURIComponent(tour)}`;
    return (0, http_1.fetchText)(tourUrl)
        .then(parseEspnFittData)
        .then((payload) => buildEventSelectorOption(payload, tour));
}
function buildEventSelectorOptionFromApiEvent(event, competition) {
    const courses = event.courses || [];
    const hostCourse = lodash_1.default.find(courses, (course) => course && course.host) || lodash_1.default.first(courses) || {};
    const competitors = lodash_1.default.sortBy(competition.competitors || [], (competitor) => {
        const order = parseInt(competitor?.sortOrder, 10);
        return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
    });
    const leader = lodash_1.default.first(competitors) || {};
    const leaderName = lodash_1.default.get(leader, 'athlete.displayName', '');
    const leaderScore = (0, leaderboard_1.formatLeaderboardScore)(leader);
    return {
        id: `${event.id || ''}`,
        tour: `${lodash_1.default.get(event, 'league.slug', 'pga')}`.toLowerCase(),
        tourName: lodash_1.default.get(event, 'league.name', 'PGA TOUR'),
        name: event.name || event.shortName || 'Golf Event',
        status: `${lodash_1.default.get(competition, 'status.type.state', lodash_1.default.get(event, 'status.type.state', ''))}`.toLowerCase(),
        currentRound: lodash_1.default.get(competition, 'status.period') || lodash_1.default.get(event, 'status.period') || null,
        leaderText: leaderName ? `${leaderName} (${leaderScore})` : '--',
        location: formatSelectorLocation(hostCourse),
        courseName: lodash_1.default.get(hostCourse, 'name', '') || 'Course unavailable',
        isLive: (0, leaderboard_1.isLeaderboardLive)(competition.status, event.status)
    };
}
function buildEventSelectorOption(payload, fallbackTour) {
    const leaderboard = lodash_1.default.get(payload, 'page.content.leaderboard');
    if (!leaderboard || !leaderboard.id) {
        return null;
    }
    const event = leaderboard.hdr?.evnt || {};
    const courses = event.crse || [];
    const hostCourse = lodash_1.default.find(courses, (course) => course && course.host) || lodash_1.default.first(courses) || {};
    const competitors = lodash_1.default.sortBy(leaderboard.competitors || [], (competitor) => {
        const order = parseInt(competitor?.order, 10);
        return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
    });
    const leader = lodash_1.default.first(competitors) || {};
    const leaderScore = normalizeScoreDisplay(leader.toPar || leader.today || '--');
    const activeTour = lodash_1.default.find(leaderboard.hdr?.tours || [], (tour) => tour && tour.isActive);
    return {
        id: `${leaderboard.id}`,
        tour: `${leaderboard.tour || lodash_1.default.get(activeTour, 'abbrev') || fallbackTour || ''}`.toLowerCase(),
        tourName: lodash_1.default.get(activeTour, 'name') || leaderboard.tourName || `${fallbackTour || ''}`.toUpperCase(),
        name: leaderboard.name || event.name || 'Golf Event',
        status: `${leaderboard.status || ''}`.toLowerCase(),
        currentRound: leaderboard.currentRound || null,
        leaderText: leader.name ? `${leader.name} (${leaderScore})` : '--',
        location: formatSelectorLocation(hostCourse),
        courseName: lodash_1.default.get(hostCourse, 'name', '') || 'Course unavailable',
        isLive: isSelectorLiveStatus(leaderboard.status)
    };
}
function sortEventSelectorOptions(options) {
    const statusOrder = { in: 0, live: 0, pre: 1, post: 2 };
    return lodash_1.default.sortBy(options || [], [
        (entry) => (statusOrder[`${entry?.status || ''}`] != null ? statusOrder[`${entry.status}`] : 3),
        (entry) => `${entry?.tourName || ''}`.toLowerCase(),
        (entry) => `${entry?.name || ''}`.toLowerCase()
    ]);
}
function parseEspnFittData(html) {
    const markerMatch = /window\['__espnfitt__'\]\s*=\s*/.exec(html);
    if (!markerMatch) {
        throw new Error('Unable to locate ESPN page data');
    }
    const payloadStart = markerMatch.index + markerMatch[0].length;
    const payloadEnd = html.indexOf('</script>', payloadStart);
    if (payloadEnd === -1) {
        throw new Error('Unable to parse ESPN page data');
    }
    let json = html.slice(payloadStart, payloadEnd).trim();
    if (json.endsWith(';')) {
        json = json.slice(0, -1);
    }
    return JSON.parse(json);
}
function formatSelectorLocation(course) {
    const city = lodash_1.default.get(course, 'addr.city') || lodash_1.default.get(course, 'address.city') || '';
    const state = lodash_1.default.get(course, 'addr.state') || lodash_1.default.get(course, 'address.state') || '';
    const country = lodash_1.default.get(course, 'addr.ctry') || lodash_1.default.get(course, 'address.country') || '';
    const cityState = [city, state].filter(Boolean).join(', ');
    return cityState || [city, country].filter(Boolean).join(', ') || lodash_1.default.get(course, 'name', 'Location unavailable');
}
function isSelectorLiveStatus(status) {
    const text = `${status || ''}`.toLowerCase();
    return text === 'in' || text === 'live';
}
function normalizeScoreDisplay(value) {
    const text = `${value == null ? '' : value}`.trim();
    if (!text || text === '--') {
        return '--';
    }
    if (text === '0' || text === '+0' || text === '-0') {
        return 'E';
    }
    return text;
}
