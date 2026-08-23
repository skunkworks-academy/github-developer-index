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

function contributionFields(alias, fromVariable, toVariable) {
  return `
      ${alias}: contributionsCollection(from: $${fromVariable}, to: $${toVariable}) {
        contributionCalendar { totalContributions }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
      }`;
}

function buildUserMetricsQuery(yearWindows) {
  const yearVariables = yearWindows
    .map((_, index) => `$yearFrom${index}: DateTime!, $yearTo${index}: DateTime!`)
    .join(', ');

  const yearFields = yearWindows
    .map((_, index) => contributionFields(`year${index}`, `yearFrom${index}`, `yearTo${index}`))
    .join('\n');

  return `
    query UserMetrics(
      $login: String!,
      $from: DateTime!,
      $to: DateTime!${yearVariables ? `, ${yearVariables}` : ''}
    ) {
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
        ${contributionFields('contributions365d', 'from', 'to')}
        ${yearFields}
      }
      rateLimit { cost remaining resetAt }
    }
  `;
}

function isoWindow365d(now = new Date()) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function calendarYearWindows(now = new Date(), count = 5) {
  const currentYear = now.getUTCFullYear();
  const safeCount = Math.min(Math.max(Number(count) || 1, 1), 10);

  return Array.from({ length: safeCount }, (_, index) => {
    const year = currentYear - index;
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const calendarEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const to = year === currentYear && now < calendarEnd ? new Date(now) : calendarEnd;

    return {
      year,
      from: from.toISOString(),
      to: to.toISOString(),
      complete: year < currentYear
    };
  });
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

function activityMetrics(contributions) {
  return {
    contributions: Number(contributions?.contributionCalendar?.totalContributions ?? 0),
    commits: Number(contributions?.totalCommitContributions ?? 0),
    issues: Number(contributions?.totalIssueContributions ?? 0),
    pullRequests: Number(contributions?.totalPullRequestContributions ?? 0),
    reviews: Number(contributions?.totalPullRequestReviewContributions ?? 0),
    restrictedContributions: Number(contributions?.restrictedContributionsCount ?? 0)
  };
}

function toDeveloperRecord(user, yearWindows) {
  const normalizedLocation = normalizeSouthAfricaLocation(user.location);
  if (!normalizedLocation.accepted) return null;

  const rolling = activityMetrics(user.contributions365d);
  const repositories = summarizeRepositories(user.repositories);
  const metricsByYear = {};

  yearWindows.forEach(({ year }, index) => {
    metricsByYear[String(year)] = activityMetrics(user[`year${index}`]);
  });

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
      contributions365d: rolling.contributions,
      commits365d: rolling.commits,
      issues365d: rolling.issues,
      pullRequests365d: rolling.pullRequests,
      reviews365d: rolling.reviews,
      restrictedContributions365d: rolling.restrictedContributions,
      ...repositories
    },
    metricsByYear
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

export async function collectSouthAfrica({
  token,
  now = new Date(),
  concurrency = 4,
  maxCandidates = 500,
  historyYears = 5
} = {}) {
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
  const yearWindows = calendarYearWindows(now, historyYears);
  const userMetricsQuery = buildUserMetricsQuery(yearWindows);
  const logins = [...candidateLogins].sort((a, b) => a.localeCompare(b));

  const baseVariables = { from, to };
  yearWindows.forEach((window, index) => {
    baseVariables[`yearFrom${index}`] = window.from;
    baseVariables[`yearTo${index}`] = window.to;
  });

  const enriched = await mapWithConcurrency(logins, concurrency, async (login) => {
    const data = await graphql(userMetricsQuery, { login, ...baseVariables });
    return data.user ? toDeveloperRecord(data.user, yearWindows) : null;
  });

  const developers = enriched.filter(Boolean);

  return {
    discoveredCandidates: logins.length,
    acceptedCandidates: developers.length,
    rejectedCandidates: logins.length - developers.length,
    window: { from, to },
    calendarYears: yearWindows,
    developers
  };
}
