import _ from 'lodash';
import {
  PRIMARY_STAT_ORDER,
  SCORE_STYLES,
  SCORECARD_CELL_WIDTH,
  SCORECARD_LABEL_WIDTH,
  STAT_LABEL_OVERRIDES,
  STATS_LABEL_WIDTH,
  STATS_VALUE_WIDTH
} from '../config/constants';
import { CompetitorSummary, DetailContent, PlayerRow, RoundSummary, StatSource } from '../types';
import { padCell, padEndText, padStartText } from '../utils/text';
import { parseTeeTime } from '../utils/time';

export function formatCompactScorecard(player: PlayerRow, summary: CompetitorSummary): string {
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
  lines.push('{light-gray-fg}Press Enter for full-screen rounds + event stats{/light-gray-fg}');
  return lines.join('\n');
}

export function formatFullScreenDetail(player: PlayerRow, summary: CompetitorSummary, renderWidth: number): DetailContent {
  const singleRowScorecard = shouldUseSingleRowDetailScorecard(renderWidth);
  return {
    header: buildDetailHeader(player, renderWidth),
    body: formatDetailedScorecard(summary, { singleRowScorecard, renderWidth })
  };
}

export function shouldUseSingleRowDetailScorecard(renderWidth: number): boolean {
  const minSingleRowWidth = SCORECARD_LABEL_WIDTH + (21 * SCORECARD_CELL_WIDTH);
  return renderWidth >= minSingleRowWidth;
}

export function buildDetailHeader(player: PlayerRow, renderWidth: number): string {
  const dividerWidth = Math.min(Math.max(60, renderWidth || 80), 120);
  const lines = [];
  lines.push('{bold}Player Event Detail{/bold}   {light-gray-fg}Press L to return to leaderboard{/light-gray-fg}');
  lines.push(buildDivider(dividerWidth));
  lines.push(`${player.PLAYER}`);
  lines.push(`POS: ${player.POS || '--'}   SCORE: ${player.SCORE || '--'}   THRU: ${player.THRU || '--'}`);
  lines.push(buildDivider(dividerWidth));
  return lines.join('\n');
}

