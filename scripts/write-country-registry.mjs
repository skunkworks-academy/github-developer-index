import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { publicCountryRegistry } from '../src/locations/countries.mjs';
import { validateDataset } from '../src/validation/dataset.mjs';

const registry = [];

for (const country of publicCountryRegistry()) {
  const path = resolve('public', country.dataset);
  try {
    await access(path, constants.R_OK);
    const dataset = JSON.parse(await readFile(path, 'utf8'));
    validateDataset(dataset, country);

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

const target = resolve('public/data/countries.json');
const temporaryTarget = `${target}.tmp-${process.pid}-${Date.now()}`;

try {
  await writeFile(temporaryTarget, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await rename(temporaryTarget, target);
} finally {
  await rm(temporaryTarget, { force: true }).catch(() => {});
}

console.log(`Wrote ${registry.length} countries to public/data/countries.json.`);
