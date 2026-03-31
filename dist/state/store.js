"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppState = createAppState;
exports.clearScorecardCache = clearScorecardCache;
exports.resetPlayerViewMode = resetPlayerViewMode;
exports.setSelectedEvent = setSelectedEvent;
exports.getFavoriteEventKey = getFavoriteEventKey;
exports.getFavoriteStoreForSelectedEvent = getFavoriteStoreForSelectedEvent;
exports.getFavoritePlayerKey = getFavoritePlayerKey;
exports.toggleFavoritePlayer = toggleFavoritePlayer;
exports.isFavoritePlayer = isFavoritePlayer;
exports.getFavoriteCountForSelectedEvent = getFavoriteCountForSelectedEvent;
exports.findCompetitorByName = findCompetitorByName;
exports.findCompetitorForPlayerRow = findCompetitorForPlayerRow;
exports.isPlayerActive = isPlayerActive;
exports.playerMatchesCurrentView = playerMatchesCurrentView;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const text_1 = require("../utils/text");
function createAppState() {
    return {
        playerList: [],
        filteredPlayerList: [],
        leaderboardMeta: null,
        scorecardSelectionTimeout: null,
        suppressSelectionEvents: false,
        playerJumpBuffer: '',
        playerJumpTimeout: null,
        detailViewOpen: false,
        playerViewMode: constants_1.PLAYER_VIEW_MODES[0],
        refreshTimer: null,
        isUpdatingLeaderboard: false,
        refreshRequestedWhileUpdating: false,
        currentRefreshIntervalMillis: constants_1.idleUpdateFrequencyMillis,
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
function clearScorecardCache(state) {
    Object.keys(state.scorecardCache).forEach((key) => {
        delete state.scorecardCache[key];
    });
}
function resetPlayerViewMode(state) {
    state.playerViewMode = constants_1.PLAYER_VIEW_MODES[0];
}
function setSelectedEvent(state, event) {
    state.selectedEvent = event;
}
function getFavoriteEventKey(state) {
    if (state.leaderboardMeta?.id) {
        return `${state.leaderboardMeta.id}`;
    }
    if (state.selectedEvent?.id) {
        return `${state.selectedEvent.id}`;
    }
    return '';
}
function getFavoriteStoreForSelectedEvent(state) {
    const eventKey = getFavoriteEventKey(state);
    if (!eventKey) {
        return null;
    }
    if (!state.favoritePlayersByEvent[eventKey]) {
        state.favoritePlayersByEvent[eventKey] = {};
    }
    return state.favoritePlayersByEvent[eventKey];
}
function getFavoritePlayerKey(playerRow) {
    const competitorId = `${lodash_1.default.get(playerRow, 'COMP_ID', '')}`.trim();
    if (competitorId) {
        return `id:${competitorId}`;
    }
    const playerName = (0, text_1.normalizeName)(lodash_1.default.get(playerRow, 'PLAYER', ''));
    return playerName ? `name:${playerName}` : '';
}
function toggleFavoritePlayer(state, playerRow) {
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
function isFavoritePlayer(state, playerRow) {
    const store = getFavoriteStoreForSelectedEvent(state);
    const playerKey = getFavoritePlayerKey(playerRow);
    return !!(store && playerKey && store[playerKey]);
}
function getFavoriteCountForSelectedEvent(state) {
    const store = getFavoriteStoreForSelectedEvent(state);
    return store ? Object.keys(store).length : 0;
}
function findCompetitorByName(state, playerName) {
    if (!state.leaderboardMeta?.competitorMap) {
        return null;
    }
    return state.leaderboardMeta.competitorMap[(0, text_1.normalizeName)(playerName)] || null;
}
function findCompetitorForPlayerRow(state, playerRow) {
    if (!playerRow || !state.leaderboardMeta) {
        return null;
    }
    const competitorId = `${lodash_1.default.get(playerRow, 'COMP_ID', '')}`.trim();
    if (competitorId && state.leaderboardMeta.competitorMapById?.[competitorId]) {
        return state.leaderboardMeta.competitorMapById[competitorId];
    }
    return findCompetitorByName(state, playerRow.PLAYER);
}
function isPlayerActive(state, playerRow) {
    const competitor = findCompetitorForPlayerRow(state, playerRow);
    const status = lodash_1.default.toLower(competitor?.status);
    if (status === 'in' || status === 'live') {
        return true;
    }
    const thru = `${lodash_1.default.get(playerRow, 'THRU', '')}`.trim();
    return /^\d+$/.test(thru);
}
function playerMatchesCurrentView(state, playerRow) {
    if (state.playerViewMode === 'active') {
        return isPlayerActive(state, playerRow);
    }
    if (state.playerViewMode === 'favorites') {
        return isFavoritePlayer(state, playerRow);
    }
    return true;
}
