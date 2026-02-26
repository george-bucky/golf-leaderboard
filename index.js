'use strict';

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const https = require('https');
const _ = require('lodash');
const scraper = require('table-scraper');

const url = 'https://www.espn.com/golf/leaderboard';
const siteApiBase = 'https://site.web.api.espn.com/apis/site/v2/sports/golf';
const updateFrequencyMins = 10;
const updateFrequencyMillis = updateFrequencyMins * 60 * 1000;
const SCORE_STYLES = {
  eagle: { fg: 'black', bg: 'yellow', label: 'EAGLE' },
  birdie: { fg: 'black', bg: 'green', label: 'BIRDIE' },
  bogey: { fg: 'white', bg: 'red', label: 'BOGEY' },
  dblBogey: { fg: 'white', bg: 'blue', label: 'DBL+' }
};
const SCORECARD_LABEL_WIDTH = 4;
const SCORECARD_CELL_WIDTH = 4;

let screen;
let grid;
let table;
let filterInput;
let scorecardBox;
let playerList = [];
let filteredPlayerList = [];
let leaderboardMeta = null;
let scorecardSelectionTimeout = null;
let suppressSelectionEvents = false;
const scorecardCache = {};
init();

function init() {
  screen = blessed.screen({ smartCSR: true, log: `${__dirname}/leaderboard.log` });
  grid = new contrib.grid({ rows: 10, cols: 12, screen: screen });

  // quit on esc or ctrl-c.
  screen.key(['escape', 'C-c'], (ch, key) => process.exit(0));

  createLayout();
  updateLeaderboard();
  setInterval(updateLeaderboard, updateFrequencyMillis);
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

  filterInput = grid.set(0, 0, 1, 8, blessed.textbox, {
    mouse: true,
    padding: { top: 1, left: 3 },
    style: { fg: 'green', focus: { fg: 'green', bg: '#333' } },
    inputOnFocus: true
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

  filterInput.on('keypress', (key) => {
    // wait one tick so text input value is up-to-date
    setTimeout(() => refilter(filterInput.getValue()), 0);
  });

  table.on('click', () => table.focus());

  // Preview scorecards shortly after selection changes.
  table.rows.on('select item', (item, index) => {
    if (suppressSelectionEvents) {
      return;
    }
    scheduleScorecardLoad(index);
  });

  // Load immediately on enter/double-click style actions.
  table.rows.on('action', (item, index) => showScorecard(index));

  filterInput.focus();
  screen.render();
}

function updateLeaderboard() {
  Promise.all([
    scraper.get(url),
    fetchLeaderboardMeta()
  ])
  .then((response) => {
    const scrapedTables = response[0] || [];
    leaderboardMeta = response[1];
    const now = new Date();
    playerList = scrapedTables[0] || []; // assumes leaderboard is first table on page

    table.setLabel({
      text: `Last updated: ${now.getHours()}:${now.getMinutes() < 10 ? 0 : ''}${now.getMinutes()} (updates every ${updateFrequencyMins} minutes)`,
      side: 'right'
    });

    // keep current filter text on auto refresh
    refilter(filterInput.getValue() || '');
  })
  .catch(() => {
    scorecardBox.setContent('Unable to refresh leaderboard right now.');
    screen.render();
  });
}

function refilter(filterText) {
  filteredPlayerList = _.filter(playerList, (p) => {
    // filter out placeholder rows (ex: cut line)
    return !!(
      p &&
      p.PLAYER &&
      p.PLAYER.toUpperCase().indexOf((filterText || '').toUpperCase()) !== -1
    );
  });

  const tableData = _.map(filteredPlayerList, (p) => {
    const row = _.omit(p, ['CTRY']); // country is not shown
    return _.values(row);
  });

  const header = _.keys(_.omit(filteredPlayerList[0] || {}, ['CTRY']));
  suppressSelectionEvents = true;
  table.setData({ data: tableData, headers: header });
  suppressSelectionEvents = false;
  screen.render();
}

function scheduleScorecardLoad(index) {
  if (scorecardSelectionTimeout) {
    clearTimeout(scorecardSelectionTimeout);
  }
  scorecardSelectionTimeout = setTimeout(() => showScorecard(index), 200);
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
    scorecardBox.setContent(formatScorecard(selected, scorecardCache[cacheKey]));
    screen.render();
    return;
  }

  scorecardBox.setContent(`Loading ${selected.PLAYER} scorecard...`);
  screen.render();

  fetchCompetitorSummary(leaderboardMeta.tour, leaderboardMeta.id, competitor.id)
    .then((summary) => {
      scorecardCache[cacheKey] = summary;
      scorecardBox.setContent(formatScorecard(selected, summary));
      screen.render();
    })
    .catch(() => {
      scorecardBox.setContent(`Unable to load scorecard for ${selected.PLAYER}.`);
      screen.render();
    });
}

function formatScorecard(player, summary) {
  const rounds = _.sortBy(summary.rounds || [], (round) => round.period);
  const lines = [];

  lines.push(`${player.PLAYER}`);
  lines.push(`POS: ${player.POS || '--'}   SCORE: ${player.SCORE || '--'}   THRU: ${player.THRU || '--'}`);
  lines.push('');

  if (!rounds.length) {
    lines.push('No round-by-round scorecard available yet.');
    return lines.join('\n');
  }

  _.forEach(rounds, (round) => {
    const linescoresByHole = _.keyBy(round.linescores || [], 'period');
    const frontHoles = _.range(1, 10);
    const backHoles = _.range(10, 19);

    const frontPars = _.map(frontHoles, (hole) => holePar(linescoresByHole[hole]));
    const backPars = _.map(backHoles, (hole) => holePar(linescoresByHole[hole]));
    const frontScores = _.map(frontHoles, (hole) => holeScore(linescoresByHole[hole]));
    const backScores = _.map(backHoles, (hole) => holeScore(linescoresByHole[hole]));

    const parOut = sumPars(frontPars);
    const parIn = sumPars(backPars);
    const parTot = sumPars([parOut, parIn]);

    lines.push(buildDivider(48));
    lines.push(`{bold}Round ${round.period}{/bold}  Score: ${round.displayValue || '--'}  Out: ${round.outScore || '--'}  In: ${round.inScore || '--'}`);
    lines.push(buildTextRow('HOLE', frontHoles.concat(['OUT'])));
    lines.push(buildTextRow('PAR', frontPars.concat([parOut])));
    lines.push(buildScoreRow('SCR', frontHoles.map((hole) => linescoresByHole[hole]).concat([null]), frontScores.concat([round.outScore || '--'])));
    lines.push('');
    lines.push(buildTextRow('HOLE', backHoles.concat(['IN', 'TOT'])));
    lines.push(buildTextRow('PAR', backPars.concat([parIn, parTot])));
    lines.push(buildScoreRow('SCR', backHoles.map((hole) => linescoresByHole[hole]).concat([null, null]), backScores.concat([round.inScore || '--', round.displayValue || '--'])));
    lines.push('');
  });

  lines.push(buildLegendLine());
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

function findCompetitorByName(playerName) {
  if (!leaderboardMeta || !leaderboardMeta.competitorMap) {
    return null;
  }
  return leaderboardMeta.competitorMap[normalizeName(playerName)] || null;
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

      const competitors = leaderboard.competitors || [];
      const competitorMap = _.reduce(competitors, (memo, competitor) => {
        memo[normalizeName(competitor.name)] = competitor;
        return memo;
      }, {});

      return {
        id: leaderboard.id,
        tour: leaderboard.tour || 'pga',
        competitorMap: competitorMap
      };
    })
    .catch(() => null);
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
