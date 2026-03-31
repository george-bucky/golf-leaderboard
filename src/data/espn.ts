import _ from 'lodash';
import { selectorTourSlugs, siteApiBase, url } from '../config/constants';
import { EventSelectorOption, LeaderboardMeta, LeaderboardResponse, PlayerRow } from '../types';
import { normalizeName } from '../utils/text';
import { parseTeeTime } from '../utils/time';
import { fetchJson, fetchText } from './http';

export function fetchEventSelectorOptions(): Promise<EventSelectorOption[]> {
  return Promise.all([
    loadPrimaryEventSelectorOptionsWithFallback(fetchPrimaryEventSelectorOptions, fetchTourEventSelectorOption),
    Promise.all(_.map(selectorTourSlugs, (tour) => fetchTourEventSelectorOption(tour).catch(() => null)))
  ]).then((results) => {
    const primary = _.compact(results[0] || []);
    const additionalTours = _.compact(results[1] || []);
    const merged = _.uniqBy(primary.concat(additionalTours), (entry) => `${entry.id || ''}`);
    return sortEventSelectorOptions(merged);
  });
}

export function loadPrimaryEventSelectorOptionsWithFallback(
  primaryFetcher: () => Promise<EventSelectorOption[]>,
  tourFetcher: (tour: string) => Promise<EventSelectorOption | null>
): Promise<EventSelectorOption[]> {
  const fetchPrimary = primaryFetcher || fetchPrimaryEventSelectorOptions;
  const fetchTour = tourFetcher || fetchTourEventSelectorOption;

  return fetchPrimary().catch(() =>
    fetchTour('pga')
      .then((option) => _.compact([option]))
      .catch(() => [])
  );
}

export function fetchPrimaryEventSelectorOptions(): Promise<EventSelectorOption[]> {
  const leaderboardUrl = `${siteApiBase}/leaderboard?region=us&lang=en`;
  return fetchJson<any>(leaderboardUrl).then((payload) =>
    _.compact(
      _.map(payload?.events || [], (event) => {
        const competition = _.first(event?.competitions || []);
        if (!event || !competition) {
          return null;
        }
        return buildEventSelectorOptionFromApiEvent(event, competition);
      })
    )
  );
}

export function fetchTourEventSelectorOption(tour: string): Promise<EventSelectorOption | null> {
  const tourUrl = `${url}?tour=${encodeURIComponent(tour)}`;
  return fetchText(tourUrl)
    .then(parseEspnFittData)
    .then((payload) => buildEventSelectorOption(payload, tour));
}

export function buildEventSelectorOptionFromApiEvent(event: any, competition: any): EventSelectorOption {
  const courses = event.courses || [];
  const hostCourse = _.find(courses, (course) => course && course.host) || _.first(courses) || {};
  const competitors = _.sortBy(competition.competitors || [], (competitor) => {
    const order = parseInt(competitor?.sortOrder, 10);
    return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
  });
  const leader = _.first(competitors) || {};
  const leaderName = _.get(leader, 'athlete.displayName', '');
  const leaderScore = formatLeaderboardScore(leader);

  return {
    id: `${event.id || ''}`,
    tour: `${_.get(event, 'league.slug', 'pga')}`.toLowerCase(),
    tourName: _.get(event, 'league.name', 'PGA TOUR'),
    name: event.name || event.shortName || 'Golf Event',
    status: `${_.get(competition, 'status.type.state', _.get(event, 'status.type.state', ''))}`.toLowerCase(),
    currentRound: _.get(competition, 'status.period') || _.get(event, 'status.period') || null,
    leaderText: leaderName ? `${leaderName} (${leaderScore})` : '--',
    location: formatSelectorLocation(hostCourse),
    courseName: _.get(hostCourse, 'name', '') || 'Course unavailable',
    isLive: isLeaderboardLive(competition.status, event.status)
  };
}

export function sortEventSelectorOptions(options: EventSelectorOption[]): EventSelectorOption[] {
  const statusOrder: Record<string, number> = { in: 0, live: 0, pre: 1, post: 2 };
  return _.sortBy(options || [], [
    (entry) => (statusOrder[`${entry?.status || ''}`] != null ? statusOrder[`${entry.status}`] : 3),
    (entry) => `${entry?.tourName || ''}`.toLowerCase(),
    (entry) => `${entry?.name || ''}`.toLowerCase()
  ]);
}

