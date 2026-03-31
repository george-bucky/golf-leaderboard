"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectorStatusLabel = selectorStatusLabel;
exports.buildTopInfoText = buildTopInfoText;
exports.formatPurse = formatPurse;
exports.buildVisiblePlayerRow = buildVisiblePlayerRow;
exports.getEmptyPlayerViewMessage = getEmptyPlayerViewMessage;
exports.getPlayerViewModeLabel = getPlayerViewModeLabel;
exports.buildPlayerViewText = buildPlayerViewText;
exports.buildTableData = buildTableData;
const lodash_1 = __importDefault(require("lodash"));
const text_1 = require("../utils/text");
function selectorStatusLabel(status) {
    const text = `${status || ''}`.toLowerCase();
    if (text === 'in' || text === 'live') {
        return 'LIVE';
    }
    if (text === 'pre') {
        return 'UP NEXT';
    }
    if (text === 'post') {
        return 'FINAL';
    }
    return (text || '--').toUpperCase();
}
function buildTopInfoText(meta, barWidth, viewText) {
    const eventName = meta.name || 'PGA Event';
    const roundText = meta.currentRound ? `Round ${meta.currentRound}` : 'Round --';
    const locationText = meta.location || 'Location unavailable';
    const purseText = formatPurse(meta.purse);
    const partsWithoutPurse = [eventName, roundText, locationText, viewText];
    const partsWithPurse = purseText ? partsWithoutPurse.concat([purseText]) : partsWithoutPurse;
    const maxChars = Math.max(24, barWidth - 4);
    let text = partsWithPurse.join('  |  ');
    if (text.length <= maxChars) {
        return text;
    }
    text = partsWithoutPurse.join('  |  ');
    if (text.length <= maxChars) {
        return text;
    }
    const compactLocation = meta.cityState || locationText;
    text = [eventName, roundText, compactLocation].join('  |  ');
    if (text.length <= maxChars) {
        return text;
    }
    return (0, text_1.truncateText)(text, maxChars);
}
function formatPurse(purseValue) {
    if (!purseValue) {
        return '';
    }
    if (typeof purseValue === 'string') {
        return `Purse ${purseValue}`;
    }
    if (typeof purseValue === 'number' && Number.isFinite(purseValue)) {
        return `Purse $${purseValue.toLocaleString('en-US')}`;
    }
    return '';
}
function buildVisiblePlayerRow(playerRow, isFavorite) {
    return {
        POS: lodash_1.default.get(playerRow, 'POS', '--'),
        FAV: isFavorite ? '*' : '',
        PLAYER: lodash_1.default.get(playerRow, 'PLAYER', '--'),
        SCORE: lodash_1.default.get(playerRow, 'SCORE', '--'),
        TODAY: lodash_1.default.get(playerRow, 'TODAY', '--'),
        THRU: lodash_1.default.get(playerRow, 'THRU', '--'),
        R1: lodash_1.default.get(playerRow, 'R1', '--'),
        R2: lodash_1.default.get(playerRow, 'R2', '--'),
        R3: lodash_1.default.get(playerRow, 'R3', '--'),
        R4: lodash_1.default.get(playerRow, 'R4', '--'),
        TOT: lodash_1.default.get(playerRow, 'TOT', '--')
    };
}
function getEmptyPlayerViewMessage(viewMode) {
    if (viewMode === 'active') {
        return 'No active players match this view.';
    }
    if (viewMode === 'favorites') {
        return 'No favorite players saved for this event.';
    }
    return 'No players match this filter.';
}
function getPlayerViewModeLabel(viewMode) {
    if (viewMode === 'active') {
        return 'Active';
    }
    if (viewMode === 'favorites') {
        return 'Favorites';
    }
    return 'All';
}
function buildPlayerViewText(viewMode, favoriteCount) {
    if (viewMode === 'favorites') {
        return `View: Favorites (${favoriteCount})`;
    }
    return `View: ${getPlayerViewModeLabel(viewMode)}`;
}
function buildTableData(rows) {
    const headers = Object.keys(rows[0] || {});
    return {
        headers,
        data: rows.map((row) => lodash_1.default.values(row))
    };
}
