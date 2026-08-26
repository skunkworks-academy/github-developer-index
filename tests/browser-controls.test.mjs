import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../public/assets/app.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('country loader initializes its stale-request sequence guard', () => {
  assert.match(appSource, /loadSequence\s*:\s*0/);
  assert.match(appSource, /const requestId\s*=\s*\+\+state\.loadSequence/);
  assert.match(appSource, /requestId\s*!==\s*state\.loadSequence/);
});

test('all interactive leaderboard filters are present and wired', () => {
  for (const id of ['country', 'period', 'metric', 'activity-filter', 'search']) {
    assert.match(indexSource, new RegExp(`id=["']${id}["']`));
  }

  assert.match(appSource, /els\.country\.addEventListener\('change'/);
  assert.match(appSource, /els\.period\.addEventListener\('change'/);
  assert.match(appSource, /els\.metric\.addEventListener\('change'/);
  assert.match(appSource, /els\.activityFilter\.addEventListener\('change'/);
  assert.match(appSource, /els\.search\.addEventListener\('input'/);
});