export function parseEspnFittData(html: string): any {
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

export function buildEventSelectorOption(payload: any, fallbackTour?: string): EventSelectorOption | null {
  const leaderboard = _.get(payload, 'page.content.leaderboard');
  if (!leaderboard || !leaderboard.id) {
    return null;
  }

  const event = leaderboard.hdr?.evnt || {};
  const courses = event.crse || [];
  const hostCourse = _.find(courses, (course) => course && course.host) || _.first(courses) || {};
  const competitors = _.sortBy(leaderboard.competitors || [], (competitor) => {
    const order = parseInt(competitor?.order, 10);
    return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
  });
  const leader = _.first(competitors) || {};
  const leaderScore = normalizeScoreDisplay(leader.toPar || leader.today || '--');
  const activeTour = _.find(leaderboard.hdr?.tours || [], (tour) => tour && tour.isActive);

  return {
    id: `${leaderboard.id}`,
    tour: `${leaderboard.tour || _.get(activeTour, 'abbrev') || fallbackTour || ''}`.toLowerCase(),
    tourName: _.get(activeTour, 'name') || leaderboard.tourName || `${fallbackTour || ''}`.toUpperCase(),
    name: leaderboard.name || event.name || 'Golf Event',
    status: `${leaderboard.status || ''}`.toLowerCase(),
    currentRound: leaderboard.currentRound || null,
    leaderText: leader.name ? `${leader.name} (${leaderScore})` : '--',
    location: formatSelectorLocation(hostCourse),
    courseName: _.get(hostCourse, 'name', '') || 'Course unavailable',
    isLive: isSelectorLiveStatus(leaderboard.status)
  };
}

export function formatSelectorLocation(course: any): string {
  const city = _.get(course, 'addr.city') || _.get(course, 'address.city') || '';
  const state = _.get(course, 'addr.state') || _.get(course, 'address.state') || '';
  const country = _.get(course, 'addr.ctry') || _.get(course, 'address.country') || '';
  const cityState = [city, state].filter(Boolean).join(', ');
  return cityState || [city, country].filter(Boolean).join(', ') || _.get(course, 'name', 'Location unavailable');
}

export function isSelectorLiveStatus(status: string): boolean {
  const text = `${status || ''}`.toLowerCase();
  return text === 'in' || text === 'live';
}

export function fetchLeaderboardData(options?: { eventId?: string; id?: string }): Promise<LeaderboardResponse> {
  const selectedEventId = options?.eventId || options?.id || null;
  let leaderboardUrl = `${siteApiBase}/leaderboard?region=us&lang=en`;
  if (selectedEventId) {
    leaderboardUrl += `&event=${encodeURIComponent(selectedEventId)}`;
  }

  return fetchJson<any>(leaderboardUrl).then((payload) => {
    const events = payload?.events || [];
    let event = null;
    if (selectedEventId) {
      event = _.find(events, (entry) => `${entry?.id}` === `${selectedEventId}`) || null;
    }
    if (!event) {
      event = pickPrimaryEvent(events);
    }
    if (!event) {
      throw new Error('Unable to locate event in leaderboard response');
    }

    const competition: any = _.first(event.competitions || []);
    if (!competition) {
      throw new Error('Unable to locate competition in leaderboard response');
    }

    return {
      meta: buildLeaderboardMeta(event, competition),
      rows: buildLeaderboardRows(competition.competitors || [], competition.status || {})
    };
  });
}

export function pickPrimaryEvent(events: any[]): any {
  return _.find(events || [], (event) => event && event.primary) || _.first(events || []) || null;
}

export function buildLeaderboardMeta(event: any, competition: any): LeaderboardMeta {
  const courses = event.courses || [];
  const hostCourse = _.find(courses, (course) => course && course.host) || _.first(courses);
  const city = _.get(hostCourse, 'address.city', '');
  const state = _.get(hostCourse, 'address.state', '');
  const country = _.get(hostCourse, 'address.country', '');
  const cityState = [city, state].filter(Boolean).join(', ');
  const location = cityState || [city, country].filter(Boolean).join(', ') || _.get(hostCourse, 'name', '');
  const purse = _.get(event, 'displayPurse') || _.get(event, 'purse') || '';
  const competitors = competition.competitors || [];

  const competitorMap = _.reduce(
    competitors,
    (memo: Record<string, { id: string; status: string; name: string }>, competitor) => {
      const playerName = _.get(competitor, 'athlete.displayName', '');
      if (!playerName) {
        return memo;
      }
      memo[normalizeName(playerName)] = {
        id: `${competitor.id || ''}`,
        status: _.get(competitor, 'status.type.state', ''),
        name: playerName
      };
      return memo;
    },
    {}
  );

  const competitorMapById = _.reduce(
    competitors,
    (memo: Record<string, { id: string; status: string; name: string }>, competitor) => {
      const competitorId = `${competitor?.id || ''}`.trim();
      if (!competitorId) {
        return memo;
      }
      memo[competitorId] = {
        id: competitorId,
        status: _.get(competitor, 'status.type.state', ''),
        name: _.get(competitor, 'athlete.displayName', '')
      };
      return memo;
    },
    {}
  );

  return {
    id: `${event.id || ''}`,
    tour: _.get(event, 'league.slug', 'pga'),
    name: event.name || event.shortName || '',
    currentRound: _.get(competition, 'status.period') || _.get(event, 'status.period') || null,
    location,
    cityState,
    purse,
    isLive: isLeaderboardLive(competition.status, event.status),
    competitorMap,
    competitorMapById
  };
}

export function buildLeaderboardRows(competitors: any[], competitionStatus: any): PlayerRow[] {
  const currentRound = _.get(competitionStatus, 'period') || 1;
  const sorted = _.sortBy(competitors, (competitor) => {
    const order = parseInt(competitor?.sortOrder, 10);
    return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
  });

  return _.map(sorted, (competitor) => {
    const roundOne = findRoundScoreByPeriod(competitor.linescores, 1);
    const roundTwo = findRoundScoreByPeriod(competitor.linescores, 2);
    const roundThree = findRoundScoreByPeriod(competitor.linescores, 3);
    const roundFour = findRoundScoreByPeriod(competitor.linescores, 4);
    return {
      COMP_ID: `${competitor.id || ''}`,
      POS: formatLeaderboardPos(_.get(competitor, 'status.position')),
      PLAYER: _.get(competitor, 'athlete.displayName', '--'),
      SCORE: formatLeaderboardScore(competitor),
      TODAY: formatLeaderboardToday(competitor, currentRound),
      THRU: formatLeaderboardThru(competitor),
      R1: formatLeaderboardRoundScore(roundOne, competitor, 1, currentRound),
      R2: formatLeaderboardRoundScore(roundTwo, competitor, 2, currentRound),
      R3: formatLeaderboardRoundScore(roundThree, competitor, 3, currentRound),
      R4: formatLeaderboardRoundScore(roundFour, competitor, 4, currentRound),
      TOT: formatLeaderboardTotal(competitor),
      CTRY: _.get(competitor, 'athlete.flag.alt', '')
    };
  });
}

function findRoundScoreByPeriod(linescores: any[], period: number): any {
  return _.find(linescores || [], (line) => parseInt(line?.period, 10) === period) || null;
}

function formatLeaderboardPos(position: any): string {
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

function normalizeScoreDisplay(value: unknown): string {
  const text = `${value == null ? '' : value}`.trim();
  if (!text || text === '--') {
    return '--';
  }
  if (text === '0' || text === '+0' || text === '-0') {
    return 'E';
  }
  return text;
}

function getCompetitorStatByName(competitor: any, statName: string): any {
  return _.find(competitor?.statistics, (stat) => stat && stat.name === statName) || null;
}

function formatLeaderboardScore(competitor: any): string {
  const scoreToParStat = getCompetitorStatByName(competitor, 'scoreToPar');
  const scoreToParDisplay = `${_.get(scoreToParStat, 'displayValue', '')}`.trim();
  if (scoreToParDisplay && scoreToParDisplay !== '--') {
    return normalizeScoreDisplay(scoreToParDisplay);
  }

  const scoreToParValue = _.get(scoreToParStat, 'value');
  if (scoreToParValue != null && scoreToParValue !== '') {
    return normalizeScoreDisplay(scoreToParValue);
  }

  return normalizeScoreDisplay(_.get(competitor, 'score.displayValue'));
}

function formatLeaderboardToday(competitor: any, currentRound: number): string {
  const state = `${_.get(competitor, 'status.type.state', '')}`.toLowerCase();
  const line = findRoundScoreByPeriod(competitor.linescores, currentRound);
  const displayValue = _.get(line, 'displayValue', '');
  const text = `${displayValue || ''}`.trim();
  if (!text) {
    if (state === 'pre') {
      return '-';
    }
    if (state === 'in' || state === 'live') {
      const detail = `${_.get(competitor, 'status.detail', '')}`.trim();
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

function formatLeaderboardThru(competitor: any): string {
  const statusState = `${_.get(competitor, 'status.type.state', '')}`.toLowerCase();
  const thruValue = _.get(competitor, 'status.thru');
  const thruText = `${thruValue == null ? '' : thruValue}`.trim();

  if ((statusState === 'in' || statusState === 'live') && /^\d+$/.test(thruText) && parseInt(thruText, 10) > 0) {
    return thruText;
  }

  if (statusState === 'post' || _.get(competitor, 'status.type.completed')) {
    return 'F';
  }

  const teeTime = parseTeeTime(_.get(competitor, 'status.teeTime') || _.get(competitor, 'status.displayValue'));
  if (teeTime) {
    return teeTime;
  }

  const detail = `${_.get(competitor, 'status.detail', '')}`.trim();
  if (detail && detail !== 'Scheduled') {
    return detail.replace(/\sET$/, '');
  }

  if (thruText && thruText !== '0') {
    return thruText;
  }

  return '--';
}

function formatLeaderboardRoundScore(roundLine: any, competitor: any, roundPeriod: number, currentRound: number): string {
  if (!roundLine) {
    return '--';
  }

  const state = `${_.get(competitor, 'status.type.state', '')}`.toLowerCase();
  const thru = parseInt(_.get(competitor, 'status.thru'), 10);
  const isCurrentRound = roundPeriod === currentRound;
  const currentRoundInProgress = isCurrentRound
    && (state === 'in' || state === 'live')
    && Number.isInteger(thru)
    && thru > 0
    && thru < 18;

  if (currentRoundInProgress) {
    return '--';
  }

  const roundValue = _.get(roundLine, 'value');
  if (roundValue != null && roundValue !== '') {
    return `${roundValue}`;
  }

  const displayValue = `${_.get(roundLine, 'displayValue', '')}`.trim();
  if (!displayValue || displayValue === '-' || displayValue === 'undefined') {
    return '--';
  }
  return displayValue;
}

function formatLeaderboardTotal(competitor: any): string {
  const totalFromRounds = _.chain(competitor?.linescores)
    .map((line) => parseInt(_.get(line, 'value'), 10))
    .filter((value) => Number.isInteger(value))
    .sum()
    .value();

  if (Number.isInteger(totalFromRounds) && totalFromRounds > 0) {
    return `${totalFromRounds}`;
  }

  const totalValue = _.get(competitor, 'score.value');
  if (totalValue != null && totalValue !== '') {
    return `${totalValue}`;
  }
  return '--';
}

function isLeaderboardLive(competitionStatus: any, eventStatus: any): boolean {
  const competitionState = `${_.get(competitionStatus, 'type.state', '')}`.toLowerCase();
  const eventState = `${_.get(eventStatus, 'type.state', '')}`.toLowerCase();
  const shortDetail = `${_.get(competitionStatus, 'type.shortDetail', '')}`.toLowerCase();

  if (competitionState === 'in' || competitionState === 'live' || eventState === 'in' || eventState === 'live') {
    return true;
  }
  if (shortDetail.indexOf('in progress') !== -1 || shortDetail.indexOf('live') !== -1) {
    return true;
  }
  return false;
}

export function fetchCompetitorSummary(
  tour: string,
  eventId: string,
  competitorId: string,
  selectedTour?: string
): Promise<any> {
  const tourCandidates = _.uniq([`${tour || ''}`.toLowerCase(), `${selectedTour || ''}`.toLowerCase()].filter(Boolean));

  const tryFetch = (index: number): Promise<any> => {
    if (index >= tourCandidates.length) {
      return Promise.reject(new Error('No competitor summary found for selected event'));
    }
    const tourSlug = tourCandidates[index];
    const summaryUrl = `${siteApiBase}/${encodeURIComponent(tourSlug)}/leaderboard/${encodeURIComponent(eventId)}/competitorsummary/${encodeURIComponent(competitorId)}?region=us&lang=en`;
    return fetchJson(summaryUrl).catch(() => tryFetch(index + 1));
  };

  return tryFetch(0);
}
