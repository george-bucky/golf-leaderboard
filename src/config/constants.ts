export const url = 'https://www.espn.com/golf/leaderboard';
export const siteApiBase = 'https://site.web.api.espn.com/apis/site/v2/sports/golf';
export const selectorTourSlugs = ['lpga', 'eur', 'liv'];
export const liveUpdateFrequencyMins = 1;
export const idleUpdateFrequencyMins = 10;
export const eventSelectorCacheMillis = 60 * 1000;
export const minimumSupportedNodeMajor = 20;
export const minimumScorecardPanelWidth = 44;
export const minimumScreenWidthWithScorecard = 110;
export const liveUpdateFrequencyMillis = liveUpdateFrequencyMins * 60 * 1000;
export const idleUpdateFrequencyMillis = idleUpdateFrequencyMins * 60 * 1000;
export const PLAYER_VIEW_MODES = ['all', 'active', 'favorites'] as const;
export const SCORE_STYLES = {
  eagle: { fg: 'black', bg: 'yellow', label: 'EAGLE' },
  birdie: { fg: 'black', bg: 'green', label: 'BIRDIE' },
  bogey: { fg: 'white', bg: 'red', label: 'BOGEY' },
  dblBogey: { fg: 'white', bg: 'blue', label: 'DBL+' }
} as const;
export const SCORECARD_LABEL_WIDTH = 4;
export const SCORECARD_CELL_WIDTH = 4;
export const STATS_LABEL_WIDTH = 30;
export const STATS_VALUE_WIDTH = 12;
export const PRIMARY_STAT_ORDER = [
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
export const STAT_LABEL_OVERRIDES: Record<string, string> = {
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
export const playerJumpResetMillis = 1200;
