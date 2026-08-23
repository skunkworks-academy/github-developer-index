export const COUNTRY_CONFIGS = Object.freeze({
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    aliases: ['South Africa', 'Republic of South Africa', 'RSA', 'ZAF'],
    cities: ['Johannesburg', 'Cape Town', 'Pretoria', 'Durban', 'Gqeberha', 'Bloemfontein', 'Polokwane', 'Mbombela', 'Stellenbosch']
  },
  BW: { code: 'BW', name: 'Botswana', aliases: ['Botswana'], cities: ['Gaborone', 'Francistown'] },
  CM: { code: 'CM', name: 'Cameroon', aliases: ['Cameroon', 'Cameroun'], cities: ['Douala', 'Yaounde', 'Yaoundé'] },
  RW: { code: 'RW', name: 'Rwanda', aliases: ['Rwanda'], cities: ['Kigali'] },
  NG: { code: 'NG', name: 'Nigeria', aliases: ['Nigeria'], cities: ['Lagos', 'Abuja', 'Port Harcourt'] },
  KE: { code: 'KE', name: 'Kenya', aliases: ['Kenya'], cities: ['Nairobi', 'Mombasa'] },
  GH: { code: 'GH', name: 'Ghana', aliases: ['Ghana'], cities: ['Accra', 'Kumasi'] },
  EG: { code: 'EG', name: 'Egypt', aliases: ['Egypt'], cities: ['Cairo', 'Alexandria'] },
  MA: { code: 'MA', name: 'Morocco', aliases: ['Morocco', 'Maroc'], cities: ['Casablanca', 'Rabat', 'Marrakesh', 'Marrakech'] },
  PT: { code: 'PT', name: 'Portugal', aliases: ['Portugal'], cities: ['Lisbon', 'Lisboa', 'Porto'] },
  MX: { code: 'MX', name: 'Mexico', aliases: ['Mexico', 'México'], cities: ['Mexico City', 'Ciudad de México', 'Guadalajara', 'Monterrey'] },
  US: { code: 'US', name: 'United States', aliases: ['United States', 'United States of America', 'USA'], cities: ['New York', 'San Francisco', 'Seattle', 'Austin', 'Boston'] },
  GB: { code: 'GB', name: 'United Kingdom', aliases: ['United Kingdom', 'UK', 'Great Britain'], cities: ['London', 'Manchester', 'Edinburgh', 'Bristol'] },
  CA: { code: 'CA', name: 'Canada', aliases: ['Canada'], cities: ['Toronto', 'Vancouver', 'Montreal', 'Montréal'] },
  DE: { code: 'DE', name: 'Germany', aliases: ['Germany', 'Deutschland'], cities: ['Berlin', 'Munich', 'München', 'Hamburg'] },
  FR: { code: 'FR', name: 'France', aliases: ['France'], cities: ['Paris', 'Lyon', 'Toulouse'] },
  NL: { code: 'NL', name: 'Netherlands', aliases: ['Netherlands', 'Nederland'], cities: ['Amsterdam', 'Rotterdam', 'Utrecht'] },
  IN: { code: 'IN', name: 'India', aliases: ['India'], cities: ['Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'] },
  BR: { code: 'BR', name: 'Brazil', aliases: ['Brazil', 'Brasil'], cities: ['São Paulo', 'Sao Paulo', 'Rio de Janeiro', 'Belo Horizonte'] },
  AU: { code: 'AU', name: 'Australia', aliases: ['Australia'], cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCountryConfig(code) {
  return COUNTRY_CONFIGS[String(code ?? '').toUpperCase()] ?? null;
}

export function countrySearchQueries(config) {
  if (!config) return [];

  const queries = [`location:\"${config.name}\" type:user`];
  for (const alias of config.aliases ?? []) {
    if (alias.toLowerCase() !== config.name.toLowerCase()) {
      queries.push(`location:\"${alias}\" type:user`);
    }
  }
  for (const city of config.cities ?? []) {
    queries.push(`location:\"${city}\" type:user`);
  }

  return [...new Set(queries)];
}

export function normalizeCountryLocation(rawLocation, config) {
  const base = {
    accepted: false,
    countryCode: null,
    country: null,
    city: null,
    region: null,
    confidence: 0,
    reason: 'unresolved-location'
  };

  if (!config) return { ...base, reason: 'unsupported-country' };
  if (typeof rawLocation !== 'string' || !rawLocation.trim()) {
    return { ...base, reason: 'missing-location' };
  }

  const location = rawLocation.trim();
  const aliases = [config.name, ...(config.aliases ?? [])];
  const countryPattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:${aliases.map(escapeRegex).join('|')})(?:$|[^\\p{L}\\p{N}])`,
    'iu'
  );
  const matchedCity = (config.cities ?? []).find((city) =>
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapeRegex(city)}(?:$|[^\\p{L}\\p{N}])`,
      'iu'
    ).test(location)
  ) ?? null;

  if (countryPattern.test(location)) {
    return {
      accepted: true,
      countryCode: config.code,
      country: config.name,
      city: matchedCity,
      region: null,
      confidence: 1,
      reason: 'explicit-country'
    };
  }

  if (matchedCity) {
    return {
      accepted: true,
      countryCode: config.code,
      country: config.name,
      city: matchedCity,
      region: null,
      confidence: 0.84,
      reason: 'recognized-city'
    };
  }

  return base;
}

export function publicCountryRegistry() {
  return Object.values(COUNTRY_CONFIGS)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ code, name }) => ({
      code,
      name,
      status: code === 'ZA' ? 'live' : 'supported',
      dataset: `data/${code}.json`
    }));
}
