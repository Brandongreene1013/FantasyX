# FX026 Unified Player Markets and Trading Experience

## Sprint Summary

FX026 moves individual player markets toward one canonical player page with threshold submarkets. `/players/[playerId]?threshold=TOP_5` now drives the selected Top 3, Top 5, or Top 10 contract, chart, stats, position, activity, and trade ticket.

## Product Behavior

- Player names and avatars from market cards link to the player page with the relevant `threshold` query parameter.
- Invalid or missing threshold query params fall back to Top 5, then Top 10, then Top 3 when available.
- Threshold changes update the URL without leaving the player page.
- The selected threshold controls YES/NO prices, movement, chart history, trade form, user position, market stats, and timeline.
- Portfolio rows now route to the canonical player market page for trading instead of using a separate sell shortcut.

## Architecture Changes

- `GET /api/players/[playerId]` now returns a complete player-market payload for the requested/default week.
- The player API includes authenticated account balance, user positions scoped to each threshold, watch state, price history, and market events.
- Trade execution persists a `MarketPriceHistory` snapshot inside the same successful serializable transaction after market state changes.
- Idempotent trade retries return the existing trade before writing another snapshot.

## API Changes

- `GET /api/players/[playerId]?weekId=nfl_2026_w1` supports optional `weekId`.
- Response now includes:
  - `account.balance`
  - `weekId`
  - `markets[].history`
  - `markets[].position`
  - `markets[].isWatchlisted`
  - `markets[].events`

## Component Changes

- Added `components/player-market-chart.tsx` for Recharts-based YES share price history.
- Added `components/trade-launcher.tsx` as an accessible wrapper for the shared dark trade ticket.
- Updated `components/trade-panel.tsx` with initial side support, sell percentage buttons, MAX sell behavior, price impact, max loss, settlement value, and consistent submit labels.
- Updated `app/players/[playerId]/page.tsx` into the selected-threshold player market terminal.

## Schema or Migration Changes

No Prisma schema changes or migration were required. Existing `MarketPriceHistory` supports the required durable chart data.

## Trade Integrity Notes

Preserved:

- Existing AMM quote/execution logic
- Serializable trade transactions
- CSRF validation
- Trade rate limiting
- Idempotency-key handling
- Kickoff locking
- Balance and share validation
- Append-only ledger writes
- Market-event emission

Added:

- Transaction-scoped price-history snapshots for material price changes.
- Test coverage expectation that idempotent retries do not duplicate snapshots.

## Tests Added

- `tests/player-market-api.test.ts`
- Additional price-history idempotency coverage in `tests/money-market.test.ts`

## Verification Results

Passed:

```powershell
npm run lint
npm run typecheck
npm run build
```

Blocked by missing local PostgreSQL:

```powershell
npx vitest run tests/market-analytics.test.ts tests/player-market-api.test.ts tests/money-market.test.ts
```

`tests/market-analytics.test.ts` passed. Database-backed tests failed before assertions because Postgres was not reachable at `localhost:5432`.

```powershell
npm run test
npm run test:a11y
npm run test:e2e
```

Results:

- `npm run test`: 7 test files passed, 14 failed, 79 tests passed, 174 failed, 29 skipped. Most failures were Prisma connection errors for `localhost:5432`. Two unrelated PWA assertions in `tests/pwa-live.test.ts` also failed against existing manifest/service-worker expectations.
- `npm run test:a11y`: 8/8 failed during authenticated test setup because Prisma could not reach `localhost:5432`.
- `npm run test:e2e`: 1/1 failed during fixture lookup because Prisma could not reach `localhost:5432`.

## Known Limitations

- `components/trade-modal.tsx` remains in the repository as legacy code, but `/markets` now uses `TradeLauncher`.
- Market board rows still deep-link to `/markets/[marketId]`; player-name-specific board affordances can be refined in a later pass.
- Manual buy, partial sell, MAX sell, mobile layout, and a11y verification need to be completed with a running local database and browser session.

## Deployment Instructions

No migration is needed for FX026.

Before deploying:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:a11y
npm run test:e2e
```

If deploying to Vercel, ensure the production database is reachable and run migrations only if a future schema change is introduced.

## Recommended Next Sprint

- Finish removing the legacy `TradeModal` and consolidate any remaining trade entry points.
- Add browser-verified Playwright coverage for buy, 50% sell, MAX sell, refresh persistence, and mobile layout.
- Add a focused market-board player identity link without disrupting row-level market deep links.
