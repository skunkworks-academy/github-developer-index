import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { publicCountryRegistry } from '../src/locations/countries.mjs';

const registry = [];

for (const country of publicCountryRegistry()) {
  const path = resolve('public', country.dataset);
  try {
    await access(path, constants.R_OK);
    const dataset = JSON.parse(await readFile(path, 'utf8'));
    if (dataset?.country?.code !== country.code || !Array.isArray(dataset?.developers)) {
      throw new Error(`Dataset contract mismatch for ${country.code}.`);
    }
    registry.push({
      ...country,
      status: dataset.generatedAt ? 'live' : 'pending',
      developersIndexed: dataset.developers.length,
      generatedAt: dataset.generatedAt ?? null
    });
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
}

await writeFile(
  resolve('public/data/countries.json'),
  `${JSON.stringify(registry, null, 2)}\n`,
  'utf8'
);

console.log(`Wrote ${registry.length} countries to public/data/countries.json.`);
