const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

export class GitHubGraphQLError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubGraphQLError';
    this.details = details;
  }
}

export function createGraphQLClient({ token, userAgent = 'skunkworks-academy-github-developer-index' } = {}) {
  if (!token) {
    throw new Error('A GitHub token is required. Set GH_TOKEN or GITHUB_TOKEN.');
  }

  return async function graphql(query, variables = {}) {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': userAgent,
        'x-github-api-version': '2022-11-28'
      },
      body: JSON.stringify({ query, variables })
    });

    const requestId = response.headers.get('x-github-request-id');
    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new GitHubGraphQLError(`GitHub GraphQL request failed with HTTP ${response.status}.`, {
        status: response.status,
        requestId,
        rateRemaining,
        payload
      });
    }

    if (payload?.errors?.length) {
      throw new GitHubGraphQLError(
        `GitHub GraphQL returned ${payload.errors.length} error(s): ${payload.errors.map((error) => error.message).join('; ')}`,
        { requestId, rateRemaining, errors: payload.errors }
      );
    }

    return payload?.data ?? {};
  };
}
