'use strict';

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const https = require('https');
const _ = require('lodash');
const scraper = require('table-scraper');

const url = 'https://www.espn.com/golf/leaderboard';
const siteApiBase = 'https://site.web.api.espn.com/apis/site/v2/sports/golf';
const liveUpdateFrequencyMins = 1;
const idleUpdateFrequencyMins = 10;
const liveUpdateFrequencyMillis = liveUpdateFrequencyMins * 60 * 1000;
const idleUpdateFrequencyMillis = idleUpdateFrequencyMins * 60 * 1000;
const SCORE_STYLES = {
  eagle: { fg: 'black', bg: 'yellow', label: 'EAGLE' },
  birdie: { fg: 'black', bg: 'green', label: 'BIRDIE' },
  bogey: { fg: 'white', bg: 'red', label: 'BOGEY' },
  dblBogey: { fg: 'white', bg: 'blue', label: 'DBL+' }
};
const SCORECARD_LABEL_WIDTH = 4;
const SCORECARD_CELL_WIDTH = 4;
const STATS_LABEL_WIDTH = 30;
const STATS_VALUE_WIDTH = 12;
const PRIMARY_STAT_ORDER = [
  'scoreToPar',
  'regScore',
  'driveDistAvg',
  'driveAccuracyPct',
  'gir',
  'puttsGirAvg',
  'eagles',
  'birdies',
  'pars',
  'bogeys',
  'dBogeyPlus'
];
const STAT_LABEL_OVERRIDES = {
  scoreToPar: 'Score To Par',
  regScore: 'Total',
  driveDistAvg: 'Driving Distance',
  driveAccuracyPct: 'Driving Accuracy %',
  gir: 'GIR',
  puttsGirAvg: 'Putts per GIR',
  eagles: 'Eagles',
  birdies: 'Birdies',
  pars: 'Pars',
  bogeys: 'Bogeys',
  dBogey: 'Double Bogeys',
  dBogeyPlus: 'DBL+',
  tournamentsPlayed: 'Tournaments Played',
  startScore: 'Starting Score',
  girPoss: 'Possible GIR',
  sandSavesPct: 'Sand Save %',
  sandSavesPoss: 'Possible Sand Saves',
  penalties: 'Penalties',
  officialMoney: 'Official Money Won',
  cutsMade: 'Cuts Made',
  consecutiveCutsMade: 'Consecutive Cuts',
  officialEarnings: 'Official Earnings',
  adjustedScoringAvg: 'Adjusted Scoring Avg',
  adjustment: 'Adjustment',
  fedExCupPoints: 'FedExCup Points'
};

let screen;
let grid;
let table;
let topInfoBar;
let scorecardBox;
let detailBox;
let detailHeaderBox;
let detailContentBox;
let shortcutBar;
let playerList = [];
let filteredPlayerList = [];
let leaderboardMeta = null;
let scorecardSelectionTimeout = null;
let suppressSelectionEvents = false;
let playerJumpBuffer = '';
let playerJumpTimeout = null;
let detailViewOpen = false;
let showActiveOnly = false;
let refreshTimer = null;
let isUpdatingLeaderboard = false;
let refreshRequestedWhileUpdating = false;
let currentRefreshIntervalMillis = idleUpdateFrequencyMillis;
const scorecardCache = {};
const playerJumpResetMillis = 1200;
init();

function init() {
  screen = blessed.screen({ smartCSR: true, log: `${__dirname}/leaderboard.log` });
  grid = new contrib.grid({ rows: 11, cols: 12, screen: screen });

  // ctrl-c quits, esc jumps to top of leaderboard.
  screen.key(['C-c'], () => process.exit(0));
  screen.key(['escape'], () => {
    if (detailViewOpen) {
      closeDetailView();
    }
    jumpToTopLeaderboard();
  });
  screen.key(['r', 'R'], () => {
    requestLeaderboardUpdate();
  });
  screen.key(['/'], () => {
    if (detailViewOpen) {
      return;
    }
    toggleActiveOnlyFilter();
  });

  createLayout();
  screen.on('resize', () => {
    updateTopInfoBar();
  });
  requestLeaderboardUpdate();
}

