# Architecture

## Goal

The GitHub Developer Index is an independent Skunkworks Academy data product. GitHub is the upstream data provider; Skunkworks owns candidate discovery, location normalization, ranking, generated datasets, historical methodology and presentation.

## Foundation data flow

```text
GitHub GraphQL API
        |
        v
South Africa candidate discovery
(location-qualified user searches)
        |
        v
Profile + contribution enrichment
        |
        v
ZA location normalizer
        |
        v
Ranking engine v1
        |
        v
public/data/ZA.json
        |
        v
Static responsive leaderboard
```

## Security boundary

The browser never receives a GitHub API token. Collection runs only in Node.js or GitHub Actions. The public site reads generated JSON artifacts.

The scheduled workflow uses the repository-scoped `GITHUB_TOKEN` supplied by GitHub Actions. No long-lived PAT is required for the foundation release.

## Collection strategy

The South Africa proof of concept runs several GitHub user-search queries using location qualifiers. Results are deduplicated by login and then enriched one user at a time using GraphQL.

GitHub profile locations are free text and cannot be treated as authoritative residency. The normalizer accepts explicit South Africa aliases and a bounded list of well-known South African cities/provinces. Every accepted record retains the original raw location and a confidence score.

## Public data contract

`public/data/ZA.json` is the current country snapshot. It contains:

- source and methodology metadata;
- collection window and candidate counts;
- normalized developer identity/location data;
- 365-day contribution metrics;
- sampled public repository impact metrics;
- component scores and overall rank.

`public/data/countries.json` is the registry consumed by the frontend. Additional countries can be added without redesigning the UI.

## Known foundation constraints

1. GitHub user search is not a complete census and can return at most 1,000 results per search query.
2. Location is self-reported and may be ambiguous, stale or absent.
3. Repository impact currently samples up to the 100 most-starred public repositories owned by each developer.
4. The score is relative to the candidates accepted in the current country snapshot.
5. The first release stores the latest snapshot only; historical trend storage is a planned extension.
