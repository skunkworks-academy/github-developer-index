import { createGraphQLClient } from './graphql-client.mjs';
import {
  normalizeSouthAfricaLocation,
  SOUTH_AFRICA_SEARCH_QUERIES
} from '../locations/south-africa.mjs';

const SEARCH_USERS = `
  query SearchUsers($query: String!, $cursor: String) {
    search(query: $query, type: USER, first: 100, after: $cursor) {
      userCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on User {
          login
          location
        }
      }
    }
    rateLimit { cost remaining resetAt }
  }
`;

const USER_METRICS = `
  query UserMetrics($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      avatarUrl
      url
      bio
      company
      location
      createdAt
      followers { totalCount }
      repositories(
        first: 100,
        ownerAffiliations: OWNER,
        privacy: PUBLIC,
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        totalCount
        nodes {
          stargazerCount
          forkCount
          isFork
          isArchived
        }
      }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { totalContributions }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
      }
    }
    rateLimit { cost remaining resetAt }
  }
`;

function isoWindow365d(now = new Date()) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function searchCandidateLogins(graphql, query, maxResults = 200) {
  const logins = new Set();
  let cursor = null;
  let pages = 0;

  do {
    const data = await graphql(SEARCH_USERS, { query, cursor });
    const search = data.search;
    if (!search) break;

    for (const node of search.nodes ?? []) {
      if (node?.login) logins.add(node.login);
      if (logins.size >= maxResults) break;
    }

    cursor = search.pageInfo?.hasNextPage ? search.pageInfo.endCursor : null;
    pages += 1;
  } while (cursor && pages < 10 && logins.size < maxResults);

  return logins;
}

function summarizeRepositories(repositoryConnection) {
  const repositories = repositoryConnection?.nodes ?? [];
  const originalRepositories = repositories.filter((repo) => repo && !repo.isFork);

  return {
    publicRepositories: Number(repositoryConnection?.totalCount ?? 0),
    repositoriesSampled: repositories.length,
    repoStatsTruncated: Number(repositoryConnection?.totalCount ?? 0) > repositories.length,
    starsReceived: originalRepositories.reduce((sum, repo) => sum + Number(repo.stargazerCount ?? 0), 0),
    forksReceived: originalRepositories.reduce((sum, repo) => sum + Number(repo.forkCount ?? 0), 0),
    archivedRepositoriesSampled: originalRepositories.filter((repo) => repo.isArchived).length
  };
}

function toDeveloperRecord(user) {
  const normalizedLocation = normalizeSouthAfricaLocation(user.location);
  if (!normalizedLocation.accepted) return null;

  const contributions = user.contributionsCollection ?? {};
  const repositories = summarizeRepositories(user.repositories);

  return {
    login: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatarUrl,
    profileUrl: user.url,
    bio: user.bio ?? null,
    company: user.company ?? null,
    accountCreatedAt: user.createdAt,
    location: {
      raw: user.location,
      ...normalizedLocation
    },
    metrics: {
      followers: Number(user.followers?.totalCount ?? 0),
      contributions365d: Number(contributions.contributionCalendar?.totalContributions ?? 0),
      commits365d: Number(contributions.totalCommitContributions ?? 0),
      issues365d: Number(contributions.totalIssueContributions ?? 0),
      pullRequests365d: Number(contributions.totalPullRequestContributions ?? 0),
      reviews365d: Number(contributions.totalPullRequestReviewContributions ?? 0),
      restrictedContributions365d: Number(contributions.restrictedContributionsCount ?? 0),
      ...repositories
    }
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function collectSouthAfrica({ token, now = new Date(), concurrency = 4, maxCandidates = 500 } = {}) {
  const graphql = createGraphQLClient({ token });
  const candidateLogins = new Set();

  for (const query of SOUTH_AFRICA_SEARCH_QUERIES) {
    if (candidateLogins.size >= maxCandidates) break;

    const remaining = maxCandidates - candidateLogins.size;
    const discovered = await searchCandidateLogins(graphql, query, Math.min(remaining, 200));
    for (const login of discovered) {
      candidateLogins.add(login);
      if (candidateLogins.size >= maxCandidates) break;
    }
  }

  const { from, to } = isoWindow365d(now);
  const logins = [...candidateLogins].sort((a, b) => a.localeCompare(b));

  const enriched = await mapWithConcurrency(logins, concurrency, async (login) => {
    const data = await graphql(USER_METRICS, { login, from, to });
    return data.user ? toDeveloperRecord(data.user) : null;
  });

  const developers = enriched.filter(Boolean);

  return {
    discoveredCandidates: logins.length,
    acceptedCandidates: developers.length,
    rejectedCandidates: logins.length - developers.length,
    window: { from, to },
    developers
  };
}
