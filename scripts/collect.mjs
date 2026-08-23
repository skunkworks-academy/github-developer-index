import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { collectSouthAfrica } from '../src/github/collect-south-africa.mjs';
import { METHODOLOGY_VERSION, SCORE_WEIGHTS, rankDevelopers } from '../src/ranking/score.mjs';

const countryCode = String(process.argv[2] ?? 'ZA').toUpperCase();
if (countryCode !== 'ZA') {
  throw new Error(`Foundation release only supports ZA. Received: ${countryCode}`);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GH_TOKEN or GITHUB_TOKEN is required to collect GitHub data.');
}

const generatedAt = new Date();
const collection = await collectSouthAfrica({ token, now: generatedAt });
const ranked = rankDevelopers(collection.developers);

const output = {
  schemaVersion: 1,
  generatedAt: generatedAt.toISOString(),
  source: {
    provider: 'GitHub',
    api: 'GraphQL',
    officialLeaderboard: false
  },
  country: {
    code: 'ZA',
    name: 'South Africa'
  },
  methodology: {
    version: METHODOLOGY_VERSION,
    weights: SCORE_WEIGHTS,
    windowDays: 365,
    notes: [
      'Candidate discovery uses GitHub user search location qualifiers.',
      'Country resolution uses explicit South Africa aliases plus recognized cities/provinces.',
      'Repository impact samples up to the 100 most-starred public repositories owned by each user.',
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

const target = resolve('public/data/ZA.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${ranked.length} ranked South African developers to ${target} ` +
  `(${collection.discoveredCandidates} discovered candidates).`
);
