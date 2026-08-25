const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class GitHubGraphQLError extends Error {
  constructor(message, details = {}, options = {}) {
    super(message, options);
    this.name = 'GitHubGraphQLError';
    this.details = details;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value, now = Date.now()) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(timestamp - now, 0) : null;
}

function retryDelayMs({ attempt, baseDelayMs, maxDelayMs, retryAfter, random }) {
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return Math.min(retryAfterMs, maxDelayMs);

  const exponential = Math.min(baseDelayMs * (2 ** Math.max(attempt - 1, 0)), maxDelayMs);
  const jitter = Math.floor(exponential * 0.2 * random());
  return Math.min(exponential + jitter, maxDelayMs);
}

function isRetryableGraphQLError(errors = []) {
  return errors.some((error) => {
    const type = String(error?.type ?? '').toUpperCase();
    const message = String(error?.message ?? '').toLowerCase();
    return type === 'INTERNAL'
      || type === 'RATE_LIMITED'
      || message.includes('something went wrong')
      || message.includes('temporarily unavailable')
      || message.includes('timeout')
      || message.includes('timed out');
  });
}

function isRetryableHttpResponse(response) {
  if (RETRYABLE_HTTP_STATUSES.has(response.status)) return true;

  if (response.status === 403) {
    const retryAfter = response.headers.get('retry-after');
    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    return Boolean(retryAfter) || rateRemaining === '0';
  }

  return false;
}

function responseDetails(response, payload, attempt, retryable) {
  return {
    status: response.status,
    requestId: response.headers.get('x-github-request-id'),
    rateRemaining: response.headers.get('x-ratelimit-remaining'),
    rateReset: response.headers.get('x-ratelimit-reset'),
    retryAfter: response.headers.get('retry-after'),
    payload,
    attempt,
    retryable
  };
}

export function createGraphQLClient({
  token,
  userAgent = 'skunkworks-academy-github-developer-index',
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  random = Math.random,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
} = {}) {
  if (!token) {
    throw new Error('A GitHub token is required. Set GH_TOKEN or GITHUB_TOKEN.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  const safeMaxAttempts = Math.min(Math.max(Number(maxAttempts) || 1, 1), 8);
  const safeBaseDelayMs = Math.max(Number(baseDelayMs) || 0, 0);
  const safeMaxDelayMs = Math.max(Number(maxDelayMs) || safeBaseDelayMs, safeBaseDelayMs);
  const safeTimeoutMs = Math.max(Number(requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS, 1000);

  return async function graphql(query, variables = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), safeTimeoutMs);

      try {
        const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'user-agent': userAgent,
            'x-github-api-version': '2022-11-28'
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => null);
        const retryable = isRetryableHttpResponse(response);
        const details = responseDetails(response, payload, attempt, retryable);

        if (!response.ok) {
          const error = new GitHubGraphQLError(
            `GitHub GraphQL request failed with HTTP ${response.status}.`,
            details
          );

          if (!retryable || attempt === safeMaxAttempts) {
            error.details.attempts = attempt;
            throw error;
          }

          lastError = error;
          await sleep(retryDelayMs({
            attempt,
            baseDelayMs: safeBaseDelayMs,
            maxDelayMs: safeMaxDelayMs,
            retryAfter: details.retryAfter,
            random
          }));
          continue;
        }

        if (!payload || typeof payload !== 'object') {
          throw new GitHubGraphQLError('GitHub GraphQL returned an invalid JSON payload.', {
            ...details,
            retryable: false,
            attempts: attempt
          });
        }

        if (payload.errors?.length) {
          const graphqlRetryable = isRetryableGraphQLError(payload.errors);
          const error = new GitHubGraphQLError(
            `GitHub GraphQL returned ${payload.errors.length} error(s): ${payload.errors.map((item) => item.message).join('; ')}`,
            {
              ...details,
              errors: payload.errors,
              retryable: graphqlRetryable
            }
          );

          if (!graphqlRetryable || attempt === safeMaxAttempts) {
            error.details.attempts = attempt;
            throw error;
          }

          lastError = error;
          await sleep(retryDelayMs({
            attempt,
            baseDelayMs: safeBaseDelayMs,
            maxDelayMs: safeMaxDelayMs,
            retryAfter: details.retryAfter,
            random
          }));
          continue;
        }

        return payload.data ?? {};
      } catch (error) {
        if (error instanceof GitHubGraphQLError) {
          throw error;
        }

        const retryable = error?.name === 'AbortError'
          || error instanceof TypeError
          || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(error?.code);
        const wrapped = new GitHubGraphQLError(
          error?.name === 'AbortError'
            ? `GitHub GraphQL request timed out after ${safeTimeoutMs}ms.`
            : `GitHub GraphQL network request failed: ${error?.message ?? String(error)}`,
          {
            attempt,
            attempts: attempt,
            retryable,
            networkCode: error?.code ?? null
          },
          { cause: error }
        );

        if (!retryable || attempt === safeMaxAttempts) {
          throw wrapped;
        }

        lastError = wrapped;
        await sleep(retryDelayMs({
          attempt,
          baseDelayMs: safeBaseDelayMs,
          maxDelayMs: safeMaxDelayMs,
          retryAfter: null,
          random
        }));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new GitHubGraphQLError('GitHub GraphQL request failed without a response.', {
      attempts: safeMaxAttempts,
      retryable: false
    });
  };
}
