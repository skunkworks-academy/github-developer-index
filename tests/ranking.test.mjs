import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDevelopers } from '../src/ranking/score.mjs';

const makeUser = (login, overrides = {}) => ({
  login,
  metrics: {
    followers: 0,
    contributions365d: 0,
    pullRequests365d: 0,
    reviews365d: 0,
    issues365d: 0,
    starsReceived: 0,
    forksReceived: 0,
    ...overrides
  }
});

test('ranks stronger activity and impact ahead of weaker records', () => {
  const ranked = rankDevelopers([
    makeUser('lower', { contributions365d: 50, starsReceived: 3, followers: 10 }),
    makeUser('higher', { contributions365d: 500, starsReceived: 100, followers: 100 })
  ]);

  assert.equal(ranked[0].login, 'higher');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
  assert.ok(ranked[0].scores.overall > ranked[1].scores.overall);
});

test('returns stable finite scores for empty metrics', () => {
  const [ranked] = rankDevelopers([makeUser('zero')]);
  assert.equal(ranked.scores.overall, 0);
  assert.equal(ranked.rank, 1);
});
