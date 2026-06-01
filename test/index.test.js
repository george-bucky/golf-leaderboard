'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  loadPrimaryEventSelectorOptionsWithFallback
} = require('../index');
const {
  buildPlayerViewText,
  buildTableData
} = require('../dist/format/leaderboard.js');
const {
  formatCompactScorecard
} = require('../dist/format/scorecard.js');
const {
  buildLeaderboardMeta,
  buildLeaderboardRows
} = require('../dist/data/espn.js');
const {
  decodePgaTourPayload,
  normalizePgaTourShotDetails
} = require('../dist/data/pgatour.js');

test('falls back to the direct PGA fetch when the primary event request fails', async () => {
  const expectedOption = { id: '123', name: 'Players Championship' };
  const seenTours = [];

  const options = await loadPrimaryEventSelectorOptionsWithFallback(
    async () => {
      throw new Error('primary request failed');
    },
    async (tour) => {
      seenTours.push(tour);
      return expectedOption;
    }
  );

  assert.deepEqual(seenTours, ['pga']);
  assert.deepEqual(options, [expectedOption]);
});

test('returns an empty list when both the primary request and PGA fallback fail', async () => {
  const options = await loadPrimaryEventSelectorOptionsWithFallback(
    async () => {
      throw new Error('primary request failed');
    },
    async () => {
      throw new Error('pga request failed');
    }
  );

  assert.deepEqual(options, []);
});

test('homebrew formula launches the installed package from node_modules', () => {
  const formulaPath = path.join(__dirname, '..', 'packaging', 'homebrew', 'fore.rb');
  const formula = fs.readFileSync(formulaPath, 'utf8');

  assert.match(formula, /lib\/node_modules/);
  assert.match(formula, /leaderboard\.log/);
  assert.doesNotMatch(formula, /libexec\/index\.js/);
});

test('favorites view text shows the saved player count', () => {
  assert.equal(buildPlayerViewText('favorites', 3), 'View: Favorites (3)');
});

test('table data trims long values to the configured column width', () => {
  const table = buildTableData(
    [
      {
        POS: 'T1',
        PLAYER: 'Zach Bauchou / Sam Stevens',
        SCORE: '-6'
      }
    ],
    {
      headers: ['POS', 'PLAYER', 'SCORE'],
      columnWidths: [4, 24, 6]
    }
  );

  assert.equal(table.data[0][1], 'Zach Bauchou / Sam St...');
});

test('compact scorecard handles players without round data', () => {
  const text = formatCompactScorecard(
    {
      PLAYER: 'Scottie Scheffler',
      POS: '1',
      SCORE: '-12',
      TODAY: '-3',
      THRU: 'F',
      R1: '68',
      R2: '67',
      R3: '69',
      R4: '64',
      TOT: '268',
      COMP_ID: '123'
    },
    { rounds: [] }
  );

  assert.match(text, /No round-by-round scorecard available yet\./);
});

test('compact scorecard appends latest PGA Tour shot-by-shot data', () => {
  const text = formatCompactScorecard(
    {
      PLAYER: 'Brooks Koepka',
      POS: '1',
      SCORE: '-8',
      TODAY: '-8',
      THRU: 'F',
      R1: '63',
      R2: '--',
      R3: '--',
      R4: '--',
      TOT: '63',
      COMP_ID: '6798'
    },
    {
      rounds: [
        {
          period: 1,
          displayValue: '-8',
          linescores: [{ period: 1, value: 4, displayValue: '4', par: 4 }]
        }
      ]
    },
    {
      tournamentId: 'R2026019',
      playerId: '36689',
      round: 1,
      holes: [
        {
          holeNumber: 1,
          displayHoleNumber: '1',
          par: 4,
          yardage: 417,
          score: '4',
          status: 'PAR',
          strokes: [
            {
              strokeNumber: 1,
              playByPlay: '253 yds to right rough, 164 yds to hole',
              playByPlayLabel: 'Shot 1',
              distance: '253 yds',
              distanceRemaining: '164 yds',
              fromLocation: 'Tee Box',
              toLocation: 'Right Rough'
            }
          ]
        }
      ]
    }
  );

  assert.match(text, /Shot-by-shot/);
  assert.match(text, /Hole 1  Par 4  417 yds  Score 4/);
  assert.match(text, /Shot 1: 253 yds to right rough, 164 yds to hole/);
  assert.ok(text.indexOf('Shot-by-shot') < text.indexOf('Current Round'));
});

