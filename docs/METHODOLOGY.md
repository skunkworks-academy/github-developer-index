# Ranking Methodology v1.0.0

The GitHub Developer Index is **not an official GitHub ranking**. It is an independent Skunkworks Academy index generated from public GitHub API data.

## Eligibility: South Africa proof of concept

A candidate must be discovered through one of the configured GitHub user-search queries and then pass the South Africa location normalizer.

Location confidence is assigned as follows:

- **1.00** — explicit South Africa country signal, including `South Africa`, `RSA`, `ZAF` or the South African flag;
- **0.92** — recognized South African province;
- **0.86** — recognized South African city without an explicit country string;
- **0.00** — unresolved, excluded from the country index.

This is a heuristic classification of public profile text, not proof of residence, nationality or citizenship.

## Measurement windows

The default Developer Index uses the preceding **365 days** at collection time.

The public leaderboard also exposes calendar-year activity filters. By default, collection stores the current calendar year plus the previous four years. The current year is year-to-date; completed prior years cover January 1 through December 31.

Calendar-year filtering applies only to metrics GitHub can reconstruct for that historical contribution window:

- contribution events;
- commit contributions;
- issues;
- pull requests;
- pull-request reviews.

Followers, stars, forks and the overall Developer Index remain current/rolling snapshot values. They are deliberately not presented as historical values because this release does not maintain point-in-time snapshots for those dimensions.

## Collected metrics

The rolling index collects:

- contribution events;
- commit contributions;
- issues;
- pull requests;
- pull-request reviews;
- followers;
- stars received by sampled original public repositories;
- forks received by sampled original public repositories.

## Component scores

Each raw dimension is log-normalized against the maximum value observed in the accepted candidate set:

```text
normalized(x) = log(1 + x) / log(1 + max(x))
```

The logarithmic transform reduces domination by extreme outliers while preserving ordering.

### Activity — 45%

Based on rolling 365-day contribution events.

### Impact — 25%

```text
impactRaw = starsReceived + (2 × forksReceived)
```

### Community — 15%

Based on current GitHub follower count.

### Collaboration — 15%

```text
collaborationRaw =
    pullRequests
  + (1.5 × pullRequestReviews)
  + (0.5 × issues)
```

## Overall score

```text
Developer Index =
    (0.45 × Activity)
  + (0.25 × Impact)
  + (0.15 × Community)
  + (0.15 × Collaboration)
```

All component scores and the final score are represented on a 0–100 scale.

## Year-filter ranking

When a calendar year is selected, the UI only offers historically scoped ranking dimensions:

1. contributions;
2. commits;
3. pull requests;
4. pull-request reviews;
5. issues.

This prevents a selected historical year from being combined with current followers or repository stars in a way that would imply historical measurements we do not possess.

## Tie breaking

Rolling Developer Index ties are resolved by:

1. higher overall score;
2. higher 365-day contribution count;
3. higher sampled stars received;
4. alphabetical GitHub login.

Calendar-year metric ties fall back to the canonical current Developer Index rank.

## Transparency and future versions

Methodology changes must increment the methodology version. Historical comparisons should not mix scores produced by materially different methodology versions without explicit normalization.

Future versions may persist full point-in-time snapshots, allowing historically accurate stars, followers, repository impact and complete historical Developer Index reconstruction.
