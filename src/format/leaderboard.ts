import _ from 'lodash';
import { LeaderboardMeta, PlayerRow, ViewMode } from '../types';
import { truncateText } from '../utils/text';

export function selectorStatusLabel(status: string): string {
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

export function buildTopInfoText(meta: LeaderboardMeta, barWidth: number, viewText: string): string {
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

  return truncateText(text, maxChars);
}

export function formatPurse(purseValue: string | number): string {
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

export function buildVisiblePlayerRow(playerRow: PlayerRow, isFavorite: boolean): Record<string, string> {
  return {
    POS: _.get(playerRow, 'POS', '--'),
    FAV: isFavorite ? '*' : '',
    PLAYER: _.get(playerRow, 'PLAYER', '--'),
    SCORE: _.get(playerRow, 'SCORE', '--'),
    TODAY: _.get(playerRow, 'TODAY', '--'),
    THRU: _.get(playerRow, 'THRU', '--'),
    R1: _.get(playerRow, 'R1', '--'),
    R2: _.get(playerRow, 'R2', '--'),
    R3: _.get(playerRow, 'R3', '--'),
    R4: _.get(playerRow, 'R4', '--'),
    TOT: _.get(playerRow, 'TOT', '--')
  };
}

export function getEmptyPlayerViewMessage(viewMode: ViewMode): string {
  if (viewMode === 'active') {
    return 'No active players match this view.';
  }
  if (viewMode === 'favorites') {
    return 'No favorite players saved for this event.';
  }
  return 'No players match this filter.';
}

export function getPlayerViewModeLabel(viewMode: ViewMode): string {
  if (viewMode === 'active') {
    return 'Active';
  }
  if (viewMode === 'favorites') {
    return 'Favorites';
  }
  return 'All';
}

export function buildPlayerViewText(viewMode: ViewMode, favoriteCount: number): string {
  if (viewMode === 'favorites') {
    return `View: Favorites (${favoriteCount})`;
  }
  return `View: ${getPlayerViewModeLabel(viewMode)}`;
}

export function buildTableData(rows: Record<string, string>[]): { headers: string[]; data: string[][] } {
  const headers = Object.keys(rows[0] || {});
  return {
    headers,
    data: rows.map((row) => _.values(row))
  };
}
