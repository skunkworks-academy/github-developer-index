import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSouthAfricaLocation } from '../src/locations/south-africa.mjs';

test('accepts explicit South Africa country names', () => {
  const result = normalizeSouthAfricaLocation('Johannesburg, South Africa');
  assert.equal(result.accepted, true);
  assert.equal(result.countryCode, 'ZA');
  assert.equal(result.city, 'Johannesburg');
  assert.equal(result.confidence, 1);
});

test('accepts recognized South African cities with lower confidence', () => {
  const result = normalizeSouthAfricaLocation('Cape Town');
  assert.equal(result.accepted, true);
  assert.equal(result.countryCode, 'ZA');
  assert.equal(result.city, 'Cape Town');
  assert.ok(result.confidence < 1);
});

test('rejects unresolved locations', () => {
  const result = normalizeSouthAfricaLocation('Remote');
  assert.equal(result.accepted, false);
});
