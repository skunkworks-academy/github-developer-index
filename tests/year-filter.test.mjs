import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarYearWindows } from '../src/github/collect-south-africa.mjs';

test('builds current year plus previous calendar years', () => {
  const now = new Date('2026-08-23T21:15:00.000Z');
  const windows = calendarYearWindows(now, 5);

  assert.deepEqual(windows.map((window) => window.year), [2026, 2025, 2024, 2023, 2022]);
  assert.equal(windows[0].from, '2026-01-01T00:00:00.000Z');
  assert.equal(windows[0].to, now.toISOString());
  assert.equal(windows[0].complete, false);
  assert.equal(windows[1].from, '2025-01-01T00:00:00.000Z');
  assert.equal(windows[1].to, '2025-12-31T23:59:59.999Z');
  assert.equal(windows[1].complete, true);
});

test('clamps requested history depth', () => {
  const now = new Date('2026-08-23T21:15:00.000Z');
  assert.equal(calendarYearWindows(now, 0).length, 1);
  assert.equal(calendarYearWindows(now, 50).length, 10);
});