test('compact scorecard omits empty PGA Tour shot-by-shot data', () => {
  const text = formatCompactScorecard(
    {
      PLAYER: 'Brooks Koepka',
      POS: '1',
      SCORE: '-8',
      TODAY: '-8',
      THRU: 'F',
      R1: '63',
      R2: '--',
      R3: '--',
      R4: '--',
      TOT: '63',
      COMP_ID: '6798'
    },
    {
      rounds: [
        {
          period: 1,
          displayValue: '-8',
          linescores: [{ period: 1, value: 4, displayValue: '4', par: 4 }]
        }
      ]
    },
    {
      tournamentId: 'R2026019',
      playerId: '36689',
      round: 1,
      holes: [
        {
          holeNumber: 1,
          displayHoleNumber: '1',
          par: 4,
          yardage: 417,
          score: '4',
          status: 'PAR',
          strokes: [
            { strokeNumber: 1, playByPlay: '   ' },
            { strokeNumber: 2, distance: '   ', toLocation: '   ', distanceRemaining: '   ' }
          ]
        }
      ]
    }
  );

  assert.doesNotMatch(text, /Shot-by-shot/);
  assert.match(text, /Current Round/);
  assert.deepEqual(text.split('\n').slice(0, 4), [
    'Brooks Koepka',
    'POS: 1   SCORE: -8   THRU: F',
    '',
    '{bold}Current Round{/bold}'
  ]);
});

test('PGA Tour payload decode and shot normalization handle compressed shot details', () => {
  const source = {
    tournamentId: 'R2026019',
    playerId: '36689',
    round: 1,
    holes: [
      {
        holeNumber: 10,
        displayHoleNumber: '10',
        par: 4,
        yardage: 494,
        score: '4',
        status: 'PAR',
        strokes: [
          {
            strokeNumber: 1,
            playByPlay: '308 yds to right rough, 193 yds to hole',
            playByPlayLabel: 'Shot 1',
            distance: '308 yds',
            distanceRemaining: '193 yds',
            fromLocation: 'Tee Box',
            toLocation: 'Right Rough'
          }
        ]
      }
    ]
  };
  const payload = zlib.gzipSync(Buffer.from(JSON.stringify(source), 'utf8')).toString('base64');
  const summary = normalizePgaTourShotDetails(decodePgaTourPayload(payload));

  assert.equal(summary.tournamentId, 'R2026019');
  assert.equal(summary.playerId, '36689');
  assert.equal(summary.holes[0].strokes[0].playByPlay, '308 yds to right rough, 193 yds to hole');
});

test('leaderboard rows show team names when ESPN sends a roster instead of a single athlete', () => {
  const rows = buildLeaderboardRows(
    [
      {
        id: 'team-1',
        sortOrder: 1,
        status: {
          position: { displayName: 'T1', isTie: true },
          type: { state: 'in', completed: false },
          thru: 7,
          detail: '-6(7)'
        },
        score: { value: 22, displayValue: '-6' },
        statistics: [{ name: 'scoreToPar', value: -6, displayValue: '-6' }],
        linescores: [{ period: 1, value: 22, displayValue: '-6' }],
        team: { displayName: 'J. Dufner / A. Cook' },
        roster: [
          { athlete: { displayName: 'Jason Dufner', shortName: 'J. Dufner', flag: { alt: 'USA' } } },
          { athlete: { displayName: 'Austin Cook', shortName: 'A. Cook', flag: { alt: 'USA' } } }
        ]
      }
    ],
    { period: 1 }
  );

  assert.equal(rows[0].PLAYER, 'Jason Dufner / Austin Cook');
  assert.equal(rows[0].CTRY, 'USA');
});

test('leaderboard meta stores team name lookups for team events', () => {
  const meta = buildLeaderboardMeta(
    {
      id: '401811943',
      name: 'Zurich Classic of New Orleans',
      league: { slug: 'pga' },
      courses: []
    },
    {
      status: { period: 1 },
      competitors: [
        {
          id: 'team-1',
          status: { type: { state: 'in' } },
          team: { displayName: 'J. Dufner / A. Cook' },
          roster: [
            { athlete: { displayName: 'Jason Dufner', shortName: 'J. Dufner' } },
            { athlete: { displayName: 'Austin Cook', shortName: 'A. Cook' } }
          ]
        }
      ]
    }
  );

  assert.equal(meta.competitorMap['JASON DUFNER / AUSTIN COOK'].name, 'Jason Dufner / Austin Cook');
  assert.equal(meta.competitorMap['JASON DUFNER'].id, 'team-1');
  assert.equal(meta.competitorMap['A COOK'].id, 'team-1');
});
