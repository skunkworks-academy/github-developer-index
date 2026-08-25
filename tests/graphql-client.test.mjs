import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphQLClient, GitHubGraphQLError } from '../src/github/graphql-client.mjs';

function response(status, payload, headers = {}) {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
  );

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      }
    },
    async json() {
      return payload;
    }
  };
}

test('retries transient GitHub 502 responses and succeeds', async () => {
  const calls = [];
  const sleeps = [];
  const responses = [
    response(502, { message: 'Bad Gateway' }, { 'x-github-request-id': 'first' }),
    response(200, { data: { viewer: { login: 'octocat' } } }, { 'x-github-request-id': 'second' })
  ];

  const graphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async (...args) => {
      calls.push(args);
      return responses.shift();
    },
    sleep: async (ms) => { sleeps.push(ms); },
    random: () => 0,
    baseDelayMs: 10,
    maxDelayMs: 100,
    requestTimeoutMs: 1000
  });

  const data = await graphql('query { viewer { login } }');
  assert.equal(data.viewer.login, 'octocat');
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [10]);
});

test('honors Retry-After without truncating it to the ordinary backoff cap', async () => {
  const sleeps = [];
  let calls = 0;
  const graphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return response(429, { message: 'slow down' }, { 'retry-after': '30' });
      }
      return response(200, { data: { viewer: { login: 'octocat' } } });
    },
    sleep: async (ms) => { sleeps.push(ms); },
    random: () => 0,
    maxDelayMs: 100,
    requestTimeoutMs: 1000
  });

  assert.equal((await graphql('query { viewer { login } }')).viewer.login, 'octocat');
  assert.deepEqual(sleeps, [30000]);
});

test('waits for x-ratelimit-reset when the primary rate limit is depleted', async () => {
  const sleeps = [];
  let calls = 0;
  const now = Date.now();
  const resetEpochSeconds = Math.ceil((now + 60000) / 1000);

  const graphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return response(403, { message: 'API rate limit exceeded' }, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpochSeconds)
        });
      }
      return response(200, { data: { viewer: { login: 'octocat' } } });
    },
    sleep: async (ms) => { sleeps.push(ms); },
    random: () => 0,
    maxDelayMs: 100,
    requestTimeoutMs: 1000
  });

  assert.equal((await graphql('query { viewer { login } }')).viewer.login, 'octocat');
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] >= 59000, `expected a reset-aware delay, got ${sleeps[0]}ms`);
  assert.ok(sleeps[0] <= 62000, `expected a bounded reset-aware delay, got ${sleeps[0]}ms`);
});

test('does not retry permanent authentication failures', async () => {
  let calls = 0;
  const graphql = createGraphQLClient({
    token: 'bad-token',
    fetchImpl: async () => {
      calls += 1;
      return response(401, { message: 'Bad credentials' });
    },
    sleep: async () => {},
    requestTimeoutMs: 1000
  });

  await assert.rejects(
    () => graphql('query { viewer { login } }'),
    (error) => {
      assert.ok(error instanceof GitHubGraphQLError);
      assert.equal(error.details.status, 401);
      assert.equal(error.details.retryable, false);
      assert.equal(error.details.attempts, 1);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('retries transient network errors within a bounded attempt count', async () => {
  let calls = 0;
  const graphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) throw new TypeError('fetch failed');
      return response(200, { data: { rateLimit: { remaining: 42 } } });
    },
    sleep: async () => {},
    random: () => 0,
    maxAttempts: 3,
    baseDelayMs: 1,
    maxDelayMs: 2,
    requestTimeoutMs: 1000
  });

  const data = await graphql('query { rateLimit { remaining } }');
  assert.equal(data.rateLimit.remaining, 42);
  assert.equal(calls, 3);
});

test('retries transient GraphQL INTERNAL errors but not validation errors', async () => {
  let calls = 0;
  const graphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return response(200, { errors: [{ type: 'INTERNAL', message: 'Something went wrong' }] });
      }
      return response(200, { data: { viewer: { login: 'octocat' } } });
    },
    sleep: async () => {},
    random: () => 0,
    requestTimeoutMs: 1000
  });

  assert.equal((await graphql('query { viewer { login } }')).viewer.login, 'octocat');
  assert.equal(calls, 2);

  let validationCalls = 0;
  const invalidGraphql = createGraphQLClient({
    token: 'test-token',
    fetchImpl: async () => {
      validationCalls += 1;
      return response(200, { errors: [{ type: 'GRAPHQL_VALIDATION_FAILED', message: 'Unknown field' }] });
    },
    sleep: async () => {},
    requestTimeoutMs: 1000
  });

  await assert.rejects(() => invalidGraphql('query { missing }'), GitHubGraphQLError);
  assert.equal(validationCalls, 1);
});
