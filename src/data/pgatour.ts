import https from 'node:https';
import zlib from 'node:zlib';
import _ from 'lodash';
import { PgaTourHoleShots, PgaTourShotSummary, PgaTourStroke } from '../types';
import { normalizeName } from '../utils/text';

const pgaTourGraphqlUrl = 'https://orchestrator.pgatour.com/graphql';
const pgaTourApiKey = 'gsrx5bibzbb4njvhl7t37wqyl4';

const scheduleQuery = `
query Schedule($tourCode: String!, $year: String, $filter: TournamentCategory) {
  schedule(tourCode: $tourCode, year: $year, filter: $filter) {
    upcoming {
      tournaments {
        id
        tournamentName
        tournamentStatus
      }
    }
    completed {
      tournaments {
        id
        tournamentName
        tournamentStatus
      }
    }
  }
}`;

const tournamentQuery = `
query Tournaments($ids: [ID!]) {
  tournaments(ids: $ids) {
    id
    tournamentName
    tournamentStatus
    roundStatus
    currentRound
    features
    scoredLevel
    courses {
      scoringLevel
    }
  }
}`;

const leaderboardQuery = `
query leaderboardV3($tournamentId: ID!) {
  leaderboardCompressedV3(id: $tournamentId) {
    id
    payload
  }
}`;

const shotDetailsQuery = `
query shotDetailsV4Compressed($tournamentId: ID!, $playerId: ID!, $round: Int!, $includeRadar: Boolean) {
  shotDetailsV4Compressed(tournamentId: $tournamentId, playerId: $playerId, round: $round, includeRadar: $includeRadar) {
    id
    payload
  }
}`;

export function fetchPgaTourShotSummary(options: {
  tour?: string;
  eventName: string;
  playerName: string;
  round?: number | null;
  year?: number;
}): Promise<PgaTourShotSummary | null> {
  if (!isPgaTour(options.tour) || !options.eventName || !options.playerName) {
    return Promise.resolve(null);
  }

  const year = options.year || new Date().getFullYear();
  return findPgaTourTournament(options.eventName, year)
    .then((tournament) => {
      if (!tournament?.id) {
        return null;
      }
      return fetchPgaTourTournamentMeta(tournament.id);
    })
    .then((tournament) => {
      if (!tournamentSupportsTourCast(tournament)) {
        return null;
      }
      return fetchPgaTourLeaderboard(tournament.id).then((leaderboard) => ({ tournament, leaderboard }));
    })
    .then((context) => {
      if (!context) {
        return null;
      }
      const player = findPgaTourPlayer(context.leaderboard, options.playerName);
      if (!player?.id) {
        return null;
      }
      const round = normalizeRound(options.round) || normalizeRound(_.get(player, 'scoringData.currentRound')) || normalizeRound(context.tournament.currentRound) || 1;
      return fetchPgaTourShotDetails(context.tournament.id, `${player.id}`, round);
    })
    .catch(() => null);
}

export function decodePgaTourPayload(payload: string): any {
  return JSON.parse(zlib.gunzipSync(Buffer.from(payload, 'base64')).toString('utf8'));
}

export function normalizePgaTourShotDetails(payload: any): PgaTourShotSummary {
  return {
    tournamentId: `${payload?.tournamentId || ''}`,
    playerId: `${payload?.playerId || ''}`,
    round: normalizeRound(payload?.round) || 1,
    holes: _.chain(payload?.holes || [])
      .map(normalizePgaTourHole)
      .filter((hole) => !!hole)
      .value() as PgaTourHoleShots[]
  };
}

function isPgaTour(tour?: string): boolean {
  const tourText = `${tour || ''}`.toLowerCase();
  return tourText === 'pga' || tourText === 'pgatour';
}

function fetchPgaTourTournamentMeta(tournamentId: string): Promise<any | null> {
  return postPgaTourGraphql('Tournaments', tournamentQuery, { ids: [tournamentId] })
    .then((payload) => _.first(payload?.data?.tournaments || []) || null);
}

function findPgaTourTournament(eventName: string, year: number): Promise<any | null> {
  return postPgaTourGraphql('Schedule', scheduleQuery, { tourCode: 'R', year: `${year}`, filter: null })
    .then((payload) => {
      const schedule = payload?.data?.schedule || {};
      const tournaments = _.flatMap((schedule.upcoming || []).concat(schedule.completed || []), (month: any) => month?.tournaments || []);
      const targetName = normalizeTournamentName(eventName);
      return _.find(tournaments, (tournament) => normalizeTournamentName(tournament?.tournamentName) === targetName) || null;
    });
}

