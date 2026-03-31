import _ from 'lodash';
import { buildVisiblePlayerRow } from '../format/leaderboard';
import { AppState, PlayerRow } from '../types';
import { normalizeName } from '../utils/text';
import { isFavoritePlayer, playerMatchesCurrentView } from '../state/store';

export function filterPlayers(state: AppState, filterText: string): PlayerRow[] {
  return _.filter(state.playerList, (player) => {
    const nameMatches = !!(
      player &&
      player.PLAYER &&
      player.PLAYER.toUpperCase().indexOf((filterText || '').toUpperCase()) !== -1
    );
    if (!nameMatches) {
      return false;
    }
    return playerMatchesCurrentView(state, player);
  });
}

export function buildTableData(state: AppState, players: PlayerRow[]): { headers: string[]; data: string[][] } {
  const visibleRows = _.map(players, (row) => buildVisiblePlayerRow(row, isFavoritePlayer(state, row)));
  const fallbackRow = state.playerList.length
    ? [buildVisiblePlayerRow(state.playerList[0], isFavoritePlayer(state, state.playerList[0]))]
    : [];
  const rowSource = visibleRows.length ? visibleRows : fallbackRow;

  return {
    headers: _.keys(rowSource[0] || {}),
    data: _.map(visibleRows, (row) => _.values(row))
  };
}

export function applyTableColumnWidths(table: any, headers: string[]): void {
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

export function getSelectedPlayerName(players: PlayerRow[], selectedIndex: number): string {
  return _.get(players[selectedIndex], 'PLAYER', '');
}

export function findPlayerIndexByPrefix(players: PlayerRow[], normalizedPrefix: string, startIndex: number, endIndex: number): number {
  for (let index = startIndex; index < endIndex; index += 1) {
    const playerName = _.get(players[index], 'PLAYER', '');
    if (normalizeName(playerName).indexOf(normalizedPrefix) === 0) {
      return index;
    }
  }
  return -1;
}

export function findPlayerIndexByName(players: PlayerRow[], playerName: string): number {
  if (!playerName) {
    return -1;
  }
  const normalizedName = normalizeName(playerName);
  for (let index = 0; index < players.length; index += 1) {
    const listName = _.get(players[index], 'PLAYER', '');
    if (normalizeName(listName) === normalizedName) {
      return index;
    }
  }
  return -1;
}
