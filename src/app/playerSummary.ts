import { fetchCompetitorSummary } from '../data/espn';
import { findCompetitorForPlayerRow } from '../state/store';
import { AppState, CompetitorSummary, PlayerRow } from '../types';

export interface PlayerSummaryTarget {
  cacheKey: string;
  competitorId: string;
  eventId: string;
  tour: string;
  selectedTour?: string;
}

export function getPlayerSummaryTarget(state: AppState, player: PlayerRow): PlayerSummaryTarget | null {
  const competitor = findCompetitorForPlayerRow(state, player);
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

export function getCachedPlayerSummary(state: AppState, target: PlayerSummaryTarget): CompetitorSummary | null {
  return state.scorecardCache[target.cacheKey] || null;
}

export function loadPlayerSummary(state: AppState, target: PlayerSummaryTarget): Promise<CompetitorSummary> {
  const cached = getCachedPlayerSummary(state, target);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fetchCompetitorSummary(target.tour, target.eventId, target.competitorId, target.selectedTour)
    .then((summary) => {
      state.scorecardCache[target.cacheKey] = summary;
      return summary;
    });
}
