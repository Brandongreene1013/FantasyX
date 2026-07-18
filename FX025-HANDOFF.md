# FX025 Market Discovery + Trading Board Upgrade

## What changed

Market discovery now runs through a dedicated API:

`GET /api/markets/discovery`

The `/markets` page uses that endpoint for searchable, filterable, sortable market browsing instead of doing all discovery work against the raw slate feed in the browser.

## Query params

- `weekId`: defaults to `nfl_2026_w1`
- `q`: searches player name, team, position, and market type
- `position`: `QB`, `RB`, `WR`, `TE`
- `team`: exact team code
- `marketType`: `TOP_3`, `TOP_5`, `TOP_10`
- `status`: `DRAFT`, `SCHEDULED`, `OPEN`, `LOCKED`, `SETTLED`, `VOID`
- `sort`: `popular`, `price-desc`, `price-asc`, `gainers`, `losers`, `updated`, `alpha`
- `limit`: 1 to 100, defaults to 50
- `page`: 1 to 100, defaults to 1
- `watchlistOnly`: requires a logged-in user

## Metrics

- `price`, `volume`, `openInterest`, and liquidity pools are persisted market data.
- `change` is current YES price minus opening YES price.
- `changePercent` is derived from opening YES price.
- `liquidity` is YES pool plus NO pool.
- `popularityScore` is a deterministic discovery ranking from volume, open interest, trade count, watch count, and liquidity.

No projection, injury, news, or odds ingestion was added in this sprint.

## Verification

Fast verification does not require Docker:

```powershell
npm run lint
npm run typecheck
npx vitest run tests/market-discovery.test.ts tests/seed-universe.test.ts tests/opening-price-model.test.ts tests/rate-limit.test.ts
npm run build
```

Production smoke checks:

```powershell
Invoke-WebRequest -UseBasicParsing "https://fantasy-x.vercel.app/api/slate?weekId=nfl_2026_w1"
Invoke-WebRequest -UseBasicParsing "https://fantasy-x.vercel.app/api/markets/discovery?weekId=nfl_2026_w1&position=WR&sort=popular&limit=5"
```

## Deployment note

Vercel `vercel-build` runs `prisma generate && next build`. Database migrations are intentionally explicit via:

```powershell
npm run db:migrate
```

This keeps UI-only deploys from failing on transient hosted Postgres migration advisory locks. Run migrations before deployment whenever `prisma/schema.prisma` or `prisma/migrations` changes.
