# TODO

## Completed - FX009 Real User Accounts & Platform Identity

1. Added real email/password signup and login.
2. Added scrypt password hashing and generic login failure messaging.
3. Added signed httpOnly `fantasyx_session` cookie backed by server-side `Session` rows.
4. Added `UserRole`, account identity fields, and FX009 Prisma migration.
5. Added `/signup`, `/account`, and `/settings`; removed the demo account picker.
6. Signup grants 10,000 mock credits through a ledger `SEED_GRANT`.
7. Seed creates the admin from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME`.
8. Added `tests/auth-accounts.test.ts`. Total: 137 tests.

## Completed - FX-007 Market Intelligence & Analytics

1. Added `MarketPriceHistory` model and migration for additive market price history snapshots.
2. Created `lib/market-analytics.service.ts`: chart history generation, material snapshot recording, sentiment scoring, trending ranking, biggest movers, portfolio analytics, and dashboard reads.
3. Updated market event emission to persist price snapshots when market prices materially change.
4. Created `components/analytics-charts.tsx`: responsive Recharts YES/NO price, volume, open-interest, and equity curve charts.
5. Created `GET /api/analytics/dashboard`: trending markets, biggest movers, recently settled, highest volume, highest open interest, and most active players.
6. Updated market detail pages with market sentiment, confidence, YES movement, and three analytics charts.
7. Updated portfolio with current portfolio value, weekly/all-time P&L, unrealized/realized gain-loss, win rate, average entry, largest position, best trade, worst trade, and real equity curve.
8. Updated home page with the market intelligence dashboard.
9. Added `tests/market-analytics.test.ts`: 6 tests. Total: 127 tests.

## Completed - FX-006 NFL Data Engine

1. Created `lib/nfl-data/types.ts`: NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord, NflSyncResult.
2. Created `lib/nfl-data/provider.ts`: INflDataProvider interface.
3. Created `lib/nfl-data/demo-provider.ts`: DemoNflDataProvider with 20 teams, 13 players, 10 games, Week 1 2026 slate.
4. Created `lib/nfl-data/future-provider.placeholder.ts`: FutureSportsDataProvider stub.
5. Created `lib/nfl-sync.service.ts`: syncNflData() - idempotent upsert of weeks/games/players; create-only markets.
6. Created `POST /api/admin/nfl/sync-demo`: admin-only; returns NflSyncResult with counts.
7. Created `GET /api/admin/nfl/stats`: admin-only; weeks/players/games/markets counts + status breakdowns.
8. Updated `app/admin/page.tsx`: NFL Data panel with stat boxes, Sync Demo button, result display.
9. Updated `prisma/schema.prisma`: Player.status, Player.externalProviderId, Game.externalProviderId, Game.id @default(cuid()).
10. Created `prisma/migrations/20260628200000_fx006_nfl_data_engine/migration.sql`.
11. Added `tests/nfl-data-engine.test.ts`: 27 tests. Total after FX-006: 121 tests.

## Completed - FX-005 Player Intelligence

1. Created `lib/player-intelligence.ts`: static projection map for seeded players, sentiment, placeholder history, and intelligence helpers.
2. Created `GET /api/players/[playerId]`: player + markets for current week + sentiment + intelligence.
3. Created `app/players/[playerId]/page.tsx`: player header, intelligence panel, market sentiment, historical performance, and per-player market cards.
4. Updated player navigation from market cards and market detail pages.
5. Updated `lib/client-api.ts`, `middleware.ts`, and accessibility coverage.
6. Added `tests/player-intelligence.test.ts`: 23 tests.

## Completed - FX-004 Market Experience

1. Created `GET /api/markets/[marketId]`: market + player + events, auth-gated, NOT_FOUND for missing markets.
2. Created `app/markets/[marketId]/page.tsx`: player header, stat grid, inline trade panel, and timeline.
3. Created `components/trade-panel.tsx`: YES/NO selector, live quote, balance-after display, error/success states.
4. Updated market discovery with search, team filter, status filter, sort, and result count.
5. Updated market cards with detail links, opponent display, and finalized result display.
6. Added `tests/market-detail.test.ts`: 10 tests.

## Completed - FX-003 Service Layer Split

1. Created trade, settlement, void, and leaderboard services.
2. Created `lib/domain-errors.ts` with stable domain error codes.
3. Reduced `lib/db-amm.ts` to a backward-compatible re-export barrel.
4. Updated API routes to call services directly.
5. Added `tests/service-layer.test.ts`: 20 tests.

## Completed - FX-002 Market Event Engine

1. Created `lib/market-event.service.ts` with typed emit functions.
2. Added admin adjustment, admin note, and admin audit history APIs.
3. Added admin authorization boundary tests.
4. Fixed leaderboard refresh scoping.
5. Added 21 tests covering event consistency, ordering, admin workflows, and authorization.

## P0 - Next Implementation Ticket

FX-008 - Concurrency Safety:

1. Add row-level locking or a serializable transaction strategy for market pool and user balance reads during trade execution.
2. Add simultaneous buys on the same market tests.
3. Add simultaneous buys by the same user tests.
4. Verify ledger idempotency and mock balance cache cannot diverge under concurrent trade pressure.

Remaining backlog:

5. Add E2E smoke tests: login -> trade -> portfolio and admin -> settlement -> payout.
6. Add `ADMIN_ADJUSTMENT` admin UI page.

## P1 - Newly Discovered Technical Debt

1. `User.mockBalance` is still a mutable cached balance; add scheduled reconciliation checks and admin-visible mismatch alerts.
2. Settlement and void idempotency rely partly on position payout state; move toward explicit payout/refund records.
3. Migration workflow exists but setup docs/scripts still reference `prisma db push`.
4. FX-007 chart history uses MarketEvent/opening/current fallback points for older markets until enough live snapshots accumulate.
5. `ADMIN_ADJUSTMENT` workflow exists via API but has no admin UI page yet.
6. No pagination yet for trade history, ledger entries, market events, or analytics lists.

## P2 - Bugs / Risk Areas To Watch

1. Concurrent trades may still read stale market pool or user balance data - row-level locking needed.
2. The append-only trigger is committed in migration; local `prisma db push` databases do not automatically receive trigger behavior.
3. Seed resets all exchange history; this is fine for local demo but not for persistent environments.
4. In-memory rate limiting is not durable across instances.
5. CSRF protection is still needed for cookie-authenticated POST routes before broader public release.
6. Legacy `lib/store.tsx` can confuse future work if accidentally imported.
7. Trade request idempotency keys are not implemented yet; only ledger mutations have idempotency coverage.

## P3 - Future Improvements

1. Add kickoff-based automatic market locking.
2. Add multi-week slate navigation.
3. Add fantasy rank/scoring import workflow.
4. Add richer leaderboard filtering by week.
5. Add deeper market depth/liquidity simulation beyond current liquidity and open-interest charting.
6. Replace browser event refreshes with query/mutation invalidation.

## P4 - Nice-To-Have Enhancements

1. Add CSV export for analytics dashboard snapshots.
2. Add CSV export for trade history and ledger entries.
3. Add admin notes directly from market timeline.
4. Add user-facing account statement page from ledger entries.
5. Add a single `npm run verify` command for lint, typecheck, tests, and build.

## P5 - Later Solana Planning

1. Keep Solana design separate from the free-play MVP.
2. Start with testnet-only wallet identity linking.
3. Do not add deposits, withdrawals, custody, mainnet SOL, or real-money wagering until the free-play product is validated and reviewed.
