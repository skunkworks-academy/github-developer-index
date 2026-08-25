import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'public/index.html',
  'public/assets/app.js',
  'public/assets/styles.css',
  'public/data/countries.json',
  'public/data/ZA.json',
  'public/CNAME',
  'public/robots.txt',
  'public/sitemap.xml',
  'docs/ARCHITECTURE.md',
  'docs/METHODOLOGY.md'
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const indexHtml = await readFile('public/index.html', 'utf8');
const cname = (await readFile('public/CNAME', 'utf8')).trim();
const robots = await readFile('public/robots.txt', 'utf8');
const sitemap = await readFile('public/sitemap.xml', 'utf8');
const canonicalDomain = 'https://github.skunkworksacademy.com/';

if (cname !== 'github.skunkworksacademy.com') {
  throw new Error('public/CNAME must contain github.skunkworksacademy.com.');
}

const requiredHeadContent = [
  '<html lang="en-ZA">',
  `<link rel="canonical" href="${canonicalDomain}">`,
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
  '<meta property="og:title"',
  `<meta property="og:url" content="${canonicalDomain}">`,
  '<meta name="twitter:card"',
  'application/ld+json',
  'https://www.skunkworksacademy.com/images/favicon-black.png',
  'https://www.skunkworksacademy.com/images/favicon-white.png',
  'https://www.linkedin.com/company/skunkworksacademy/',
  'https://github.com/skunkworks-academy'
];

for (const expected of requiredHeadContent) {
  if (!indexHtml.includes(expected)) {
    throw new Error(`public/index.html is missing required SEO/domain content: ${expected}`);
  }
}

if (!robots.includes(`Sitemap: ${canonicalDomain}sitemap.xml`)) {
  throw new Error('public/robots.txt must advertise the custom-domain sitemap.');
}

if (!sitemap.includes(`<loc>${canonicalDomain}</loc>`)) {
  throw new Error('public/sitemap.xml must contain the canonical custom-domain URL.');
}

const countries = JSON.parse(await readFile('public/data/countries.json', 'utf8'));
if (!Array.isArray(countries) || !countries.some((country) => country.code === 'ZA')) {
  throw new Error('public/data/countries.json must contain ZA.');
}

function validateDataset(dataset, country) {
  const code = country.code;
  if (dataset.schemaVersion !== 1) throw new Error(`${code} dataset schemaVersion must be 1.`);
  if (dataset.country?.code !== code) {
    throw new Error(`${code} dataset country.code must be ${code}.`);
  }
  if (!Array.isArray(dataset.developers)) {
    throw new Error(`${code} dataset developers must be an array.`);
  }

  const availableYears = Array.isArray(dataset.availableYears)
    ? dataset.availableYears.map(Number)
    : [];
  if (availableYears.some((year) => !Number.isInteger(year) || year < 2008 || year > 3000)) {
    throw new Error(`${code} dataset availableYears contains an invalid year.`);
  }
  if (availableYears.length && !Array.isArray(dataset.calendarWindows)) {
    throw new Error(`${code} dataset calendarWindows must be present when availableYears is populated.`);
  }

  let previousScore = Infinity;
  let expectedRank = 1;
  const seen = new Set();

  for (const developer of dataset.developers) {
    if (!developer.login) {
      throw new Error(`${code} developer at rank ${expectedRank} is missing login.`);
    }
    if (seen.has(developer.login)) {
      throw new Error(`${code} duplicate login: ${developer.login}`);
    }
    seen.add(developer.login);

    if (developer.rank !== expectedRank) {
      throw new Error(
        `${code}: expected rank ${expectedRank}, received ${developer.rank} for ${developer.login}.`
      );
    }

    const score = Number(developer.scores?.overall);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`${code}: invalid overall score for ${developer.login}.`);
    }
    if (score > previousScore) {
      throw new Error(`${code} developers must be sorted by descending overall score.`);
    }

    for (const year of availableYears) {
      const activity = developer.metricsByYear?.[String(year)];
      if (!activity) throw new Error(`${code}: missing ${year} metrics for ${developer.login}.`);

      for (const field of ['contributions', 'commits', 'issues', 'pullRequests', 'reviews']) {
        const value = Number(activity[field]);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(`${code}: invalid ${year} ${field} for ${developer.login}.`);
        }
      }
    }

    previousScore = score;
    expectedRank += 1;
  }

  return { code, count: dataset.developers.length, years: availableYears.length };
}

const validated = [];
for (const country of countries) {
  if (!country?.code || !country?.dataset) {
    throw new Error('Every country registry entry requires code and dataset.');
  }

  const datasetPath = `public/${country.dataset}`;
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  validated.push(validateDataset(dataset, country));
}

console.log(
  `Validation passed for ${validated.length} country dataset(s): ` +
  validated.map((item) => `${item.code}=${item.count}`).join(', ')
);
console.log('Custom-domain SEO validation passed for github.skunkworksacademy.com.');
