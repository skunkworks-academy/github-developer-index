import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRY_CONFIGS,
  countrySearchQueries,
  getCountryConfig,
  normalizeCountryLocation
} from '../src/locations/countries.mjs';

test('country registry exposes a broad selectable set', () => {
  assert.ok(Object.keys(COUNTRY_CONFIGS).length >= 20);
  assert.equal(getCountryConfig('za')?.name, 'South Africa');
  assert.equal(getCountryConfig('PT')?.name, 'Portugal');
  assert.equal(getCountryConfig('XX'), null);
});

test('accepts explicit country names and localized aliases', () => {
  const portugal = getCountryConfig('PT');
  const mexico = getCountryConfig('MX');

  assert.equal(normalizeCountryLocation('Lisbon, Portugal', portugal).confidence, 1);
  assert.equal(normalizeCountryLocation('Ciudad de México, México', mexico).countryCode, 'MX');
});

test('accepts configured cities with lower confidence', () => {
  const botswana = getCountryConfig('BW');
  const result = normalizeCountryLocation('Gaborone', botswana);

  assert.equal(result.accepted, true);
  assert.equal(result.countryCode, 'BW');
  assert.equal(result.reason, 'recognized-city');
  assert.ok(result.confidence < 1);
});

test('rejects ambiguous US New Mexico locations from the Mexico dataset', () => {
  const mexico = getCountryConfig('MX');

  for (const location of ['New Mexico', 'New Mexico, USA', 'Albuquerque, New Mexico']) {
    const result = normalizeCountryLocation(location, mexico);
    assert.equal(result.accepted, false, location);
    assert.equal(result.reason, 'excluded-location', location);
  }
});

test('rejects locations that explicitly name a different supported country', () => {
  const mexico = getCountryConfig('MX');
  const result = normalizeCountryLocation('Remote — USA / Mexico', mexico);

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'conflicting-country');
});

test('country search queries include country and city criteria', () => {
  const rwanda = getCountryConfig('RW');
  const queries = countrySearchQueries(rwanda);

  assert.ok(queries.some((query) => query.includes('Rwanda')));
  assert.ok(queries.some((query) => query.includes('Kigali')));
});
