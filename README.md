# GitHub Developer Index

Independent country-by-country GitHub developer intelligence by **Skunkworks Academy**.

**Live site:** https://github.skunkworksacademy.com/

The project discovers public GitHub users, normalizes public profile locations, collects contribution and repository metrics, applies a versioned independent ranking methodology, and publishes searchable country leaderboards.

## What this project owns

This repository does **not** ingest or republish a third-party GitHub leaderboard. GitHub is the upstream source; the index owns its own:

- candidate discovery;
- country/location normalization;
- developer metrics collection;
- scoring methodology;
- country rankings;
- generated datasets;
- web leaderboard.

## Architecture

```text
GitHub GraphQL API
        ↓
Candidate discovery
        ↓
Profile/contribution enrichment
        ↓
Country normalization
        ↓
Ranking engine v1.0.0
        ↓
public/data/<COUNTRY>.json
        ↓
Responsive GitHub Pages leaderboard
        ↓
github.skunkworksacademy.com
```

See [Architecture](docs/ARCHITECTURE.md) and [Methodology](docs/METHODOLOGY.md).

## Public leaderboard features

- selectable country leaderboard;
- rolling 365-day and calendar-year views;
- Developer Index and activity-based ranking options;
- **Active Contributors** filter;
- name, username, company and location search;
- responsive desktop table and mobile cards;
- custom-domain SEO metadata, robots directives and XML sitemap;
- Skunkworks Academy social, source and learning CTAs.

The public country registry currently includes 20 countries. Country datasets are generated independently from GitHub API data and may refresh at different times.

## Local validation

Requires Node.js 24+.

```bash
npm test
npm run validate
```

## Collect data

Use a GitHub token with permission to read public GitHub data. Never place a token in frontend code or commit it to the repository.

```bash
GH_TOKEN=... npm run collect:za
npm run validate
```

## Automation

- **CI** validates source, SEO/domain requirements and generated-data contracts on pushes and pull requests.
- **Refresh GitHub Developer Index** refreshes South Africa on its scheduled cadence and can also be triggered manually.
- **Refresh Country Developer Indexes** progressively publishes supported country datasets.
- **Deploy GitHub Pages** deploys the `public/` directory after updates to `main` when GitHub Pages is configured to use GitHub Actions.

## Domain and discoverability

GitHub Pages is configured by `public/CNAME` for:

`github.skunkworksacademy.com`

The public site also publishes `robots.txt`, `sitemap.xml`, canonical metadata, Open Graph/Twitter tags, Schema.org structured data and Skunkworks Academy favicon references.

## Limitations

GitHub profile locations are free text, so country membership is heuristic rather than authoritative. GitHub search is not a complete census. Repository impact currently samples up to 100 public repositories per user. Calendar-year activity is historical, while followers, stars and the composite Developer Index are current/rolling snapshot metrics.

The index is independent and is **not an official GitHub leaderboard**.