function createLayout() {
  table = grid.set(1, 0, 9, 8, contrib.table, {
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
    columnWidth: _.map(_.range(0, 11), (el) => 8)
  });

  // column widths are still static for this table widget
  table.options.columnWidth[1] = 24; // player column (post-tournament)
  table.options.columnWidth[2] = 24; // player column (live tournament)

  topInfoBar = grid.set(0, 0, 1, 8, blessed.box, {
    tags: true,
    border: { type: 'line', fg: 'cyan' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    padding: { left: 1, right: 1 },
    content: 'Loading event info...'
  });

  scorecardBox = grid.set(0, 8, 10, 4, blessed.box, {
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

  detailBox = blessed.box({
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
    border: { type: 'line', fg: 'cyan' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    padding: { top: 0, left: 0, right: 0, bottom: 0 },
    label: ' Player Detail '
  });

  detailHeaderBox = blessed.box({
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

  detailContentBox = blessed.box({
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

  detailBox.key(['l', 'L'], () => closeDetailView());
  detailHeaderBox.key(['l', 'L'], () => closeDetailView());
  detailContentBox.key(['l', 'L'], () => closeDetailView());

  shortcutBar = grid.set(10, 0, 1, 12, blessed.box, {
    tags: true,
    border: { type: 'line', fg: 'gray' },
    style: { fg: 'white', border: { fg: 'gray' } },
    padding: { left: 1, right: 1 },
    content: ''
  });

  table.on('click', () => table.focus());

  // Preview scorecards shortly after selection changes.
  table.rows.on('select item', (item, index) => {
    if (suppressSelectionEvents) {
      return;
    }
    scheduleScorecardLoad(index);
  });

  // Enter opens full screen detail for selected player.
  table.rows.on('action', (item, index) => {
    if (scorecardSelectionTimeout) {
      clearTimeout(scorecardSelectionTimeout);
      scorecardSelectionTimeout = null;
    }
    openDetailView(index);
  });

  // Type-to-jump search when leaderboard table is focused.
  table.rows.on('keypress', (ch, key) => handlePlayerJumpKeypress(ch, key));

  updateShortcutBar();
  table.focus();
  screen.render();
}

function updateLeaderboard() {
  isUpdatingLeaderboard = true;
  Promise.all([
    scraper.get(url),
    fetchLeaderboardMeta()
  ])
  .then((response) => {
    const scrapedTables = response[0] || [];
    leaderboardMeta = response[1];
    currentRefreshIntervalMillis = getRefreshIntervalMillis(leaderboardMeta);
    const now = new Date();
    playerList = scrapedTables[0] || []; // assumes leaderboard is first table on page

    const refreshFrequencyMins = Math.round(currentRefreshIntervalMillis / 60000);
    const liveStatusText = leaderboardMeta && leaderboardMeta.isLive ? 'live' : 'not live';
    table.setLabel({
      text: `Last updated: ${now.getHours()}:${now.getMinutes() < 10 ? 0 : ''}${now.getMinutes()} (${liveStatusText}, refresh ${refreshFrequencyMins}m)`,
      side: 'right'
    });
    updateTopInfoBar();

    refilter('');
  })
  .catch(() => {
    currentRefreshIntervalMillis = idleUpdateFrequencyMillis;
    scorecardBox.setContent('Unable to refresh leaderboard right now.');
    if (topInfoBar) {
      topInfoBar.setContent('Unable to load event info.');
    }
    screen.render();
  })
  .finally(() => {
    isUpdatingLeaderboard = false;
    if (refreshRequestedWhileUpdating) {
      refreshRequestedWhileUpdating = false;
      requestLeaderboardUpdate();
      return;
    }
    scheduleNextRefresh();
  });
}

function requestLeaderboardUpdate() {
  if (isUpdatingLeaderboard) {
    refreshRequestedWhileUpdating = true;
    return;
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  updateLeaderboard();
}

function scheduleNextRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    requestLeaderboardUpdate();
  }, currentRefreshIntervalMillis);
}

function getRefreshIntervalMillis(meta) {
  return meta && meta.isLive ? liveUpdateFrequencyMillis : idleUpdateFrequencyMillis;
}

function refilter(filterText) {
  filteredPlayerList = _.filter(playerList, (p) => {
    // filter out placeholder rows (ex: cut line)
    const nameMatches = !!(
      p &&
      p.PLAYER &&
      p.PLAYER.toUpperCase().indexOf((filterText || '').toUpperCase()) !== -1
    );
    if (!nameMatches) {
      return false;
    }
    if (!showActiveOnly) {
      return true;
    }
    return isPlayerActive(p);
  });

  const tableData = _.map(filteredPlayerList, (p) => {
    const row = _.omit(p, ['CTRY']); // country is not shown
    return _.values(row);
  });

  const header = _.keys(_.omit(filteredPlayerList[0] || {}, ['CTRY']));
  suppressSelectionEvents = true;
  table.setData({ data: tableData, headers: header });
  suppressSelectionEvents = false;

  if (filteredPlayerList.length) {
    scheduleScorecardLoad(0);
  } else {
    scorecardBox.setContent(showActiveOnly
      ? 'No active players match this filter.'
      : 'No players match this filter.');
  }

  screen.render();
}

function scheduleScorecardLoad(index) {
  if (scorecardSelectionTimeout) {
    clearTimeout(scorecardSelectionTimeout);
  }
  scorecardSelectionTimeout = setTimeout(() => showScorecard(index), 200);
}

function jumpToTopLeaderboard() {
  if (!filteredPlayerList.length) {
    return;
  }

  if (scorecardSelectionTimeout) {
    clearTimeout(scorecardSelectionTimeout);
    scorecardSelectionTimeout = null;
  }

  table.rows.select(0);
  table.focus();
  scheduleScorecardLoad(0);
  screen.render();
}

function handlePlayerJumpKeypress(ch, key) {
  if (!filteredPlayerList.length || screen.focused !== table.rows) {
    return;
  }

  if (key && (key.name === 'backspace' || key.name === 'delete')) {
    playerJumpBuffer = playerJumpBuffer.slice(0, -1);
    jumpToPlayerByPrefix(playerJumpBuffer);
    resetPlayerJumpTimer();
    return;
  }

  // Only capture normal typing characters.
  if (!ch || !/^[a-zA-Z '\.-]$/.test(ch)) {
    return;
  }

  playerJumpBuffer += ch;
  jumpToPlayerByPrefix(playerJumpBuffer);
  resetPlayerJumpTimer();
}

function resetPlayerJumpTimer() {
  if (playerJumpTimeout) {
    clearTimeout(playerJumpTimeout);
  }
  playerJumpTimeout = setTimeout(() => {
    playerJumpBuffer = '';
    playerJumpTimeout = null;
  }, playerJumpResetMillis);
}

function jumpToPlayerByPrefix(prefix) {
  if (!prefix) {
    return;
  }

  const normalizedPrefix = normalizeName(prefix);
  const currentIndex = table.rows.selected || 0;

  // Start search after current row, then wrap to top.
  let targetIndex = findPlayerIndexByPrefix(normalizedPrefix, currentIndex + 1, filteredPlayerList.length);
  if (targetIndex === -1) {
    targetIndex = findPlayerIndexByPrefix(normalizedPrefix, 0, currentIndex + 1);
  }

  if (targetIndex === -1) {
    return;
  }

  table.rows.select(targetIndex);
  scheduleScorecardLoad(targetIndex);
  screen.render();
}

function findPlayerIndexByPrefix(normalizedPrefix, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const playerName = _.get(filteredPlayerList[index], 'PLAYER', '');
    if (normalizeName(playerName).indexOf(normalizedPrefix) === 0) {
      return index;
    }
  }
  return -1;
}

function showScorecard(index) {
  const selected = filteredPlayerList[index];
  if (!selected || !selected.PLAYER) {
    return;
  }

  const competitor = findCompetitorByName(selected.PLAYER);
  if (!competitor || !competitor.id || !leaderboardMeta) {
    scorecardBox.setContent(`No scorecard data found for ${selected.PLAYER}.`);
    screen.render();
    return;
  }

  const cacheKey = `${leaderboardMeta.id}:${competitor.id}`;

  if (scorecardCache[cacheKey]) {
    scorecardBox.setContent(formatCompactScorecard(selected, scorecardCache[cacheKey]));
    screen.render();
    return;
  }

  scorecardBox.setContent(`Loading ${selected.PLAYER} scorecard...`);
  screen.render();

  fetchCompetitorSummary(leaderboardMeta.tour, leaderboardMeta.id, competitor.id)
    .then((summary) => {
      scorecardCache[cacheKey] = summary;
      scorecardBox.setContent(formatCompactScorecard(selected, summary));
      screen.render();
    })
    .catch(() => {
      scorecardBox.setContent(`Unable to load scorecard for ${selected.PLAYER}.`);
      screen.render();
    });
}

function openDetailView(index) {
  const selected = filteredPlayerList[index];
  if (!selected || !selected.PLAYER) {
    return;
  }

  const competitor = findCompetitorByName(selected.PLAYER);
  if (!competitor || !competitor.id || !leaderboardMeta) {
    showDetailContent({
      header: buildDetailHeader(selected),
      body: `No detail data found for ${selected.PLAYER}.`
    });
    return;
  }

  const cacheKey = `${leaderboardMeta.id}:${competitor.id}`;
  showDetailContent({
    header: buildDetailHeader(selected),
    body: `Loading full detail for ${selected.PLAYER}...`
  });

  if (scorecardCache[cacheKey]) {
    showDetailContent(formatFullScreenDetail(selected, scorecardCache[cacheKey]));
    return;
  }

  fetchCompetitorSummary(leaderboardMeta.tour, leaderboardMeta.id, competitor.id)
    .then((summary) => {
      scorecardCache[cacheKey] = summary;
      showDetailContent(formatFullScreenDetail(selected, summary));
    })
    .catch(() => {
      showDetailContent({
        header: buildDetailHeader(selected),
        body: `Unable to load full detail for ${selected.PLAYER}.`
      });
    });
}

function showDetailContent(content) {
  openDetailOverlay();
  const payload = _.isObject(content) ? content : { header: '', body: `${content}` };
  detailHeaderBox.setContent(payload.header || '');
  detailContentBox.setContent(payload.body || '');
  detailContentBox.setScroll(0);
  screen.render();
}

function openDetailOverlay() {
  if (detailViewOpen) {
    return;
  }
  detailViewOpen = true;
  topInfoBar.hide();
  table.hide();
  scorecardBox.hide();
  detailBox.show();
  updateShortcutBar();
  detailContentBox.focus();
}

function closeDetailView() {
  if (!detailViewOpen) {
    return;
  }
  detailViewOpen = false;
  detailBox.hide();
  topInfoBar.show();
  table.show();
  scorecardBox.show();
  updateShortcutBar();
  table.focus();
  screen.render();
}

function updateShortcutBar() {
  if (!shortcutBar) {
    return;
  }

  const activeState = showActiveOnly ? 'ON' : 'OFF';
  const mainShortcuts = `{bold}Esc{/bold}:Top  {bold}R{/bold}:Refresh  {bold}/{/bold}:Active ${activeState}  {bold}Enter{/bold}:Player Detail  {bold}A-Z{/bold}:Jump Search  {bold}C-c{/bold}:Quit`;
  const detailShortcuts = '{bold}L{/bold}:Back to Leaderboard  {bold}Esc{/bold}:Back + Top  {bold}C-c{/bold}:Quit';

  shortcutBar.setContent(detailViewOpen ? detailShortcuts : mainShortcuts);
}

function toggleActiveOnlyFilter() {
  showActiveOnly = !showActiveOnly;
  updateShortcutBar();
  refilter('');
}

function formatCompactScorecard(player, summary) {
  const rounds = _.sortBy(summary.rounds || [], (round) => round.period);
  const lines = [];

  lines.push(`${player.PLAYER}`);
  lines.push(`POS: ${player.POS || '--'}   SCORE: ${player.SCORE || '--'}   THRU: ${player.THRU || '--'}`);
  lines.push('');

  if (!rounds.length) {
    lines.push('No round-by-round scorecard available yet.');
    return lines.join('\n');
  }

  const currentRound = getCurrentRound(rounds);
  lines.push('{bold}Current Round{/bold}');
  lines.push(formatRoundHeader(currentRound));
  lines.push(...buildRoundRows(currentRound, { singleRow: false }));
  lines.push('');

  lines.push(buildLegendLine());
  lines.push('');
  lines.push('{gray-fg}Press Enter for full-screen rounds + event stats{/gray-fg}');
  return lines.join('\n');
}

function formatDetailedScorecard(summary, layout) {
  const detailLayout = layout || {};
  const useSingleRow = !!detailLayout.singleRowScorecard;
  const roundDividerWidth = Math.min(Math.max(52, detailLayout.renderWidth || 52), 120);
  const rounds = _.sortBy(summary.rounds || [], (round) => round.period);
  const lines = [];

  lines.push('{bold}All Rounds{/bold}');

  if (!rounds.length) {
    lines.push('No round-by-round scorecard available yet.');
  } else {
    _.forEach(rounds, (round) => {
      lines.push(buildDivider(roundDividerWidth));
      lines.push(formatRoundHeader(round));
      lines.push(...buildRoundRows(round, { singleRow: useSingleRow }));
      lines.push('');
    });
  }

  lines.push(buildLegendLine());
  lines.push('');
  lines.push('{bold}Event Stats{/bold}');
  lines.push(...buildStatsRows(summary.stats || []));
  return lines.join('\n');
}

function formatFullScreenDetail(player, summary) {
  const renderWidth = getDetailRenderWidth();
  const singleRowScorecard = shouldUseSingleRowDetailScorecard(renderWidth);
  return {
    header: buildDetailHeader(player, renderWidth),
    body: formatDetailedScorecard(summary, {
      singleRowScorecard: singleRowScorecard,
      renderWidth: renderWidth
    })
  };
}

function buildDetailHeader(player, renderWidth) {
  const dividerWidth = Math.min(Math.max(60, renderWidth || 80), 120);
  const lines = [];
  lines.push('{bold}Player Event Detail{/bold}   {gray-fg}Press L to return to leaderboard{/gray-fg}');
  lines.push(buildDivider(dividerWidth));
  lines.push(`${player.PLAYER}`);
  lines.push(`POS: ${player.POS || '--'}   SCORE: ${player.SCORE || '--'}   THRU: ${player.THRU || '--'}`);
  lines.push(buildDivider(dividerWidth));
  return lines.join('\n');
}

function holeScore(linescore) {
  return linescore && linescore.displayValue ? linescore.displayValue : '--';
}

function holePar(linescore) {
  if (!linescore || linescore.par == null) {
    return '--';
  }
  return `${linescore.par}`;
}

function getCurrentRound(rounds) {
  const withScores = _.filter(rounds, (round) => (round.linescores || []).length > 0);
  if (withScores.length) {
    return _.last(withScores);
  }
  return _.last(rounds);
}

function formatRoundHeader(round) {
  return `{bold}Round ${round.period}{/bold}  Score: ${round.displayValue || '--'}  Out: ${round.outScore || '--'}  In: ${round.inScore || '--'}`;
}

function buildRoundRows(round, options) {
  if (options && options.singleRow) {
    return buildRoundRowsSingleLine(round);
  }
  return buildRoundRowsSplit(round);
}

function buildRoundRowsSingleLine(round) {
  const rows = [];
  const linescoresByHole = buildLinescoresByHole(round.linescores || []);
  const holes = _.range(1, 19);

  const pars = _.map(holes, (hole) => holePar(linescoresByHole[hole]));
  const scores = _.map(holes, (hole) => holeScore(linescoresByHole[hole]));

  const parOut = sumPars(pars.slice(0, 9));
  const parIn = sumPars(pars.slice(9));
  const parTot = sumPars([parOut, parIn]);

  rows.push(buildTextRow('HOLE', holes.concat(['OUT', 'IN', 'TOT'])));
  rows.push(buildTextRow('PAR', pars.concat([parOut, parIn, parTot])));
  rows.push(buildScoreRow(
    'SCR',
    holes.map((hole) => linescoresByHole[hole]).concat([null, null, null]),
    scores.concat([round.outScore || '--', round.inScore || '--', round.displayValue || '--'])
  ));
  return rows;
}

function buildRoundRowsSplit(round) {
  const rows = [];
  const linescoresByHole = buildLinescoresByHole(round.linescores || []);
  const frontHoles = _.range(1, 10);
  const backHoles = _.range(10, 19);

  const frontPars = _.map(frontHoles, (hole) => holePar(linescoresByHole[hole]));
  const backPars = _.map(backHoles, (hole) => holePar(linescoresByHole[hole]));
  const frontScores = _.map(frontHoles, (hole) => holeScore(linescoresByHole[hole]));
  const backScores = _.map(backHoles, (hole) => holeScore(linescoresByHole[hole]));

  const parOut = sumPars(frontPars);
  const parIn = sumPars(backPars);
  const parTot = sumPars([parOut, parIn]);

  rows.push(buildTextRow('HOLE', frontHoles.concat(['OUT'])));
  rows.push(buildTextRow('PAR', frontPars.concat([parOut])));
  rows.push(buildScoreRow('SCR', frontHoles.map((hole) => linescoresByHole[hole]).concat([null]), frontScores.concat([round.outScore || '--'])));
  rows.push('');
  rows.push(buildTextRow('HOLE', backHoles.concat(['IN', 'TOT'])));
  rows.push(buildTextRow('PAR', backPars.concat([parIn, parTot])));
  rows.push(buildScoreRow('SCR', backHoles.map((hole) => linescoresByHole[hole]).concat([null, null]), backScores.concat([round.inScore || '--', round.displayValue || '--'])));
  return rows;
}

function buildLinescoresByHole(linescores) {
  const byHole = {};

  _.forEach(linescores, (linescore) => {
    const hole = normalizeHoleFromPeriod(linescore && linescore.period);
    if (!hole) {
      return;
    }

    const current = byHole[hole];
    if (!current) {
      byHole[hole] = linescore;
      return;
    }

    // Prefer direct 1-18 periods over wrapped 19+ if both exist.
    const currentPeriod = parseInt(current.period, 10);
    const nextPeriod = parseInt(linescore.period, 10);
    const currentIsWrapped = Number.isInteger(currentPeriod) && currentPeriod > 18;
    const nextIsDirect = Number.isInteger(nextPeriod) && nextPeriod <= 18;
    if (currentIsWrapped && nextIsDirect) {
      byHole[hole] = linescore;
    }
  });

  return byHole;
}

function normalizeHoleFromPeriod(period) {
  const numericPeriod = parseInt(period, 10);
  if (!Number.isInteger(numericPeriod) || numericPeriod < 1) {
    return null;
  }
  return ((numericPeriod - 1) % 18) + 1;
}

function shouldUseSingleRowDetailScorecard(renderWidth) {
  const width = renderWidth || getDetailRenderWidth();
  const minSingleRowWidth = SCORECARD_LABEL_WIDTH + (21 * SCORECARD_CELL_WIDTH);
  return width >= minSingleRowWidth;
}

function getDetailRenderWidth() {
  const width = screen && typeof screen.width === 'number' ? screen.width : 120;
  return Math.max(40, width - 6);
}

function buildStatsRows(stats) {
  if (!stats.length) {
    return ['No event stats available yet.'];
  }

  const statByName = _.keyBy(stats, 'name');
  const lines = [];

  const keyStats = _.compact(_.map(PRIMARY_STAT_ORDER, (name) => {
    const stat = statByName[name];
    return stat ? buildStatEntry(stat) : null;
  }));

  if (keyStats.length) {
    lines.push(...buildStatsTable('Key Stats', keyStats));
  }

  const primarySet = _.keyBy(PRIMARY_STAT_ORDER, _.identity);
  const additionalStats = _.chain(stats)
    .filter((stat) => !primarySet[stat.name])
    .map(buildStatEntry)
    .filter((entry) => isMeaningfulStatValue(entry.value))
    .value();

  if (additionalStats.length) {
    lines.push('');
    lines.push(...buildStatsTable('Additional Stats', additionalStats));
  }

  return lines;
}

function sumPars(parValues) {
  const parsed = _.map(parValues, (value) => parseInt(value, 10));
  const valid = _.filter(parsed, (value) => !Number.isNaN(value));
  if (!valid.length) {
    return '--';
  }
  return `${_.sum(valid)}`;
}

function buildTextRow(label, values) {
  return `${formatLabelCell(label)}${_.map(values, (value) => padCell(value, SCORECARD_CELL_WIDTH, 'right')).join('')}`;
}

function buildScoreRow(label, linescores, scoreValues) {
  let row = `${formatLabelCell(label)}`;
  _.forEach(scoreValues, (scoreValue, index) => {
    const lineScore = linescores[index];
    const styleKey = scoreStyleKey(lineScore);
    const text = padCell(scoreValue, SCORECARD_CELL_WIDTH, 'right');
    row += scoreCellWithStyle(text, styleKey);
  });
  return row;
}

function padCell(value, width, align) {
  const text = `${value == null ? '--' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const pad = ' '.repeat(width - text.length);
  return align === 'left' ? `${text}${pad}` : `${pad}${text}`;
}

function scoreStyleKey(linescore) {
  if (!linescore) {
    return null;
  }

  const holeScoreValue = parseInt(linescore.value, 10);
  const holeParValue = parseInt(linescore.par, 10);
  if (!Number.isNaN(holeScoreValue) && !Number.isNaN(holeParValue)) {
    const diff = holeScoreValue - holeParValue;
    if (diff <= -2) return 'eagle';
    if (diff === -1) return 'birdie';
    if (diff === 1) return 'bogey';
    if (diff >= 2) return 'dblBogey';
  }

  const scoreTypeName = _.toUpper(_.get(linescore, 'scoreType.name', ''));
  if (scoreTypeName.indexOf('EAGLE') !== -1) return 'eagle';
  if (scoreTypeName.indexOf('BIRDIE') !== -1) return 'birdie';
  if (scoreTypeName.indexOf('DOUBLE') !== -1 || scoreTypeName.indexOf('TRIPLE') !== -1 || scoreTypeName.indexOf('QUADRUPLE') !== -1) return 'dblBogey';
  if (scoreTypeName.indexOf('BOGEY') !== -1) return 'bogey';

  return null;
}

function scoreCellWithStyle(cellText, styleKey) {
  if (!styleKey || !SCORE_STYLES[styleKey]) {
    return cellText;
  }
  const style = SCORE_STYLES[styleKey];
  return `{${style.fg}-fg}{${style.bg}-bg}${cellText}{/}`;
}

function buildLegendLine() {
  const eagle = SCORE_STYLES.eagle;
  const birdie = SCORE_STYLES.birdie;
  const bogey = SCORE_STYLES.bogey;
  const dblBogey = SCORE_STYLES.dblBogey;
  const legendItem = (style) => `{${style.fg}-fg}{${style.bg}-bg}  {/} ${style.label}`;
  return `{bold}Legend:{/bold} ${legendItem(eagle)}  ${legendItem(birdie)}  ${legendItem(bogey)}  ${legendItem(dblBogey)}`;
}

function buildDivider(length) {
  return '-'.repeat(length);
}

function formatLabelCell(label) {
  return `{bold}${padCell(label, SCORECARD_LABEL_WIDTH, 'left')}{/bold}`;
}

function padEnd(value, width) {
  const text = `${value == null ? '' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${text}${' '.repeat(width - text.length)}`;
}

function padStart(value, width) {
  const text = `${value == null ? '' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${' '.repeat(width - text.length)}${text}`;
}

function buildStatEntry(stat) {
  return {
    name: stat.name || 'stat',
    label: STAT_LABEL_OVERRIDES[stat.name] || stat.displayName || stat.name || 'Stat',
    value: stat.displayValue == null || stat.displayValue === '' ? '--' : `${stat.displayValue}`
  };
}

function buildStatsTable(title, entries) {
  const lines = [];
  const border = `+${'-'.repeat(STATS_LABEL_WIDTH + 2)}+${'-'.repeat(STATS_VALUE_WIDTH + 2)}+`;

  lines.push(`{bold}${title}{/bold}`);
  lines.push(border);
  lines.push(`| ${padEnd('Stat', STATS_LABEL_WIDTH)} | ${padEnd('Value', STATS_VALUE_WIDTH)} |`);
  lines.push(border);

  _.forEach(entries, (entry) => {
    lines.push(`| ${padEnd(entry.label, STATS_LABEL_WIDTH)} | {bold}${padStart(entry.value, STATS_VALUE_WIDTH)}{/bold} |`);
  });

  lines.push(border);
  return lines;
}

function isMeaningfulStatValue(value) {
  const text = `${value == null ? '' : value}`.trim();
  if (!text || text === '--') {
    return false;
  }

  // Hide mostly-noise rows in additional stats.
  if (text === '0' || text === '0.0' || text === '0.00' || text === '$0') {
    return false;
  }

  return true;
}

function findCompetitorByName(playerName) {
  if (!leaderboardMeta || !leaderboardMeta.competitorMap) {
    return null;
  }
  return leaderboardMeta.competitorMap[normalizeName(playerName)] || null;
}

function updateTopInfoBar() {
  if (!topInfoBar) {
    return;
  }
  if (!leaderboardMeta) {
    topInfoBar.setContent('Loading event info...');
    return;
  }
  const width = topInfoBar.width && Number(topInfoBar.width) > 0 ? Number(topInfoBar.width) : 80;
  topInfoBar.setContent(buildTopInfoText(leaderboardMeta, width));
}

function buildTopInfoText(meta, barWidth) {
  const eventName = meta.name || 'PGA Event';
  const roundText = meta.currentRound ? `Round ${meta.currentRound}` : 'Round --';
  const locationText = meta.location || 'Location unavailable';
  const purseText = meta.purse ? `Purse ${meta.purse}` : '';

  const partsWithoutPurse = [eventName, roundText, locationText];
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

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 3) {
    return text.slice(0, maxChars);
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

function isPlayerActive(playerRow) {
  const competitor = findCompetitorByName(playerRow && playerRow.PLAYER);
  const status = _.toLower(competitor && competitor.status);
  if (status === 'in' || status === 'live') {
    return true;
  }

  const thru = `${_.get(playerRow, 'THRU', '')}`.trim();
  if (/^\d+$/.test(thru)) {
    return true;
  }

  return false;
}

function normalizeName(name) {
  return (name || '')
    .toUpperCase()
    .replace(/\(A\)/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchLeaderboardMeta() {
  return fetchText(url)
    .then((html) => {
      const match = html.match(/window\['__espnfitt__'\]=([\s\S]*?);<\/script>/);
      if (!match || !match[1]) {
        return null;
      }

      const payload = JSON.parse(match[1]);
      const leaderboard = _.get(payload, 'page.content.leaderboard');
      if (!leaderboard) {
        return null;
      }
      const courses = leaderboard.courses || {};
      const hostCourse = _.find(_.values(courses), (course) => course && course.host) || _.first(_.values(courses));
      const city = _.get(hostCourse, 'addy.city', '');
      const state = _.get(hostCourse, 'addy.state', '');
      const country = _.get(hostCourse, 'addy.country', '');
      const cityState = [city, state].filter(Boolean).join(', ');
      const location = cityState || [city, country].filter(Boolean).join(', ') || _.get(hostCourse, 'nm', '');
      const purse = _.get(leaderboard, 'hdr.event.displayPurse', '');

      const competitors = leaderboard.competitors || [];
      const competitorMap = _.reduce(competitors, (memo, competitor) => {
        memo[normalizeName(competitor.name)] = competitor;
        return memo;
      }, {});

      return {
        id: leaderboard.id,
        tour: leaderboard.tour || 'pga',
        name: leaderboard.name || _.get(leaderboard, 'hdr.event.name', ''),
        currentRound: leaderboard.currentRound,
        location: location,
        cityState: cityState,
        purse: purse,
        isLive: isLeaderboardLive(leaderboard),
        competitorMap: competitorMap
      };
    })
    .catch(() => null);
}

function isLeaderboardLive(leaderboard) {
  const status = `${leaderboard.status || ''}`.toLowerCase();
  const roundStatus = `${leaderboard.roundStatus || ''}`.toLowerCase();
  const roundStatusDetail = `${leaderboard.roundStatusDetail || ''}`.toLowerCase();

  if (status === 'in' || status === 'live') {
    return true;
  }
  if (roundStatus === 'in' || roundStatus === 'live' || roundStatus === 'progress') {
    return true;
  }
  if (roundStatusDetail.indexOf('in progress') !== -1 || roundStatusDetail.indexOf('live') !== -1) {
    return true;
  }
  return false;
}

function fetchCompetitorSummary(tour, eventId, competitorId) {
  const summaryUrl = `${siteApiBase}/${encodeURIComponent(tour)}/leaderboard/${encodeURIComponent(eventId)}/competitorsummary/${encodeURIComponent(competitorId)}?region=us&lang=en`;
  return fetchJson(summaryUrl);
}

function fetchJson(sourceUrl) {
  return fetchText(sourceUrl).then((body) => JSON.parse(body));
}

function fetchText(sourceUrl) {
  return new Promise((resolve, reject) => {
    https.get(sourceUrl, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return resolve(fetchText(response.headers.location));
      }

      if (response.statusCode >= 400) {
        response.resume();
        return reject(new Error(`Request failed with status ${response.statusCode}`));
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    }).on('error', reject);
  });
}
