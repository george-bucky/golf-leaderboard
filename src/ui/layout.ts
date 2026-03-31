import blessed from 'blessed';
import contrib from 'blessed-contrib';
import path from 'node:path';
import { minimumScorecardPanelWidth, minimumScreenWidthWithScorecard } from '../config/constants';
import { AppState, Widgets } from '../types';

export function createLayout(callbacks: {
  onCloseDetail: () => void;
  onTableSelect: (index: number) => void;
  onTableAction: (index: number) => void;
  onTableKeypress: (ch: string, key: any) => void;
}): Widgets {
  const screen = blessed.screen({ smartCSR: true, log: path.resolve(__dirname, '..', '..', 'leaderboard.log') });
  const grid = new contrib.grid({ rows: 11, cols: 12, screen });

  const table = grid.set(1, 0, 9, 8, contrib.table, {
    keys: true,
    vi: true,
    mouse: true,
    fg: 'white',
    selectedFg: 'black',
    selectedBg: 'green',
    interactive: true,
    width: '100%',
    height: '100%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 3,
    columnWidth: Array.from({ length: 11 }, () => 8)
  });
  table.options.columnWidth[1] = 24;
  table.options.columnWidth[2] = 24;

  const topInfoBar = grid.set(0, 0, 1, 8, blessed.box, {
    tags: true,
    border: { type: 'line', fg: 'cyan' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    padding: { left: 1, right: 1 },
    content: 'Loading event info...'
  });

  const scorecardBox = grid.set(0, 8, 10, 4, blessed.box, {
    tags: true,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line', fg: 'yellow' },
    style: { fg: 'white', border: { fg: 'yellow' } },
    padding: { top: 1, left: 1, right: 1, bottom: 1 },
    label: ' Player Scorecard ',
    content: 'Select a player (arrow keys or mouse) to load scorecard.'
  });

  const eventSelectorBox = blessed.box({
    parent: screen,
    tags: true,
    mouse: true,
    keys: true,
    vi: true,
    hidden: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    padding: { top: 1, left: 1, right: 1, bottom: 1 },
    label: ' Live Golf Events ',
    content: 'Loading live events...'
  });

  const detailBox = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    bottom: 1,
    tags: true,
    mouse: true,
    keys: true,
    vi: true,
    hidden: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    padding: { top: 0, left: 0, right: 0, bottom: 0 },
    label: ' Player Detail '
  });

  const detailHeaderBox = blessed.box({
    parent: detailBox,
    top: 0,
    left: 1,
    right: 1,
    height: 5,
    tags: true,
    keys: true,
    vi: true,
    style: { fg: 'white' },
    content: ''
  });

  const detailContentBox = blessed.box({
    parent: detailBox,
    top: 5,
    left: 1,
    right: 1,
    bottom: 0,
    tags: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    style: { fg: 'white' },
    content: ''
  });

  detailBox.key(['l', 'L'], callbacks.onCloseDetail);
  detailHeaderBox.key(['l', 'L'], callbacks.onCloseDetail);
  detailContentBox.key(['l', 'L'], callbacks.onCloseDetail);

  const shortcutBar = grid.set(10, 0, 1, 12, blessed.box, {
    tags: true,
    border: { type: 'line', fg: 'gray' },
    style: { fg: 'white', border: { fg: 'gray' } },
    padding: { left: 1, right: 1 },
    content: ''
  });

  table.on('click', () => table.focus());
  eventSelectorBox.on('click', () => eventSelectorBox.focus());
  table.rows.on('select item', (_item: any, index: number) => callbacks.onTableSelect(index));
  table.rows.on('action', (_item: any, index: number) => callbacks.onTableAction(index));
  table.rows.on('keypress', (ch: string, key: any) => callbacks.onTableKeypress(ch, key));

  return { screen, grid, table, topInfoBar, scorecardBox, detailBox, detailHeaderBox, detailContentBox, shortcutBar, eventSelectorBox };
}

export function applyResponsiveLayout(widgets: Widgets, state: AppState): void {
  const totalWidth = Number(widgets.screen.width) || 120;
  const totalHeight = Number(widgets.screen.height) || 32;
  const topHeight = 3;
  const bottomHeight = 3;
  const mainHeight = Math.max(6, totalHeight - topHeight - bottomHeight);
  const canShowScorecard = totalWidth >= minimumScreenWidthWithScorecard;
  let scorecardWidth = canShowScorecard ? Math.floor(totalWidth / 3) : 0;
  if (canShowScorecard) {
    scorecardWidth = Math.max(minimumScorecardPanelWidth, scorecardWidth);
    scorecardWidth = Math.min(scorecardWidth, totalWidth - 30);
  }
  const showSelector = state.eventSelectorOpen && !state.detailViewOpen;
  const tableWidth = Math.max(30, totalWidth - scorecardWidth);
  state.scorecardCollapsed = !canShowScorecard || scorecardWidth < minimumScorecardPanelWidth;

  widgets.topInfoBar.top = 0;
  widgets.topInfoBar.left = 0;
  widgets.topInfoBar.width = showSelector ? totalWidth : tableWidth;
  widgets.topInfoBar.height = topHeight;
  widgets.table.top = topHeight;
  widgets.table.left = 0;
  widgets.table.width = tableWidth;
  widgets.table.height = mainHeight;
  widgets.eventSelectorBox.top = topHeight;
  widgets.eventSelectorBox.left = 0;
  widgets.eventSelectorBox.width = totalWidth;
  widgets.eventSelectorBox.height = mainHeight;
  widgets.scorecardBox.top = 0;
  widgets.scorecardBox.left = tableWidth;
  widgets.scorecardBox.width = scorecardWidth;
  widgets.scorecardBox.height = topHeight + mainHeight;
  widgets.shortcutBar.top = topHeight + mainHeight;
  widgets.shortcutBar.left = 0;
  widgets.shortcutBar.width = totalWidth;
  widgets.shortcutBar.height = bottomHeight;

  if (state.detailViewOpen) {
    widgets.topInfoBar.hide();
    widgets.table.hide();
    widgets.scorecardBox.hide();
    widgets.eventSelectorBox.hide();
  } else if (showSelector) {
    widgets.topInfoBar.show();
    widgets.table.hide();
    widgets.scorecardBox.hide();
    widgets.eventSelectorBox.show();
  } else {
    widgets.topInfoBar.show();
    widgets.eventSelectorBox.hide();
    widgets.table.show();
  }

  if (!showSelector && (state.scorecardCollapsed || state.detailViewOpen)) {
    widgets.scorecardBox.hide();
  } else if (!showSelector) {
    widgets.scorecardBox.show();
  }

  if (!showSelector && state.scorecardCollapsed) {
    widgets.scorecardBox.setContent('Scorecard hidden on narrow terminals. Widen window for side panel.');
  }
}