function tournamentSupportsTourCast(tournament: any): boolean {
  if (!tournament?.id) {
    return false;
  }
  if (`${tournament.scoredLevel || ''}`.toUpperCase() === 'TOURCAST') {
    return true;
  }
  if (_.includes(tournament.features || [], 'TOURCAST')) {
    return true;
  }
  return _.some(tournament.courses || [], (course) => `${course?.scoringLevel || ''}`.toUpperCase() === 'TOURCAST');
}

function fetchPgaTourLeaderboard(tournamentId: string): Promise<any> {
  return postPgaTourGraphql('leaderboardV3', leaderboardQuery, { tournamentId })
    .then((payload) => decodePgaTourPayload(payload?.data?.leaderboardCompressedV3?.payload || ''));
}

function findPgaTourPlayer(leaderboard: any, playerName: string): any | null {
  const targetName = normalizeName(playerName);
  return _.find(leaderboard?.players || [], (playerRow) => {
    const displayName = normalizeName(_.get(playerRow, 'player.displayName', ''));
    return displayName === targetName;
  }) || null;
}

function fetchPgaTourShotDetails(tournamentId: string, playerId: string, round: number): Promise<PgaTourShotSummary | null> {
  return postPgaTourGraphql('shotDetailsV4Compressed', shotDetailsQuery, {
    tournamentId,
    playerId,
    round,
    includeRadar: false
  }).then((payload) => {
    const compressedPayload = payload?.data?.shotDetailsV4Compressed?.payload;
    if (!compressedPayload) {
      return null;
    }
    return normalizePgaTourShotDetails(decodePgaTourPayload(compressedPayload));
  });
}

function postPgaTourGraphql(operationName: string, query: string, variables: Record<string, unknown>): Promise<any> {
  const body = JSON.stringify({ operationName, query, variables });
  return new Promise((resolve, reject) => {
    const request = https.request(
      pgaTourGraphqlUrl,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-api-key': pgaTourApiKey,
          'x-pgat-platform': 'web'
        }
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk.toString('utf8');
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`PGA Tour request failed with status ${response.statusCode}`));
            return;
          }
          let payload;
          try {
            payload = JSON.parse(data);
          } catch (error) {
            reject(error);
            return;
          }
          if (payload.errors?.length) {
            reject(new Error('PGA Tour GraphQL request failed'));
            return;
          }
          resolve(payload);
        });
        response.on('error', reject);
      }
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function normalizePgaTourHole(hole: any): PgaTourHoleShots | null {
  const holeNumber = parseInt(`${hole?.holeNumber || ''}`, 10);
  if (!Number.isInteger(holeNumber)) {
    return null;
  }
  return {
    holeNumber,
    displayHoleNumber: `${hole.displayHoleNumber || holeNumber}`,
    par: normalizeNumber(hole.par),
    yardage: normalizeNumber(hole.yardage),
    score: `${hole.score || ''}`,
    status: `${hole.status || ''}`,
    strokes: _.chain(hole.strokes || [])
      .map(normalizePgaTourStroke)
      .filter((stroke) => !!stroke)
      .value() as PgaTourStroke[]
  };
}

function normalizePgaTourStroke(stroke: any): PgaTourStroke | null {
  const strokeNumber = parseInt(`${stroke?.strokeNumber || ''}`, 10);
  if (!Number.isInteger(strokeNumber)) {
    return null;
  }
  return {
    strokeNumber,
    playByPlay: `${stroke.playByPlay || ''}`.trim(),
    playByPlayLabel: `${stroke.playByPlayLabel || `Shot ${strokeNumber}`}`.trim(),
    distance: `${stroke.distance || ''}`.trim(),
    distanceRemaining: `${stroke.distanceRemaining || ''}`.trim(),
    fromLocation: `${stroke.fromLocation || ''}`.trim(),
    toLocation: `${stroke.toLocation || ''}`.trim()
  };
}

function normalizeTournamentName(name: string): string {
  return normalizeName(name).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeRound(value: unknown): number | null {
  const round = parseInt(`${value || ''}`, 10);
  return Number.isInteger(round) && round > 0 ? round : null;
}

function normalizeNumber(value: unknown): number | null {
  const numberValue = parseInt(`${value || ''}`, 10);
  return Number.isInteger(numberValue) ? numberValue : null;
}
