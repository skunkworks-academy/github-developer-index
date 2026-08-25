const ACTIVITY_FIELDS = ['contributions', 'commits', 'issues', 'pullRequests', 'reviews'];
const CURRENT_METRIC_FIELDS = [
  'followers',
  'contributions365d',
  'commits365d',
  'issues365d',
  'pullRequests365d',
  'reviews365d',
  'restrictedContributions365d',
  'publicRepositories',
  'repositoriesSampled',
  'starsReceived',
  'forksReceived',
  'archivedRepositoriesSampled'
];

function assertNonNegativeNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(message);
  }
}

export function validateDataset(dataset, country) {
  const code = country?.code;
  if (!code) throw new Error('Dataset validation requires a country code.');
  if (!dataset || typeof dataset !== 'object') throw new Error(`${code} dataset must be an object.`);
  if (dataset.schemaVersion !== 1) throw new Error(`${code} dataset schemaVersion must be 1.`);
  if (dataset.country?.code !== code) {
    throw new Error(`${code} dataset country.code must be ${code}.`);
  }
  if (!Array.isArray(dataset.developers)) {
    throw new Error(`${code} dataset developers must be an array.`);
  }

  if (dataset.generatedAt !== null && dataset.generatedAt !== undefined) {
    const generatedAt = Date.parse(dataset.generatedAt);
    if (!Number.isFinite(generatedAt)) {
      throw new Error(`${code} dataset generatedAt must be a valid timestamp or null.`);
    }
  }

  const availableYears = Array.isArray(dataset.availableYears)
    ? dataset.availableYears.map(Number)
    : [];
  if (availableYears.some((year) => !Number.isInteger(year) || year < 2008 || year > 3000)) {
    throw new Error(`${code} dataset availableYears contains an invalid year.`);
  }
  if (new Set(availableYears).size !== availableYears.length) {
    throw new Error(`${code} dataset availableYears must not contain duplicates.`);
  }
  if (availableYears.length && !Array.isArray(dataset.calendarWindows)) {
    throw new Error(`${code} dataset calendarWindows must be present when availableYears is populated.`);
  }

  let previousScore = Infinity;
  let expectedRank = 1;
  const seen = new Set();

  for (const developer of dataset.developers) {
    if (!developer?.login) {
      throw new Error(`${code} developer at rank ${expectedRank} is missing login.`);
    }
    if (seen.has(developer.login)) {
      throw new Error(`${code} duplicate login: ${developer.login}`);
    }
    seen.add(developer.login);

    if (developer.rank !== expectedRank) {
      throw new Error(`${code}: expected rank ${expectedRank}, received ${developer.rank} for ${developer.login}.`);
    }

    const score = Number(developer.scores?.overall);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`${code}: invalid overall score for ${developer.login}.`);
    }
    if (score > previousScore) {
      throw new Error(`${code} developers must be sorted by descending overall score.`);
    }

    if (developer.location?.accepted && developer.location?.countryCode !== code) {
      throw new Error(`${code}: ${developer.login} has mismatched location countryCode ${developer.location?.countryCode}.`);
    }

    for (const field of CURRENT_METRIC_FIELDS) {
      assertNonNegativeNumber(
        developer.metrics?.[field] ?? 0,
        `${code}: invalid ${field} for ${developer.login}.`
      );
    }

    for (const year of availableYears) {
      const activity = developer.metricsByYear?.[String(year)];
      if (!activity) throw new Error(`${code}: missing ${year} metrics for ${developer.login}.`);

      for (const field of ACTIVITY_FIELDS) {
        assertNonNegativeNumber(
          activity[field],
          `${code}: invalid ${year} ${field} for ${developer.login}.`
        );
      }
    }

    previousScore = score;
    expectedRank += 1;
  }

  return { code, count: dataset.developers.length, years: availableYears.length };
}

export function validateRegistryEntry(country, dataset) {
  const code = country?.code;
  if (!code) throw new Error('Registry validation requires a country code.');

  const live = Boolean(dataset?.generatedAt);
  const expectedStatus = live ? 'live' : 'pending';
  if (country.status !== expectedStatus) {
    throw new Error(`${code} registry status must be ${expectedStatus}.`);
  }

  const expectedCount = Array.isArray(dataset?.developers) ? dataset.developers.length : 0;
  if (Number(country.developersIndexed ?? 0) !== expectedCount) {
    throw new Error(`${code} registry developersIndexed must equal dataset developer count (${expectedCount}).`);
  }

  const registryGeneratedAt = country.generatedAt ?? null;
  const datasetGeneratedAt = dataset?.generatedAt ?? null;
  if (registryGeneratedAt !== datasetGeneratedAt) {
    throw new Error(`${code} registry generatedAt must match the dataset generatedAt timestamp.`);
  }

  return { code, status: expectedStatus, count: expectedCount, generatedAt: datasetGeneratedAt };
}
