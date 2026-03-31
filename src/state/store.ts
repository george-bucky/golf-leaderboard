import _ from 'lodash';
import { idleUpdateFrequencyMillis, PLAYER_VIEW_MODES } from '../config/constants';
import { AppState, CompetitorIdentity, PlayerRow } from '../types';
import { normalizeName } from '../utils/text';

export function createAppState(): AppState {
  return {
    playerList: [],
    filteredPlayerList: [],
    leaderboardMeta: null,
    scorecardSelectionTimeout: null,
    suppressSelectionEvents: false,
    playerJumpBuffer: '',
    playerJumpTimeout: null,
    detailViewOpen: false,
    playerViewMode: PLAYER_VIEW_MODES[0],
    refreshTimer: null,
    isUpdatingLeaderboard: false,
    refreshRequestedWhileUpdating: false,
    currentRefreshIntervalMillis: idleUpdateFrequencyMillis,
    scorecardCollapsed: false,
    eventSelectorOpen: true,
    isLoadingEventSelector: false,
    eventSelectorOptions: [],
    eventSelectorCards: [],
    selectedEventSelectorIndex: 0,
    selectedEvent: null,
    eventSelectorShowingLiveOnly: true,
    eventSelectorGridColumns: 1,
    eventSelectorLastLoadedAt: 0,
    eventSelectorLoadPromise: null,
    eventSelectorCardLayoutKey: '',
    favoritePlayersByEvent: {},
    scorecardCache: {}
  };
}

export function clearScorecardCache(state: AppState): void {
  Object.keys(state.scorecardCache).forEach((key) => {
    delete state.scorecardCache[key];
  });
}

export function resetPlayerViewMode(state: AppState): void {
  state.playerViewMode = PLAYER_VIEW_MODES[0];
}

export function setSelectedEvent(state: AppState, event: AppState['selectedEvent']): void {
  state.selectedEvent = event;
}

export function getFavoriteEventKey(state: AppState): string {
  if (state.leaderboardMeta?.id) {
    return `${state.leaderboardMeta.id}`;
  }
  if (state.selectedEvent?.id) {
    return `${state.selectedEvent.id}`;
  }
  return '';
}

export function getFavoriteStoreForSelectedEvent(state: AppState): Record<string, boolean> | null {
  const eventKey = getFavoriteEventKey(state);
  if (!eventKey) {
    return null;
  }
  if (!state.favoritePlayersByEvent[eventKey]) {
    state.favoritePlayersByEvent[eventKey] = {};
  }
  return state.favoritePlayersByEvent[eventKey];
}

export function getFavoritePlayerKey(playerRow: PlayerRow): string {
  const competitorId = `${_.get(playerRow, 'COMP_ID', '')}`.trim();
  if (competitorId) {
    return `id:${competitorId}`;
  }

  const playerName = normalizeName(_.get(playerRow, 'PLAYER', ''));
  return playerName ? `name:${playerName}` : '';
}

export function toggleFavoritePlayer(state: AppState, playerRow: PlayerRow): void {
  const store = getFavoriteStoreForSelectedEvent(state);
  const playerKey = getFavoritePlayerKey(playerRow);
  if (!store || !playerKey) {
    return;
  }

  if (store[playerKey]) {
    delete store[playerKey];
    return;
  }

  store[playerKey] = true;
}

export function isFavoritePlayer(state: AppState, playerRow: PlayerRow): boolean {
  const store = getFavoriteStoreForSelectedEvent(state);
  const playerKey = getFavoritePlayerKey(playerRow);
  return !!(store && playerKey && store[playerKey]);
}

export function getFavoriteCountForSelectedEvent(state: AppState): number {
  const store = getFavoriteStoreForSelectedEvent(state);
  return store ? Object.keys(store).length : 0;
}

export function findCompetitorByName(state: AppState, playerName: string): CompetitorIdentity | null {
  if (!state.leaderboardMeta?.competitorMap) {
    return null;
  }
  return state.leaderboardMeta.competitorMap[normalizeName(playerName)] || null;
}

export function findCompetitorForPlayerRow(state: AppState, playerRow: PlayerRow): CompetitorIdentity | null {
  if (!playerRow || !state.leaderboardMeta) {
    return null;
  }

  const competitorId = `${_.get(playerRow, 'COMP_ID', '')}`.trim();
  if (competitorId && state.leaderboardMeta.competitorMapById?.[competitorId]) {
    return state.leaderboardMeta.competitorMapById[competitorId];
  }

  return findCompetitorByName(state, playerRow.PLAYER);
}

export function isPlayerActive(state: AppState, playerRow: PlayerRow): boolean {
  const competitor = findCompetitorForPlayerRow(state, playerRow);
  const status = _.toLower(competitor?.status);
  if (status === 'in' || status === 'live') {
    return true;
  }

  const thru = `${_.get(playerRow, 'THRU', '')}`.trim();
  return /^\d+$/.test(thru);
}

export function playerMatchesCurrentView(state: AppState, playerRow: PlayerRow): boolean {
  if (state.playerViewMode === 'active') {
    return isPlayerActive(state, playerRow);
  }
  if (state.playerViewMode === 'favorites') {
    return isFavoritePlayer(state, playerRow);
  }
  return true;
}
