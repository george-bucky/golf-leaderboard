import _ from 'lodash';
import { siteApiBase } from '../config/constants';
import { LeaderboardMeta, LeaderboardResponse, PlayerRow } from '../types';
import { normalizeName } from '../utils/text';
import { parseTeeTime } from '../utils/time';
import { fetchJson } from './http';

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
  if (!position.isTie || text.indexOf('T') === 0) {
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

export function formatLeaderboardScore(competitor: any): string {
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

export function isLeaderboardLive(competitionStatus: any, eventStatus: any): boolean {
  const competitionState = `${_.get(competitionStatus, 'type.state', '')}`.toLowerCase();
  const eventState = `${_.get(eventStatus, 'type.state', '')}`.toLowerCase();
  const shortDetail = `${_.get(competitionStatus, 'type.shortDetail', '')}`.toLowerCase();

  if (competitionState === 'in' || competitionState === 'live' || eventState === 'in' || eventState === 'live') {
    return true;
  }
  return shortDetail.indexOf('in progress') !== -1 || shortDetail.indexOf('live') !== -1;
}
