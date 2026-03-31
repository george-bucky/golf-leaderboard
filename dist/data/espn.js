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
exports.sortEventSelectorOptions = sortEventSelectorOptions;
exports.parseEspnFittData = parseEspnFittData;
exports.buildEventSelectorOption = buildEventSelectorOption;
exports.formatSelectorLocation = formatSelectorLocation;
exports.isSelectorLiveStatus = isSelectorLiveStatus;
exports.fetchLeaderboardData = fetchLeaderboardData;
exports.pickPrimaryEvent = pickPrimaryEvent;
exports.buildLeaderboardMeta = buildLeaderboardMeta;
exports.buildLeaderboardRows = buildLeaderboardRows;
exports.fetchCompetitorSummary = fetchCompetitorSummary;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const text_1 = require("../utils/text");
const time_1 = require("../utils/time");
const http_1 = require("./http");
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
    const leaderScore = formatLeaderboardScore(leader);
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
        isLive: isLeaderboardLive(competition.status, event.status)
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
function fetchLeaderboardData(options) {
    const selectedEventId = options?.eventId || options?.id || null;
    let leaderboardUrl = `${constants_1.siteApiBase}/leaderboard?region=us&lang=en`;
    if (selectedEventId) {
        leaderboardUrl += `&event=${encodeURIComponent(selectedEventId)}`;
    }
    return (0, http_1.fetchJson)(leaderboardUrl).then((payload) => {
        const events = payload?.events || [];
        let event = null;
        if (selectedEventId) {
            event = lodash_1.default.find(events, (entry) => `${entry?.id}` === `${selectedEventId}`) || null;
        }
        if (!event) {
            event = pickPrimaryEvent(events);
        }
        if (!event) {
            throw new Error('Unable to locate event in leaderboard response');
        }
        const competition = lodash_1.default.first(event.competitions || []);
        if (!competition) {
            throw new Error('Unable to locate competition in leaderboard response');
        }
        return {
            meta: buildLeaderboardMeta(event, competition),
            rows: buildLeaderboardRows(competition.competitors || [], competition.status || {})
        };
    });
}
function pickPrimaryEvent(events) {
    return lodash_1.default.find(events || [], (event) => event && event.primary) || lodash_1.default.first(events || []) || null;
}
function buildLeaderboardMeta(event, competition) {
    const courses = event.courses || [];
    const hostCourse = lodash_1.default.find(courses, (course) => course && course.host) || lodash_1.default.first(courses);
    const city = lodash_1.default.get(hostCourse, 'address.city', '');
    const state = lodash_1.default.get(hostCourse, 'address.state', '');
    const country = lodash_1.default.get(hostCourse, 'address.country', '');
    const cityState = [city, state].filter(Boolean).join(', ');
    const location = cityState || [city, country].filter(Boolean).join(', ') || lodash_1.default.get(hostCourse, 'name', '');
    const purse = lodash_1.default.get(event, 'displayPurse') || lodash_1.default.get(event, 'purse') || '';
    const competitors = competition.competitors || [];
    const competitorMap = lodash_1.default.reduce(competitors, (memo, competitor) => {
        const playerName = lodash_1.default.get(competitor, 'athlete.displayName', '');
        if (!playerName) {
            return memo;
        }
        memo[(0, text_1.normalizeName)(playerName)] = {
            id: `${competitor.id || ''}`,
            status: lodash_1.default.get(competitor, 'status.type.state', ''),
            name: playerName
        };
        return memo;
    }, {});
    const competitorMapById = lodash_1.default.reduce(competitors, (memo, competitor) => {
        const competitorId = `${competitor?.id || ''}`.trim();
        if (!competitorId) {
            return memo;
        }
        memo[competitorId] = {
            id: competitorId,
            status: lodash_1.default.get(competitor, 'status.type.state', ''),
            name: lodash_1.default.get(competitor, 'athlete.displayName', '')
        };
        return memo;
    }, {});
    return {
        id: `${event.id || ''}`,
        tour: lodash_1.default.get(event, 'league.slug', 'pga'),
        name: event.name || event.shortName || '',
        currentRound: lodash_1.default.get(competition, 'status.period') || lodash_1.default.get(event, 'status.period') || null,
        location,
        cityState,
        purse,
        isLive: isLeaderboardLive(competition.status, event.status),
        competitorMap,
        competitorMapById
    };
}
function buildLeaderboardRows(competitors, competitionStatus) {
    const currentRound = lodash_1.default.get(competitionStatus, 'period') || 1;
    const sorted = lodash_1.default.sortBy(competitors, (competitor) => {
        const order = parseInt(competitor?.sortOrder, 10);
        return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
    });
    return lodash_1.default.map(sorted, (competitor) => {
        const roundOne = findRoundScoreByPeriod(competitor.linescores, 1);
        const roundTwo = findRoundScoreByPeriod(competitor.linescores, 2);
        const roundThree = findRoundScoreByPeriod(competitor.linescores, 3);
        const roundFour = findRoundScoreByPeriod(competitor.linescores, 4);
        return {
            COMP_ID: `${competitor.id || ''}`,
            POS: formatLeaderboardPos(lodash_1.default.get(competitor, 'status.position')),
            PLAYER: lodash_1.default.get(competitor, 'athlete.displayName', '--'),
            SCORE: formatLeaderboardScore(competitor),
            TODAY: formatLeaderboardToday(competitor, currentRound),
            THRU: formatLeaderboardThru(competitor),
            R1: formatLeaderboardRoundScore(roundOne, competitor, 1, currentRound),
            R2: formatLeaderboardRoundScore(roundTwo, competitor, 2, currentRound),
            R3: formatLeaderboardRoundScore(roundThree, competitor, 3, currentRound),
            R4: formatLeaderboardRoundScore(roundFour, competitor, 4, currentRound),
            TOT: formatLeaderboardTotal(competitor),
            CTRY: lodash_1.default.get(competitor, 'athlete.flag.alt', '')
        };
    });
}
function findRoundScoreByPeriod(linescores, period) {
    return lodash_1.default.find(linescores || [], (line) => parseInt(line?.period, 10) === period) || null;
}
function formatLeaderboardPos(position) {
    if (!position || !position.displayName) {
        return '--';
    }
    const text = `${position.displayName}`;
    if (!position.isTie) {
        return text;
    }
    if (text.indexOf('T') === 0) {
        return text;
    }
    return `T${text}`;
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
function getCompetitorStatByName(competitor, statName) {
    return lodash_1.default.find(competitor?.statistics, (stat) => stat && stat.name === statName) || null;
}
function formatLeaderboardScore(competitor) {
    const scoreToParStat = getCompetitorStatByName(competitor, 'scoreToPar');
    const scoreToParDisplay = `${lodash_1.default.get(scoreToParStat, 'displayValue', '')}`.trim();
    if (scoreToParDisplay && scoreToParDisplay !== '--') {
        return normalizeScoreDisplay(scoreToParDisplay);
    }
    const scoreToParValue = lodash_1.default.get(scoreToParStat, 'value');
    if (scoreToParValue != null && scoreToParValue !== '') {
        return normalizeScoreDisplay(scoreToParValue);
    }
    return normalizeScoreDisplay(lodash_1.default.get(competitor, 'score.displayValue'));
}
function formatLeaderboardToday(competitor, currentRound) {
    const state = `${lodash_1.default.get(competitor, 'status.type.state', '')}`.toLowerCase();
    const line = findRoundScoreByPeriod(competitor.linescores, currentRound);
    const displayValue = lodash_1.default.get(line, 'displayValue', '');
    const text = `${displayValue || ''}`.trim();
    if (!text) {
        if (state === 'pre') {
            return '-';
        }
        if (state === 'in' || state === 'live') {
            const detail = `${lodash_1.default.get(competitor, 'status.detail', '')}`.trim();
            if (detail.indexOf('(') !== -1) {
                return detail.split('(')[0];
            }
        }
        return '--';
    }
    if (text === '0') {
        return 'E';
    }
    if (text.indexOf('(') !== -1) {
        return text.split('(')[0];
    }
    return text;
}
function formatLeaderboardThru(competitor) {
    const statusState = `${lodash_1.default.get(competitor, 'status.type.state', '')}`.toLowerCase();
    const thruValue = lodash_1.default.get(competitor, 'status.thru');
    const thruText = `${thruValue == null ? '' : thruValue}`.trim();
    if ((statusState === 'in' || statusState === 'live') && /^\d+$/.test(thruText) && parseInt(thruText, 10) > 0) {
        return thruText;
    }
    if (statusState === 'post' || lodash_1.default.get(competitor, 'status.type.completed')) {
        return 'F';
    }
    const teeTime = (0, time_1.parseTeeTime)(lodash_1.default.get(competitor, 'status.teeTime') || lodash_1.default.get(competitor, 'status.displayValue'));
    if (teeTime) {
        return teeTime;
    }
    const detail = `${lodash_1.default.get(competitor, 'status.detail', '')}`.trim();
    if (detail && detail !== 'Scheduled') {
        return detail.replace(/\sET$/, '');
    }
    if (thruText && thruText !== '0') {
        return thruText;
    }
    return '--';
}
function formatLeaderboardRoundScore(roundLine, competitor, roundPeriod, currentRound) {
    if (!roundLine) {
        return '--';
    }
    const state = `${lodash_1.default.get(competitor, 'status.type.state', '')}`.toLowerCase();
    const thru = parseInt(lodash_1.default.get(competitor, 'status.thru'), 10);
    const isCurrentRound = roundPeriod === currentRound;
    const currentRoundInProgress = isCurrentRound
        && (state === 'in' || state === 'live')
        && Number.isInteger(thru)
        && thru > 0
        && thru < 18;
    if (currentRoundInProgress) {
        return '--';
    }
    const roundValue = lodash_1.default.get(roundLine, 'value');
    if (roundValue != null && roundValue !== '') {
        return `${roundValue}`;
    }
    const displayValue = `${lodash_1.default.get(roundLine, 'displayValue', '')}`.trim();
    if (!displayValue || displayValue === '-' || displayValue === 'undefined') {
        return '--';
    }
    return displayValue;
}
function formatLeaderboardTotal(competitor) {
    const totalFromRounds = lodash_1.default.chain(competitor?.linescores)
        .map((line) => parseInt(lodash_1.default.get(line, 'value'), 10))
        .filter((value) => Number.isInteger(value))
        .sum()
        .value();
    if (Number.isInteger(totalFromRounds) && totalFromRounds > 0) {
        return `${totalFromRounds}`;
    }
    const totalValue = lodash_1.default.get(competitor, 'score.value');
    if (totalValue != null && totalValue !== '') {
        return `${totalValue}`;
    }
    return '--';
}
function isLeaderboardLive(competitionStatus, eventStatus) {
    const competitionState = `${lodash_1.default.get(competitionStatus, 'type.state', '')}`.toLowerCase();
    const eventState = `${lodash_1.default.get(eventStatus, 'type.state', '')}`.toLowerCase();
    const shortDetail = `${lodash_1.default.get(competitionStatus, 'type.shortDetail', '')}`.toLowerCase();
    if (competitionState === 'in' || competitionState === 'live' || eventState === 'in' || eventState === 'live') {
        return true;
    }
    if (shortDetail.indexOf('in progress') !== -1 || shortDetail.indexOf('live') !== -1) {
        return true;
    }
    return false;
}
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
