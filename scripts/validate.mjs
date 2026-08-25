import { readFile } from 'node:fs/promises';
import { validateDataset, validateRegistryEntry } from '../src/validation/dataset.mjs';

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

const seenCountryCodes = new Set();
const validated = [];
for (const country of countries) {
  if (!country?.code || !country?.dataset) {
    throw new Error('Every country registry entry requires code and dataset.');
  }
  if (seenCountryCodes.has(country.code)) {
    throw new Error(`Duplicate country registry code: ${country.code}.`);
  }
  seenCountryCodes.add(country.code);

  const datasetPath = `public/${country.dataset}`;
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  const datasetResult = validateDataset(dataset, country);
  validateRegistryEntry(country, dataset);
  validated.push(datasetResult);
}

console.log(
  `Validation passed for ${validated.length} country dataset(s): ` +
  validated.map((item) => `${item.code}=${item.count}`).join(', ')
);
console.log('Country registry metadata is synchronized with every dataset.');
console.log('Custom-domain SEO validation passed for github.skunkworksacademy.com.');
