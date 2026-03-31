"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCompactScorecard = formatCompactScorecard;
exports.formatFullScreenDetail = formatFullScreenDetail;
exports.shouldUseSingleRowDetailScorecard = shouldUseSingleRowDetailScorecard;
exports.buildDetailHeader = buildDetailHeader;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const text_1 = require("../utils/text");
const time_1 = require("../utils/time");
function formatCompactScorecard(player, summary) {
    const rounds = lodash_1.default.sortBy(summary.rounds || [], (round) => round.period);
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
function formatFullScreenDetail(player, summary, renderWidth) {
    const singleRowScorecard = shouldUseSingleRowDetailScorecard(renderWidth);
    return {
        header: buildDetailHeader(player, renderWidth),
        body: formatDetailedScorecard(summary, { singleRowScorecard, renderWidth })
    };
}
function shouldUseSingleRowDetailScorecard(renderWidth) {
    const minSingleRowWidth = constants_1.SCORECARD_LABEL_WIDTH + (21 * constants_1.SCORECARD_CELL_WIDTH);
    return renderWidth >= minSingleRowWidth;
}
function buildDetailHeader(player, renderWidth) {
    const dividerWidth = Math.min(Math.max(60, renderWidth || 80), 120);
    const lines = [];
    lines.push('{bold}Player Event Detail{/bold}   {light-gray-fg}Press L to return to leaderboard{/light-gray-fg}');
    lines.push(buildDivider(dividerWidth));
    lines.push(`${player.PLAYER}`);
    lines.push(`POS: ${player.POS || '--'}   SCORE: ${player.SCORE || '--'}   THRU: ${player.THRU || '--'}`);
    lines.push(buildDivider(dividerWidth));
    return lines.join('\n');
}
function formatDetailedScorecard(summary, layout) {
    const useSingleRow = !!layout.singleRowScorecard;
    const roundDividerWidth = Math.min(Math.max(52, layout.renderWidth || 52), 120);
    const rounds = lodash_1.default.sortBy(summary.rounds || [], (round) => round.period);
    const lines = [];
    lines.push('{bold}All Rounds{/bold}');
    if (!rounds.length) {
        lines.push('No round-by-round scorecard available yet.');
    }
    else {
        lodash_1.default.forEach(rounds, (round) => {
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
function getCurrentRound(rounds) {
    const withScores = lodash_1.default.filter(rounds, (round) => (round.linescores || []).length > 0);
    return withScores.length ? lodash_1.default.last(withScores) : (lodash_1.default.last(rounds) || {});
}
function formatRoundHeader(round) {
    const parts = [`{bold}Round ${round.period}{/bold}`, `Score: ${round.displayValue || '--'}`];
    const out = round.outScore == null ? '--' : `${round.outScore}`;
    const into = round.inScore == null ? '--' : `${round.inScore}`;
    if (round.outScore != null || round.inScore != null) {
        parts.push(`Out: ${out}`);
        parts.push(`In: ${into}`);
    }
    if (round.startTee != null && `${round.startTee}` !== '')
        parts.push(`Start Tee: ${round.startTee}`);
    if (round.teeTime) {
        const tee = (0, time_1.parseTeeTime)(round.teeTime);
        if (tee)
            parts.push(`Tee: ${tee}`);
    }
    return parts.join('  ');
}
function buildRoundRows(round, options) {
    if (!round || !(round.linescores || []).length)
        return buildRoundRowsUnavailable(round);
    return options.singleRow ? buildRoundRowsSingleLine(round) : buildRoundRowsSplit(round);
}
function buildRoundRowsUnavailable(round) {
    const lines = ['{light-gray-fg}Hole-by-hole data is not provided for this round.{/light-gray-fg}'];
    const statLine = buildRoundStatSummaryLine(round);
    if (statLine)
        lines.push(statLine);
    return lines;
}
function buildRoundStatSummaryLine(round) {
    const stats = lodash_1.default.get(round, 'statistics.categories[0].stats', []);
    if (!stats.length)
        return '';
    const statMap = lodash_1.default.keyBy(stats, 'name');
    const summary = [];
    const addStat = (name, label) => {
        const stat = statMap[name];
        if (!stat || stat.displayValue == null || `${stat.displayValue}`.trim() === '')
            return;
        summary.push(`${label}: ${stat.displayValue}`);
    };
    addStat('eagles', 'Eagles');
    addStat('birdies', 'Birdies');
    addStat('pars', 'Pars');
    addStat('bogeys', 'Bogeys');
    addStat('doubleBogeys', 'Double Bogeys');
    return summary.join('   ');
}
function buildRoundRowsSingleLine(round) {
    const rows = [];
    const linescoresByHole = buildLinescoresByHole(round.linescores || [], round.startTee);
    const holes = lodash_1.default.range(1, 19);
    const pars = lodash_1.default.map(holes, (hole) => holePar(linescoresByHole[hole]));
    const scores = lodash_1.default.map(holes, (hole) => holeScore(linescoresByHole[hole]));
    const parOut = sumPars(pars.slice(0, 9));
    const parIn = sumPars(pars.slice(9));
    const parTot = sumPars([parOut, parIn]);
    rows.push(buildTextRow('HOLE', holes.concat(['OUT', 'IN', 'TOT'])));
    rows.push(buildTextRow('PAR', pars.concat([parOut, parIn, parTot])));
    rows.push(buildScoreRow('SCR', holes.map((hole) => linescoresByHole[hole]).concat([null, null, null]), scores.concat([`${round.outScore || '--'}`, `${round.inScore || '--'}`, `${round.displayValue || '--'}`])));
    return rows;
}
function buildRoundRowsSplit(round) {
    const rows = [];
    const linescoresByHole = buildLinescoresByHole(round.linescores || [], round.startTee);
    const frontHoles = lodash_1.default.range(1, 10);
    const backHoles = lodash_1.default.range(10, 19);
    const frontPars = lodash_1.default.map(frontHoles, (hole) => holePar(linescoresByHole[Number(hole)]));
    const backPars = lodash_1.default.map(backHoles, (hole) => holePar(linescoresByHole[Number(hole)]));
    const frontScores = lodash_1.default.map(frontHoles, (hole) => holeScore(linescoresByHole[Number(hole)]));
    const backScores = lodash_1.default.map(backHoles, (hole) => holeScore(linescoresByHole[Number(hole)]));
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
function buildLinescoresByHole(linescores, startTee) {
    const byHole = {};
    const mappingMode = getPeriodMappingMode(linescores, startTee);
    const startTeeNumber = parseInt(`${startTee}`, 10);
    lodash_1.default.forEach(linescores, (linescore) => {
        const hole = mappingMode === 'sequence' ? holeFromSequencePeriod(linescore?.period, startTeeNumber) : normalizeHoleFromPeriod(linescore?.period);
        if (!hole)
            return;
        const current = byHole[hole];
        if (!current) {
            byHole[hole] = linescore;
            return;
        }
        const currentPeriod = parseInt(current.period, 10);
        const nextPeriod = parseInt(linescore.period, 10);
        const currentIsWrapped = Number.isInteger(currentPeriod) && currentPeriod > 18;
        const nextIsDirect = Number.isInteger(nextPeriod) && nextPeriod <= 18;
        if (currentIsWrapped && nextIsDirect)
            byHole[hole] = linescore;
    });
    return byHole;
}
function getPeriodMappingMode(linescores, startTee) {
    const tee = parseInt(`${startTee}`, 10);
    if (!Number.isInteger(tee) || tee <= 1)
        return 'hole';
    const periods = lodash_1.default.chain(linescores).map((line) => parseInt(line?.period, 10)).filter((period) => Number.isInteger(period) && period > 0).uniq().sortBy().value();
    if (!periods.length)
        return 'hole';
    return lodash_1.default.every(periods, (period, index) => period === index + 1) ? 'sequence' : 'hole';
}
function holeFromSequencePeriod(period, startTee) {
    const periodNumber = parseInt(`${period}`, 10);
    if (!Number.isInteger(periodNumber) || periodNumber < 1)
        return null;
    if (!Number.isInteger(startTee) || startTee < 1)
        return normalizeHoleFromPeriod(periodNumber);
    return ((startTee - 1 + periodNumber - 1) % 18) + 1;
}
function normalizeHoleFromPeriod(period) {
    const numericPeriod = parseInt(`${period}`, 10);
    if (!Number.isInteger(numericPeriod) || numericPeriod < 1)
        return null;
    return ((numericPeriod - 1) % 18) + 1;
}
function buildStatsRows(stats) {
    if (!stats.length)
        return ['No event stats available yet.'];
    const statByName = lodash_1.default.keyBy(stats, 'name');
    const lines = [];
    const keyStats = lodash_1.default.compact(lodash_1.default.map(constants_1.PRIMARY_STAT_ORDER, (name) => {
        const stat = statByName[name];
        return stat ? buildStatEntry(stat) : null;
    }));
    if (keyStats.length)
        lines.push(...buildStatsTable('Key Stats', keyStats));
    const primarySet = lodash_1.default.keyBy(constants_1.PRIMARY_STAT_ORDER, lodash_1.default.identity);
    const additionalStats = lodash_1.default.chain(stats).filter((stat) => !primarySet[stat.name || '']).map(buildStatEntry).filter((entry) => isMeaningfulStatValue(entry.value)).value();
    if (additionalStats.length) {
        lines.push('');
        lines.push(...buildStatsTable('Additional Stats', additionalStats));
    }
    return lines;
}
function sumPars(parValues) {
    const parsed = lodash_1.default.map(parValues, (value) => parseInt(`${value}`, 10));
    const valid = lodash_1.default.filter(parsed, (value) => !Number.isNaN(value));
    return valid.length ? `${lodash_1.default.sum(valid)}` : '--';
}
function buildTextRow(label, values) {
    return `${formatLabelCell(label)}${lodash_1.default.map(values, (value) => (0, text_1.padCell)(value, constants_1.SCORECARD_CELL_WIDTH, 'right')).join('')}`;
}
function buildScoreRow(label, linescores, scoreValues) {
    let row = `${formatLabelCell(label)}`;
    lodash_1.default.forEach(scoreValues, (scoreValue, index) => {
        const styleKey = scoreStyleKey(linescores[index]);
        row += scoreCellWithStyle((0, text_1.padCell)(scoreValue, constants_1.SCORECARD_CELL_WIDTH, 'right'), styleKey);
    });
    return row;
}
function holeScore(linescore) {
    return linescore?.displayValue ? `${linescore.displayValue}` : '--';
}
function holePar(linescore) {
    return linescore && linescore.par != null ? `${linescore.par}` : '--';
}
function scoreStyleKey(linescore) {
    if (!linescore)
        return null;
    const holeScoreValue = parseInt(linescore.value, 10);
    const holeParValue = parseInt(linescore.par, 10);
    if (!Number.isNaN(holeScoreValue) && !Number.isNaN(holeParValue)) {
        const diff = holeScoreValue - holeParValue;
        if (diff <= -2)
            return 'eagle';
        if (diff === -1)
            return 'birdie';
        if (diff === 1)
            return 'bogey';
        if (diff >= 2)
            return 'dblBogey';
    }
    const scoreTypeName = lodash_1.default.toUpper(lodash_1.default.get(linescore, 'scoreType.name', ''));
    if (scoreTypeName.indexOf('EAGLE') !== -1)
        return 'eagle';
    if (scoreTypeName.indexOf('BIRDIE') !== -1)
        return 'birdie';
    if (scoreTypeName.indexOf('DOUBLE') !== -1 || scoreTypeName.indexOf('TRIPLE') !== -1 || scoreTypeName.indexOf('QUADRUPLE') !== -1)
        return 'dblBogey';
    if (scoreTypeName.indexOf('BOGEY') !== -1)
        return 'bogey';
    return null;
}
function scoreCellWithStyle(cellText, styleKey) {
    if (!styleKey || !constants_1.SCORE_STYLES[styleKey])
        return cellText;
    const style = constants_1.SCORE_STYLES[styleKey];
    return `{${style.fg}-fg}{${style.bg}-bg}${cellText}{/}`;
}
function buildLegendLine() {
    const legendItem = (style) => `{${style.fg}-fg}{${style.bg}-bg}  {/} ${style.label}`;
    return `{bold}Legend:{/bold} ${legendItem(constants_1.SCORE_STYLES.eagle)}  ${legendItem(constants_1.SCORE_STYLES.birdie)}  ${legendItem(constants_1.SCORE_STYLES.bogey)}  ${legendItem(constants_1.SCORE_STYLES.dblBogey)}`;
}
function buildDivider(length) {
    return '-'.repeat(length);
}
function formatLabelCell(label) {
    return `{bold}${(0, text_1.padCell)(label, constants_1.SCORECARD_LABEL_WIDTH, 'left')}{/bold}`;
}
function buildStatEntry(stat) {
    return {
        name: stat.name || 'stat',
        label: constants_1.STAT_LABEL_OVERRIDES[stat.name || ''] || stat.displayName || stat.name || 'Stat',
        value: stat.displayValue == null || stat.displayValue === '' ? '--' : `${stat.displayValue}`
    };
}
function buildStatsTable(title, entries) {
    const lines = [];
    const border = `+${'-'.repeat(constants_1.STATS_LABEL_WIDTH + 2)}+${'-'.repeat(constants_1.STATS_VALUE_WIDTH + 2)}+`;
    lines.push(`{bold}${title}{/bold}`);
    lines.push(border);
    lines.push(`| ${(0, text_1.padEndText)('Stat', constants_1.STATS_LABEL_WIDTH)} | ${(0, text_1.padEndText)('Value', constants_1.STATS_VALUE_WIDTH)} |`);
    lines.push(border);
    lodash_1.default.forEach(entries, (entry) => {
        lines.push(`| ${(0, text_1.padEndText)(entry.label, constants_1.STATS_LABEL_WIDTH)} | {bold}${(0, text_1.padStartText)(entry.value, constants_1.STATS_VALUE_WIDTH)}{/bold} |`);
    });
    lines.push(border);
    return lines;
}
function isMeaningfulStatValue(value) {
    const text = `${value == null ? '' : value}`.trim();
    if (!text || text === '--')
        return false;
    if (text === '0' || text === '0.0' || text === '0.00' || text === '$0')
        return false;
    return true;
}
