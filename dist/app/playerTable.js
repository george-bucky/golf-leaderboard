"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterPlayers = filterPlayers;
exports.buildTableData = buildTableData;
exports.applyTableColumnWidths = applyTableColumnWidths;
exports.getSelectedPlayerName = getSelectedPlayerName;
exports.findPlayerIndexByPrefix = findPlayerIndexByPrefix;
exports.findPlayerIndexByName = findPlayerIndexByName;
const lodash_1 = __importDefault(require("lodash"));
const leaderboard_1 = require("../format/leaderboard");
const text_1 = require("../utils/text");
const store_1 = require("../state/store");
function filterPlayers(state, filterText) {
    return lodash_1.default.filter(state.playerList, (player) => {
        const nameMatches = !!(player &&
            player.PLAYER &&
            player.PLAYER.toUpperCase().indexOf((filterText || '').toUpperCase()) !== -1);
        if (!nameMatches) {
            return false;
        }
        return (0, store_1.playerMatchesCurrentView)(state, player);
    });
}
function buildTableData(state, players) {
    const visibleRows = lodash_1.default.map(players, (row) => (0, leaderboard_1.buildVisiblePlayerRow)(row, (0, store_1.isFavoritePlayer)(state, row)));
    const fallbackRow = state.playerList.length
        ? [(0, leaderboard_1.buildVisiblePlayerRow)(state.playerList[0], (0, store_1.isFavoritePlayer)(state, state.playerList[0]))]
        : [];
    const rowSource = visibleRows.length ? visibleRows : fallbackRow;
    return {
        headers: lodash_1.default.keys(rowSource[0] || {}),
        data: lodash_1.default.map(visibleRows, (row) => lodash_1.default.values(row))
    };
}
function applyTableColumnWidths(table, headers) {
    if (!Array.isArray(headers)) {
        return;
    }
    table.options.columnWidth = headers.map(() => 8);
    const favoriteColumnIndex = headers.indexOf('FAV');
    if (favoriteColumnIndex >= 0) {
        table.options.columnWidth[favoriteColumnIndex] = 3;
    }
    const playerColumnIndex = headers.indexOf('PLAYER');
    if (playerColumnIndex >= 0) {
        table.options.columnWidth[playerColumnIndex] = 24;
    }
}
function getSelectedPlayerName(players, selectedIndex) {
    return lodash_1.default.get(players[selectedIndex], 'PLAYER', '');
}
function findPlayerIndexByPrefix(players, normalizedPrefix, startIndex, endIndex) {
    for (let index = startIndex; index < endIndex; index += 1) {
        const playerName = lodash_1.default.get(players[index], 'PLAYER', '');
        if ((0, text_1.normalizeName)(playerName).indexOf(normalizedPrefix) === 0) {
            return index;
        }
    }
    return -1;
}
function findPlayerIndexByName(players, playerName) {
    if (!playerName) {
        return -1;
    }
    const normalizedName = (0, text_1.normalizeName)(playerName);
    for (let index = 0; index < players.length; index += 1) {
        const listName = lodash_1.default.get(players[index], 'PLAYER', '');
        if ((0, text_1.normalizeName)(listName) === normalizedName) {
            return index;
        }
    }
    return -1;
}
