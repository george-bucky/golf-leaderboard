'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  loadPrimaryEventSelectorOptionsWithFallback
} = require('../index');

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
