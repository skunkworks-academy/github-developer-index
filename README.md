# GitHub Developer Index

Independent country-by-country GitHub developer intelligence by **Skunkworks Academy**.

> Foundation release: South Africa proof of concept, GitHub GraphQL collector, location normalization, ranking engine, responsive leaderboard, validation tests and automated refresh.

## What this project owns

This repository does **not** ingest or republish a third-party GitHub leaderboard. GitHub is the upstream source; the index owns its own:

- candidate discovery;
- country/location normalization;
- developer metrics collection;
- scoring methodology;
- country rankings;
- generated datasets;
- web leaderboard.

## Foundation architecture

```text
GitHub GraphQL API
        ↓
Candidate discovery
        ↓
Profile/contribution enrichment
        ↓
Country normalization (ZA)
        ↓
Ranking engine v1.0.0
        ↓
public/data/ZA.json
        ↓
Responsive GitHub Pages leaderboard
```

See [Architecture](docs/ARCHITECTURE.md) and [Methodology](docs/METHODOLOGY.md).

## Local validation

Requires Node.js 24+.

```bash
npm test
npm run validate
```

## Collect South Africa data

Use a GitHub token with permission to read public GitHub data:

```bash
GH_TOKEN=... npm run collect:za
npm run validate
```

Do not place a token in frontend code or commit it to the repository.

## Automation

- **CI** validates the source and generated-data contract on pushes and pull requests.
- **Refresh GitHub Developer Index** runs every six hours and can also be triggered manually. It regenerates `public/data/ZA.json` using GitHub's workflow token and commits a changed snapshot.
- **Deploy GitHub Pages** deploys the `public/` directory after updates to `main` when GitHub Pages is configured to use GitHub Actions.

## Current scope and limitations

The foundation release supports South Africa only. GitHub profile locations are free text, so country membership is heuristic rather than authoritative. GitHub search is not a complete census. Repository impact currently samples up to 100 public repositories per user.

The index is independent and is **not an official GitHub leaderboard**.
