const EXPLICIT_COUNTRY_PATTERNS = [
  /\bsouth\s*africa\b/i,
  /\brepublic\s+of\s+south\s+africa\b/i,
  /\brsa\b/i,
  /\bzaf\b/i,
  /🇿🇦/u
];

const REGIONAL_PATTERNS = [
  ['Gauteng', /\bgauteng\b/i],
  ['Western Cape', /\bwestern\s+cape\b/i],
  ['Eastern Cape', /\beastern\s+cape\b/i],
  ['Northern Cape', /\bnorthern\s+cape\b/i],
  ['KwaZulu-Natal', /\b(?:kwazulu[-\s]?natal|kzn)\b/i],
  ['Free State', /\bfree\s+state\b/i],
  ['Limpopo', /\blimpopo\b/i],
  ['Mpumalanga', /\bmpumalanga\b/i],
  ['North West', /\bnorth\s+west(?:\s+province)?\b/i]
];

const CITY_PATTERNS = [
  ['Johannesburg', /\b(?:johannesburg|joburg|jozi|jhb)\b/i],
  ['Cape Town', /\bcape\s+town\b/i],
  ['Pretoria', /\bpretoria\b/i],
  ['Durban', /\bdurban\b/i],
  ['Gqeberha', /\b(?:gqeberha|port\s+elizabeth)\b/i],
  ['Bloemfontein', /\bbloemfontein\b/i],
  ['Polokwane', /\bpolokwane\b/i],
  ['Mbombela', /\b(?:mbombela|nelspruit)\b/i],
  ['East London', /\beast\s+london\b/i],
  ['Stellenbosch', /\bstellenbosch\b/i],
  ['Centurion', /\bcenturion\b/i],
  ['Sandton', /\bsandton\b/i],
  ['Midrand', /\bmidrand\b/i]
];

export const SOUTH_AFRICA_SEARCH_QUERIES = [
  'location:"South Africa" type:user',
  'location:Johannesburg type:user',
  'location:"Cape Town" type:user',
  'location:Pretoria type:user',
  'location:Durban type:user',
  'location:Gauteng type:user',
  'location:"Western Cape" type:user'
];

export function normalizeSouthAfricaLocation(rawLocation) {
  if (typeof rawLocation !== 'string' || !rawLocation.trim()) {
    return {
      accepted: false,
      countryCode: null,
      country: null,
      city: null,
      region: null,
      confidence: 0,
      reason: 'missing-location'
    };
  }

  const location = rawLocation.trim();

  if (EXPLICIT_COUNTRY_PATTERNS.some((pattern) => pattern.test(location))) {
    const city = CITY_PATTERNS.find(([, pattern]) => pattern.test(location))?.[0] ?? null;
    const region = REGIONAL_PATTERNS.find(([, pattern]) => pattern.test(location))?.[0] ?? null;
    return {
      accepted: true,
      countryCode: 'ZA',
      country: 'South Africa',
      city,
      region,
      confidence: 1,
      reason: 'explicit-country'
    };
  }

  const region = REGIONAL_PATTERNS.find(([, pattern]) => pattern.test(location))?.[0] ?? null;
  if (region) {
    return {
      accepted: true,
      countryCode: 'ZA',
      country: 'South Africa',
      city: CITY_PATTERNS.find(([, pattern]) => pattern.test(location))?.[0] ?? null,
      region,
      confidence: 0.92,
      reason: 'recognized-province'
    };
  }

  const city = CITY_PATTERNS.find(([, pattern]) => pattern.test(location))?.[0] ?? null;
  if (city) {
    return {
      accepted: true,
      countryCode: 'ZA',
      country: 'South Africa',
      city,
      region: null,
      confidence: 0.86,
      reason: 'recognized-city'
    };
  }

  return {
    accepted: false,
    countryCode: null,
    country: null,
    city: null,
    region: null,
    confidence: 0,
    reason: 'unresolved-location'
  };
}