function formatDetailedScorecard(summary: CompetitorSummary, layout: any): string {
  const useSingleRow = !!layout.singleRowScorecard;
  const roundDividerWidth = Math.min(Math.max(52, layout.renderWidth || 52), 120);
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

function getCurrentRound(rounds: RoundSummary[]): RoundSummary {
  const withScores = _.filter(rounds, (round) => (round.linescores || []).length > 0);
  return withScores.length ? (_.last(withScores) as RoundSummary) : ((_.last(rounds) || {}) as RoundSummary);
}

function formatRoundHeader(round: RoundSummary): string {
  const parts = [`{bold}Round ${round.period}{/bold}`, `Score: ${round.displayValue || '--'}`];
  const out = round.outScore == null ? '--' : `${round.outScore}`;
  const into = round.inScore == null ? '--' : `${round.inScore}`;
  if (round.outScore != null || round.inScore != null) {
    parts.push(`Out: ${out}`);
    parts.push(`In: ${into}`);
  }
  if (round.startTee != null && `${round.startTee}` !== '') parts.push(`Start Tee: ${round.startTee}`);
  if (round.teeTime) {
    const tee = parseTeeTime(round.teeTime);
    if (tee) parts.push(`Tee: ${tee}`);
  }
  return parts.join('  ');
}

function buildRoundRows(round: RoundSummary, options: { singleRow: boolean }): string[] {
  if (!round || !(round.linescores || []).length) return buildRoundRowsUnavailable(round);
  return options.singleRow ? buildRoundRowsSingleLine(round) : buildRoundRowsSplit(round);
}

function buildRoundRowsUnavailable(round: RoundSummary): string[] {
  const lines = ['{light-gray-fg}Hole-by-hole data is not provided for this round.{/light-gray-fg}'];
  const statLine = buildRoundStatSummaryLine(round);
  if (statLine) lines.push(statLine);
  return lines;
}

function buildRoundStatSummaryLine(round: RoundSummary): string {
  const stats = _.get(round, 'statistics.categories[0].stats', []);
  if (!stats.length) return '';
  const statMap = _.keyBy(stats, 'name');
  const summary: string[] = [];
  const addStat = (name: string, label: string) => {
    const stat = statMap[name];
    if (!stat || stat.displayValue == null || `${stat.displayValue}`.trim() === '') return;
    summary.push(`${label}: ${stat.displayValue}`);
  };
  addStat('eagles', 'Eagles');
  addStat('birdies', 'Birdies');
  addStat('pars', 'Pars');
  addStat('bogeys', 'Bogeys');
  addStat('doubleBogeys', 'Double Bogeys');
  return summary.join('   ');
}

function buildRoundRowsSingleLine(round: RoundSummary): string[] {
  const rows: string[] = [];
  const linescoresByHole = buildLinescoresByHole(round.linescores || [], round.startTee);
  const holes = _.range(1, 19) as Array<string | number>;
  const pars = _.map(holes, (hole) => holePar(linescoresByHole[hole]));
  const scores = _.map(holes, (hole) => holeScore(linescoresByHole[hole]));
  const parOut = sumPars(pars.slice(0, 9));
  const parIn = sumPars(pars.slice(9));
  const parTot = sumPars([parOut, parIn]);
  rows.push(buildTextRow('HOLE', holes.concat(['OUT', 'IN', 'TOT'])));
  rows.push(buildTextRow('PAR', pars.concat([parOut, parIn, parTot])));
  rows.push(buildScoreRow('SCR', holes.map((hole) => linescoresByHole[hole]).concat([null, null, null]), scores.concat([`${round.outScore || '--'}`, `${round.inScore || '--'}`, `${round.displayValue || '--'}`])));
  return rows;
}

function buildRoundRowsSplit(round: RoundSummary): string[] {
  const rows: string[] = [];
  const linescoresByHole = buildLinescoresByHole(round.linescores || [], round.startTee);
  const frontHoles = _.range(1, 10) as Array<string | number>;
  const backHoles = _.range(10, 19) as Array<string | number>;
  const frontPars = _.map(frontHoles, (hole) => holePar(linescoresByHole[Number(hole)]));
  const backPars = _.map(backHoles, (hole) => holePar(linescoresByHole[Number(hole)]));
  const frontScores = _.map(frontHoles, (hole) => holeScore(linescoresByHole[Number(hole)]));
  const backScores = _.map(backHoles, (hole) => holeScore(linescoresByHole[Number(hole)]));
  const parOut = sumPars(frontPars);
  const parIn = sumPars(backPars);
  const parTot = sumPars([parOut, parIn]);
  rows.push(buildTextRow('HOLE', frontHoles.concat(['OUT'])));
  rows.push(buildTextRow('PAR', frontPars.concat([parOut])));
  rows.push(buildScoreRow('SCR', frontHoles.map((hole) => linescoresByHole[Number(hole)]).concat([null]), frontScores.concat([`${round.outScore || '--'}`])));
  rows.push('');
  rows.push(buildTextRow('HOLE', backHoles.concat(['IN', 'TOT'])));
  rows.push(buildTextRow('PAR', backPars.concat([parIn, parTot])));
  rows.push(buildScoreRow('SCR', backHoles.map((hole) => linescoresByHole[Number(hole)]).concat([null, null]), backScores.concat([`${round.inScore || '--'}`, `${round.displayValue || '--'}`])));
  return rows;
}

function buildLinescoresByHole(linescores: any[], startTee: unknown): Record<number, any> {
  const byHole: Record<number, any> = {};
  const mappingMode = getPeriodMappingMode(linescores, startTee);
  const startTeeNumber = parseInt(`${startTee}`, 10);
  _.forEach(linescores, (linescore) => {
    const hole = mappingMode === 'sequence' ? holeFromSequencePeriod(linescore?.period, startTeeNumber) : normalizeHoleFromPeriod(linescore?.period);
    if (!hole) return;
    const current = byHole[hole];
    if (!current) {
      byHole[hole] = linescore;
      return;
    }
    const currentPeriod = parseInt(current.period, 10);
    const nextPeriod = parseInt(linescore.period, 10);
    const currentIsWrapped = Number.isInteger(currentPeriod) && currentPeriod > 18;
    const nextIsDirect = Number.isInteger(nextPeriod) && nextPeriod <= 18;
    if (currentIsWrapped && nextIsDirect) byHole[hole] = linescore;
  });
  return byHole;
}

function getPeriodMappingMode(linescores: any[], startTee: unknown): 'sequence' | 'hole' {
  const tee = parseInt(`${startTee}`, 10);
  if (!Number.isInteger(tee) || tee <= 1) return 'hole';
  const periods = _.chain(linescores).map((line) => parseInt(line?.period, 10)).filter((period) => Number.isInteger(period) && period > 0).uniq().sortBy().value();
  if (!periods.length) return 'hole';
  return _.every(periods, (period, index) => period === index + 1) ? 'sequence' : 'hole';
}

function holeFromSequencePeriod(period: number | string, startTee: number): number | null {
  const periodNumber = parseInt(`${period}`, 10);
  if (!Number.isInteger(periodNumber) || periodNumber < 1) return null;
  if (!Number.isInteger(startTee) || startTee < 1) return normalizeHoleFromPeriod(periodNumber);
  return ((startTee - 1 + periodNumber - 1) % 18) + 1;
}

function normalizeHoleFromPeriod(period: number | string): number | null {
  const numericPeriod = parseInt(`${period}`, 10);
  if (!Number.isInteger(numericPeriod) || numericPeriod < 1) return null;
  return ((numericPeriod - 1) % 18) + 1;
}

function buildStatsRows(stats: StatSource[]): string[] {
  if (!stats.length) return ['No event stats available yet.'];
  const statByName = _.keyBy(stats, 'name');
  const lines: string[] = [];
  const keyStats = _.compact(_.map(PRIMARY_STAT_ORDER, (name) => {
    const stat = statByName[name];
    return stat ? buildStatEntry(stat) : null;
  }));
  if (keyStats.length) lines.push(...buildStatsTable('Key Stats', keyStats));
  const primarySet = _.keyBy(PRIMARY_STAT_ORDER, _.identity);
  const additionalStats = _.chain(stats).filter((stat) => !primarySet[stat.name || '']).map(buildStatEntry).filter((entry) => isMeaningfulStatValue(entry.value)).value();
  if (additionalStats.length) {
    lines.push('');
    lines.push(...buildStatsTable('Additional Stats', additionalStats));
  }
  return lines;
}

function sumPars(parValues: Array<string | number>): string {
  const parsed = _.map(parValues, (value) => parseInt(`${value}`, 10));
  const valid = _.filter(parsed, (value) => !Number.isNaN(value));
  return valid.length ? `${_.sum(valid)}` : '--';
}

function buildTextRow(label: string, values: Array<string | number>): string {
  return `${formatLabelCell(label)}${_.map(values, (value) => padCell(value, SCORECARD_CELL_WIDTH, 'right')).join('')}`;
}

function buildScoreRow(label: string, linescores: any[], scoreValues: Array<string | number>): string {
  let row = `${formatLabelCell(label)}`;
  _.forEach(scoreValues, (scoreValue, index) => {
    const styleKey = scoreStyleKey(linescores[index]);
    row += scoreCellWithStyle(padCell(scoreValue, SCORECARD_CELL_WIDTH, 'right'), styleKey);
  });
  return row;
}

function holeScore(linescore: any): string {
  return linescore?.displayValue ? `${linescore.displayValue}` : '--';
}

function holePar(linescore: any): string {
  return linescore && linescore.par != null ? `${linescore.par}` : '--';
}

function scoreStyleKey(linescore: any): keyof typeof SCORE_STYLES | null {
  if (!linescore) return null;
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

function scoreCellWithStyle(cellText: string, styleKey: keyof typeof SCORE_STYLES | null): string {
  if (!styleKey || !SCORE_STYLES[styleKey]) return cellText;
  const style = SCORE_STYLES[styleKey];
  return `{${style.fg}-fg}{${style.bg}-bg}${cellText}{/}`;
}

function buildLegendLine(): string {
  const legendItem = (style: { fg: string; bg: string; label: string }) => `{${style.fg}-fg}{${style.bg}-bg}  {/} ${style.label}`;
  return `{bold}Legend:{/bold} ${legendItem(SCORE_STYLES.eagle)}  ${legendItem(SCORE_STYLES.birdie)}  ${legendItem(SCORE_STYLES.bogey)}  ${legendItem(SCORE_STYLES.dblBogey)}`;
}

function buildDivider(length: number): string {
  return '-'.repeat(length);
}

function formatLabelCell(label: string): string {
  return `{bold}${padCell(label, SCORECARD_LABEL_WIDTH, 'left')}{/bold}`;
}

function buildStatEntry(stat: StatSource): { name: string; label: string; value: string } {
  return {
    name: stat.name || 'stat',
    label: STAT_LABEL_OVERRIDES[stat.name || ''] || stat.displayName || stat.name || 'Stat',
    value: stat.displayValue == null || stat.displayValue === '' ? '--' : `${stat.displayValue}`
  };
}

function buildStatsTable(title: string, entries: Array<{ label: string; value: string }>): string[] {
  const lines = [];
  const border = `+${'-'.repeat(STATS_LABEL_WIDTH + 2)}+${'-'.repeat(STATS_VALUE_WIDTH + 2)}+`;
  lines.push(`{bold}${title}{/bold}`);
  lines.push(border);
  lines.push(`| ${padEndText('Stat', STATS_LABEL_WIDTH)} | ${padEndText('Value', STATS_VALUE_WIDTH)} |`);
  lines.push(border);
  _.forEach(entries, (entry) => {
    lines.push(`| ${padEndText(entry.label, STATS_LABEL_WIDTH)} | {bold}${padStartText(entry.value, STATS_VALUE_WIDTH)}{/bold} |`);
  });
  lines.push(border);
  return lines;
}

function isMeaningfulStatValue(value: string): boolean {
  const text = `${value == null ? '' : value}`.trim();
  if (!text || text === '--') return false;
  if (text === '0' || text === '0.0' || text === '0.00' || text === '$0') return false;
  return true;
}
