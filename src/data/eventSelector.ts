import _ from 'lodash';
import { selectorTourSlugs, siteApiBase, url } from '../config/constants';
import { EventSelectorOption } from '../types';
import { fetchJson, fetchText } from './http';
import { formatLeaderboardScore, isLeaderboardLive } from './leaderboard';

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
