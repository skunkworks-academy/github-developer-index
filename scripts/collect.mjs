import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { collectSouthAfrica } from '../src/github/collect-south-africa.mjs';
import { collectCountry } from '../src/github/collect-country.mjs';
import { getCountryConfig } from '../src/locations/countries.mjs';
import { METHODOLOGY_VERSION, SCORE_WEIGHTS, rankDevelopers } from '../src/ranking/score.mjs';
import { validateDataset } from '../src/validation/dataset.mjs';

const countryCode = String(process.argv[2] ?? 'ZA').toUpperCase();
const countryConfig = getCountryConfig(countryCode);
if (!countryConfig) {
  throw new Error(`Unsupported country code: ${countryCode}`);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GH_TOKEN or GITHUB_TOKEN is required to collect GitHub data.');
}

const defaultMaxCandidates = countryCode === 'ZA' ? 500 : 60;
const configuredMaxCandidates = Number.parseInt(
  process.env.MAX_CANDIDATES ?? String(defaultMaxCandidates),
  10
);
const maxCandidates = Number.isFinite(configuredMaxCandidates)
  ? Math.min(Math.max(configuredMaxCandidates, 1), 1000)
  : defaultMaxCandidates;

const configuredHistoryYears = Number.parseInt(process.env.HISTORY_YEARS ?? '5', 10);
const historyYears = Number.isFinite(configuredHistoryYears)
  ? Math.min(Math.max(configuredHistoryYears, 1), 10)
  : 5;

const generatedAt = new Date();
const collection = countryCode === 'ZA'
  ? await collectSouthAfrica({ token, now: generatedAt, maxCandidates, historyYears })
  : await collectCountry({
      token,
      countryCode,
      now: generatedAt,
      maxCandidates,
      historyYears
    });

const ranked = rankDevelopers(collection.developers);
if (!collection.discoveredCandidates || ranked.length === 0) {
  throw new Error(
    `Refusing to publish an empty ${countryConfig.name} dataset ` +
    `(${collection.discoveredCandidates ?? 0} discovered, ${ranked.length} accepted).`
  );
}

const calendarYears = collection.calendarYears ?? [];
const output = {
  schemaVersion: 1,
  generatedAt: generatedAt.toISOString(),
  source: {
    provider: 'GitHub',
    api: 'GraphQL',
    officialLeaderboard: false
  },
  country: {
    code: countryConfig.code,
    name: countryConfig.name
  },
  availableYears: calendarYears.map((window) => window.year),
  calendarWindows: calendarYears,
  methodology: {
    version: METHODOLOGY_VERSION,
    weights: SCORE_WEIGHTS,
    windowDays: 365,
    notes: [
      'Candidate discovery uses GitHub user search location qualifiers.',
      'Country resolution uses explicit country aliases plus a bounded set of recognized cities.',
      'Ambiguous or conflicting country locations are rejected rather than guessed.',
      'Repository impact samples up to the 100 most-starred public repositories owned by each user.',
      'Calendar-year filters use GitHub contribution activity for the selected year; current stars and followers are not historical snapshots.',
      'The index is independent and is not an official GitHub ranking.'
    ]
  },
  collection: {
    discoveredCandidates: collection.discoveredCandidates,
    acceptedCandidates: collection.acceptedCandidates,
    rejectedCandidates: collection.rejectedCandidates,
    window: collection.window
  },
  developers: ranked
};

validateDataset(output, countryConfig);

const target = resolve(`public/data/${countryCode}.json`);
const temporaryTarget = `${target}.tmp-${process.pid}-${Date.now()}`;
await mkdir(dirname(target), { recursive: true });

try {
  await writeFile(temporaryTarget, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await rename(temporaryTarget, target);
} finally {
  await rm(temporaryTarget, { force: true }).catch(() => {});
}

console.log(
  `Wrote ${ranked.length} ranked ${countryConfig.name} developers to ${target} ` +
  `(${collection.discoveredCandidates} discovered candidates; ` +
  `${output.availableYears.length} calendar years).`
);
