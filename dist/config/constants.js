"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerJumpResetMillis = exports.STAT_LABEL_OVERRIDES = exports.PRIMARY_STAT_ORDER = exports.STATS_VALUE_WIDTH = exports.STATS_LABEL_WIDTH = exports.SCORECARD_CELL_WIDTH = exports.SCORECARD_LABEL_WIDTH = exports.SCORE_STYLES = exports.PLAYER_VIEW_MODES = exports.idleUpdateFrequencyMillis = exports.liveUpdateFrequencyMillis = exports.minimumScreenWidthWithScorecard = exports.minimumScorecardPanelWidth = exports.minimumSupportedNodeMajor = exports.eventSelectorCacheMillis = exports.idleUpdateFrequencyMins = exports.liveUpdateFrequencyMins = exports.selectorTourSlugs = exports.siteApiBase = exports.url = void 0;
exports.url = 'https://www.espn.com/golf/leaderboard';
exports.siteApiBase = 'https://site.web.api.espn.com/apis/site/v2/sports/golf';
exports.selectorTourSlugs = ['lpga', 'eur', 'liv'];
exports.liveUpdateFrequencyMins = 1;
exports.idleUpdateFrequencyMins = 10;
exports.eventSelectorCacheMillis = 60 * 1000;
exports.minimumSupportedNodeMajor = 20;
exports.minimumScorecardPanelWidth = 44;
exports.minimumScreenWidthWithScorecard = 110;
exports.liveUpdateFrequencyMillis = exports.liveUpdateFrequencyMins * 60 * 1000;
exports.idleUpdateFrequencyMillis = exports.idleUpdateFrequencyMins * 60 * 1000;
exports.PLAYER_VIEW_MODES = ['all', 'active', 'favorites'];
exports.SCORE_STYLES = {
    eagle: { fg: 'black', bg: 'yellow', label: 'EAGLE' },
    birdie: { fg: 'black', bg: 'green', label: 'BIRDIE' },
    bogey: { fg: 'white', bg: 'red', label: 'BOGEY' },
    dblBogey: { fg: 'white', bg: 'blue', label: 'DBL+' }
};
exports.SCORECARD_LABEL_WIDTH = 4;
exports.SCORECARD_CELL_WIDTH = 4;
exports.STATS_LABEL_WIDTH = 30;
exports.STATS_VALUE_WIDTH = 12;
exports.PRIMARY_STAT_ORDER = [
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
exports.STAT_LABEL_OVERRIDES = {
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
exports.playerJumpResetMillis = 1200;
