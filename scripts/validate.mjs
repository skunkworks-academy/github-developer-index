import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'public/index.html',
  'public/assets/app.js',
  'public/assets/styles.css',
  'public/data/countries.json',
  'public/data/ZA.json',
  'docs/ARCHITECTURE.md',
  'docs/METHODOLOGY.md'
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const countries = JSON.parse(await readFile('public/data/countries.json', 'utf8'));
if (!Array.isArray(countries) || !countries.some((country) => country.code === 'ZA')) {
  throw new Error('public/data/countries.json must contain ZA.');
}

const za = JSON.parse(await readFile('public/data/ZA.json', 'utf8'));
if (za.schemaVersion !== 1) throw new Error('ZA dataset schemaVersion must be 1.');
if (za.country?.code !== 'ZA') throw new Error('ZA dataset country.code must be ZA.');
if (!Array.isArray(za.developers)) throw new Error('ZA dataset developers must be an array.');

const availableYears = Array.isArray(za.availableYears) ? za.availableYears.map(Number) : [];
if (availableYears.some((year) => !Number.isInteger(year) || year < 2008 || year > 3000)) {
  throw new Error('ZA dataset availableYears contains an invalid year.');
}
if (availableYears.length && !Array.isArray(za.calendarWindows)) {
  throw new Error('ZA dataset calendarWindows must be present when availableYears is populated.');
}

let previousScore = Infinity;
let expectedRank = 1;
const seen = new Set();

for (const developer of za.developers) {
  if (!developer.login) throw new Error(`Developer at rank ${expectedRank} is missing login.`);
  if (seen.has(developer.login)) throw new Error(`Duplicate login: ${developer.login}`);
  seen.add(developer.login);

  if (developer.rank !== expectedRank) {
    throw new Error(`Expected rank ${expectedRank}, received ${developer.rank} for ${developer.login}.`);
  }

  const score = Number(developer.scores?.overall);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`Invalid overall score for ${developer.login}.`);
  }
  if (score > previousScore) throw new Error('ZA developers must be sorted by descending overall score.');

  for (const year of availableYears) {
    const activity = developer.metricsByYear?.[String(year)];
    if (!activity) throw new Error(`Missing ${year} metrics for ${developer.login}.`);

    for (const field of ['contributions', 'commits', 'issues', 'pullRequests', 'reviews']) {
      const value = Number(activity[field]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid ${year} ${field} for ${developer.login}.`);
      }
    }
  }

  previousScore = score;
  expectedRank += 1;
}

console.log(
  `Validation passed: ${za.developers.length} ZA developer records` +
  `${availableYears.length ? ` across ${availableYears.length} calendar years` : ''}.`
);
