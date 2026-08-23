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

## Measurement window

Activity and collaboration metrics use the preceding 365 days at collection time.

Collected metrics include:

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

Based on 365-day contribution events.

### Impact — 25%

```text
impactRaw = starsReceived + (2 × forksReceived)
```

### Community — 15%

Based on GitHub follower count.

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

## Tie breaking

Ties are resolved by:

1. higher overall score;
2. higher 365-day contribution count;
3. higher sampled stars received;
4. alphabetical GitHub login.

## Transparency and future versions

Methodology changes must increment the methodology version. Historical comparisons should not mix scores produced by materially different methodology versions without explicit normalization.
