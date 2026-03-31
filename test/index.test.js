'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  loadPrimaryEventSelectorOptionsWithFallback
} = require('../index');
const {
  buildPlayerViewText
} = require('../dist/format/leaderboard.js');
const {
  formatCompactScorecard
} = require('../dist/format/scorecard.js');

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
