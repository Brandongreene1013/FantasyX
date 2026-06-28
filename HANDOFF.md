# FantasyX / Sunday Markets Handoff

## Summary

FantasyX is a database-backed, free-play NFL fantasy prediction market MVP. Users trade mock-credit YES/NO shares on whether players finish Top 3, Top 5, or Top 10 at their weekly half-PPR positional rank.

Warning: no real-money wagering, deposits, withdrawals, custody, mainnet Solana, or production smart contracts are implemented. Solana is a future direction only.

## Current State

- Next.js App Router UI with mobile-first pages.
- Prisma/Postgres persistence through Docker Compose.
- Real email/password auth using a signed httpOnly cookie named `fantasyx_session`.
- `/signup` creates accounts, grants 10,000 mock credits, and logs users in.
- `/login` accepts email/password credentials. Demo account selection is removed.
- Trades, portfolio, and admin settlement use the authenticated session user.
- Trades do not trust `userId` from client payloads.
- Admin settlement route requires `user.isAdmin`.
- FX-001 Append-Only Ledger Foundation is complete: true ledger service, reconciliation utilities, migration, metadata, admin attribution, correction type, append-only protection, and idempotency safeguards.
- FX-002 Market Event Engine is complete: market event service with typed emit functions, admin adjustment workflow with ledger and audit records, admin note events, audit history API, and admin authorization boundary tests.
- FX-003 Service Layer Split is complete: trade, settlement, void, and leaderboard logic extracted from `lib/db-amm.ts` into dedicated services; typed domain errors with stable codes; `lib/db-amm.ts` reduced to a backward-compatible re-export barrel.
- FX-004 Market Experience is complete: market detail pages, inline trade panel, market discovery filters/sort, UI polish, and expanded test coverage.
- FX-005 Player Intelligence is complete: player detail pages at `/players/[playerId]` with intelligence panel, market sentiment, historical performance (placeholder), navigation from market cards and detail pages, 23 new tests.
- FX-006 NFL Data Engine is complete: provider abstraction (`INflDataProvider`), `DemoNflDataProvider`, `FutureSportsDataProvider` placeholder, idempotent `syncNflData` service, `POST /api/admin/nfl/sync-demo`, `GET /api/admin/nfl/stats`, admin NFL Data panel, schema fields for `Player.status` and `externalProviderId` on Player and Game, Prisma migration, 27 new tests.
- FX-007 Market Intelligence & Analytics is complete: market price history snapshots, Recharts market and portfolio charts, market sentiment scores, home dashboard analytics, trending markets, biggest movers, portfolio analytics summary, additive migration, and 6 new tests.
- FX009 Real User Accounts & Platform Identity is complete: signup/login, password hashing, server-side sessions, account/settings pages, admin env seed, demo login removal, and auth tests.
- Accessibility hardening and axe tests are in place.

## Features Completed

- Real account signup/login with signed httpOnly cookie session.
- Protected `/markets`, `/markets/[marketId]`, `/players/[playerId]`, `/portfolio`, `/history`, and `/admin` routes.
- Market detail pages at `/markets/[marketId]` with player info, market stats, inline trade panel, and full event timeline.
- Player detail pages at `/players/[playerId]` with intelligence panel, sentiment, historical performance, and per-player market cards with inline trade.
- Market detail analytics with YES/NO price history, volume history, open-interest history, bullish/bearish/confidence scores, and MarketEvent fallback history.
- Home market intelligence dashboard with trending markets, biggest movers, highest volume, highest open interest, most active players, and recently settled markets.
- Portfolio analytics with current portfolio value, weekly/all-time P&L, unrealized/realized gain-loss, win rate, average entry, largest position, best trade, worst trade, and equity curve chart.
- Market discovery with player name search, team filter, status filter, position tabs, threshold tabs, and multi-column sort.
- Database-backed slate, trading, portfolio, leaderboard, settlement, history, ledger, market events, and NFL data sync.
- Provider-based NFL data layer with adapter pattern: `DemoNflDataProvider`, `FutureSportsDataProvider` placeholder, and `INflDataProvider` interface.
- Idempotent NFL data sync service (`lib/nfl-sync.service.ts`): upserts weeks, games, players; creates only missing markets; never overwrites AMM pool state or trade history.
- Constant-product AMM mock-credit trading.
- Append-only account ledger entries for seed grants, trade spends, settlement payouts, and void refunds.
- Ledger correction entries and admin-attributed ledger entries.
- Transaction-safe ledger service for every balance-changing trade, payout, and refund flow.
- Ledger reconciliation utilities with mismatch details.
- Stable idempotency keys for settlement payouts and void refunds.
- Market opening price, volume, and open interest tracking.
- Unified chronological market events.
- Admin audit records for settlement, void, lock, and unlock actions.
- Trade History page with week, player, position, market, and status filters.
- Portfolio history with open/closed positions, realized/unrealized P&L, average entry, current value, return %, and equity curve placeholder.
- Market Timeline component on `/markets` and `/history`.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Prisma 6
- PostgreSQL 16 via Docker
- Zod
- Vitest
- Playwright + axe-core
- Lucide React

## Setup

```powershell
cd "C:\Users\brand\OneDrive\Desktop\FantasyX"
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/signup`.

## Environment

Required `.env` value:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasyx?schema=public"
```

`.env` is excluded from handoff archives.

## Database

Schema: `prisma/schema.prisma`

Seed: `prisma/seed.ts`

Main models:

- `User`
- `Player`
- `NflWeek`
- `Game`
- `Market`
- `Trade`
- `Position`
- `Settlement`
- `LeaderboardEntry`
- `AccountLedgerEntry`
- `MarketEvent`
- `AdminAuditLog`
- `MarketPriceHistory`
- `Session`

Recent schema changes:

- Added enums: `LedgerEntryType`, `MarketEventType`, `AdminAuditAction`.
- Added `Market.openingPrice`, `Market.volume`, and `Market.openInterest`.
- Added `AccountLedgerEntry`.
- Added `AccountLedgerEntry.adminId`.
- Added `AccountLedgerEntry.metadata`.
- Added `LedgerEntryType.CORRECTION`.
- Added `MarketEvent`.
- Added `AdminAuditLog`.
- Added relations from users, markets, trades, and settlements to exchange-history records.
- FX-006: Added `Player.status` (String, default "ACTIVE") for injury/availability placeholder.
- FX-006: Added `Player.externalProviderId` (String?, unique) for future real-data provider mapping.
- FX-006: Added `Game.externalProviderId` (String?, unique) for provider mapping.
- FX-006: Added `@default(cuid())` to `Game.id` to allow auto-generated IDs from sync service.
- FX-007: Added `MarketPriceHistory` as an additive analytics read model with YES price, NO price, liquidity, volume, open interest, source, and timestamp.
- FX009: Added `UserRole`, user identity/password fields, and `Session` rows for real account auth.

Migrations:

- `prisma/migrations/20260628121000_fx001_append_only_ledger/migration.sql`
- `prisma/migrations/20260628200000_fx006_nfl_data_engine/migration.sql`
- `prisma/migrations/20260628220000_fx007_market_intelligence/migration.sql`
- `prisma/migrations/20260628233000_fx009_real_accounts/migration.sql`
- `prisma/migrations/migration_lock.toml`

The migration includes indexes and append-only trigger protection for ledger update/delete attempts.

Ledger behavior:

- `AccountLedgerEntry` is append-only.
- Application code only reads or creates ledger rows.
- No app route exposes ledger update/delete behavior.
- Trade spend, settlement payout, void refund, and seed grant balance changes are represented by ledger rows.
- Settlement payout keys use `settlement_payout:{settlementId}:{userId}`.
- Void refund keys use `void_refund:{marketId}:{userId}`.
- The `idempotencyKey` column is unique to prevent duplicate balance mutations.

## Main Routes

- `/` - home and product explanation
- `/signup` - account creation
- `/login` - email/password login
- `/account` - authenticated account summary
- `/settings` - authenticated profile settings
- `/markets` - protected market slate and trading
- `/portfolio` - protected authenticated-user portfolio
- `/history` - protected trade history and market timeline
- `/leaderboard` - leaderboard
- `/admin` - protected admin settlement UI
- `/slate` - redirects to `/markets`

## API Routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/session`
- `GET /api/account`
- `PATCH /api/settings`
- `GET /api/slate`
- `POST /api/trades`
- `GET /api/portfolio`
- `GET /api/trade-history`
- `GET /api/account-ledger`
- `GET /api/market-events`
- `GET /api/leaderboard`
- `POST /api/settlements`
- `POST /api/admin/adjustments`
- `POST /api/admin/notes`
- `GET /api/admin/audit-history`
- `POST /api/admin/nfl/sync-demo`
- `GET /api/admin/nfl/stats`
- `GET /api/analytics/dashboard`

New API routes from Sprint 1:

- `GET /api/trade-history`
- `GET /api/account-ledger`
- `GET /api/market-events`

New API routes from FX-002:

- `POST /api/admin/adjustments`
- `POST /api/admin/notes`
- `GET /api/admin/audit-history`

## Core Logic Files

- `lib/auth.ts` - session and admin helpers
- `lib/session.ts` - cookie name constant safe for middleware/tests
- `lib/session-store.ts` - signed cookie and server-side session helpers
- `lib/password.ts` - scrypt password hashing helpers
- `lib/db-amm.ts` - backward-compatible re-export barrel (calls services; do not add logic here)
- `lib/trade.service.ts` - AMM trade execution, balance deduction, position update, ledger and event emit
- `components/trade-panel.tsx` - inline trade panel (side selector, quote display, confirm) used on market detail page
- `lib/settlement.service.ts` - market settlement, player market batch settlement, lock, unlock, payout, audit
- `lib/void.service.ts` - market void, position refunds, audit
- `lib/leaderboard.service.ts` - weekly leaderboard refresh scoped to users with positions
- `lib/domain-errors.ts` - typed domain errors with stable codes and HTTP status mapping
- `lib/exchange-records.ts` - admin audit record helper
- `lib/ledger-service.ts` - transaction-safe ledger balance changes and reconciliation utilities
- `lib/market-event.service.ts` - market event engine with typed emit functions for all event types
- `lib/market-analytics.service.ts` - FX-007 market history snapshots, chart data, sentiment, trending/mover algorithms, portfolio analytics, and dashboard reads
- `lib/amm.ts` - pure AMM math
- `lib/api-validation.ts` - Zod schemas
- `middleware.ts` - route protection and placeholder rate limiting
- `lib/nfl-data/types.ts` - shared provider data types
- `lib/nfl-data/provider.ts` - INflDataProvider interface
- `lib/nfl-data/demo-provider.ts` - DemoNflDataProvider (seeded 2026 demo data, 13 players, 10 games)
- `lib/nfl-data/future-provider.placeholder.ts` - FutureSportsDataProvider stub
- `lib/nfl-sync.service.ts` - syncNflData() idempotent upsert orchestrator

## Files Changed in Sprint 1

- `prisma/schema.prisma`
- `prisma/migrations/20260628121000_fx001_append_only_ledger/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/seed.ts`
- `lib/db-amm.ts`
- `lib/exchange-records.ts`
- `lib/ledger-service.ts`
- `lib/db-serialization.ts`
- `lib/types.ts`
- `lib/client-api.ts`
- `lib/api-validation.ts`
- `app/api/trade-history/route.ts`
- `app/api/account-ledger/route.ts`
- `app/api/market-events/route.ts`
- `app/api/portfolio/route.ts`
- `app/api/settlements/route.ts`
- `app/history/page.tsx`
- `app/portfolio/page.tsx`
- `app/markets/page.tsx`
- `app/admin/page.tsx`
- `app/layout.tsx`
- `middleware.ts`
- `components/market-card.tsx`
- `components/market-timeline.tsx`
- `tests/money-market.test.ts`
- `ROADMAP.md`
- `HANDOFF.md`
- `TODO.md`

## Environment Variables

Required:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_FIRST_NAME`
- `ADMIN_LAST_NAME`

## Breaking Changes

- Database schema changed. Existing local databases should run `npx prisma migrate deploy` before running the app.
- Local databases created by older `prisma db push` workflows may need one-time migration baselining.
- Seed now clears and recreates ledger, market event, and admin audit records.
- `/history` is a new protected route and requires login.

## Tests

Business logic:

```powershell
npm run test
```

Covers AMM price movement, ledger math, seed grant ledger rows, trade spend ledger rows, spend/balance behavior, position shares, locked/settled/void trade rejection, insufficient balance, settlement payout ledger rows, double-pay ledger prevention, void refund ledger rows, double-refund prevention, forged `userId` rejection, real signup/login/logout sessions, user isolation, admin permissions, ledger reconciliation, trade history, portfolio calculations, market history, admin audit records, and market event ordering.

Accessibility:

```powershell
npm run test:a11y
```

Covers home, markets, portfolio, leaderboard, admin, and trade modal with axe.

## Files Changed in FX-002

- `lib/market-event.service.ts` (new)
- `lib/db-amm.ts`
- `lib/exchange-records.ts`
- `lib/api-validation.ts`
- `app/api/admin/adjustments/route.ts` (new)
- `app/api/admin/notes/route.ts` (new)
- `app/api/admin/audit-history/route.ts` (new)
- `tests/market-event-engine.test.ts` (new)
- `tests/money-market.test.ts`
- `HANDOFF.md`
- `TODO.md`
- `ROADMAP.md`
- `CLAUDE.md`

## Files Changed in FX-004

- `app/api/markets/[marketId]/route.ts` (new) — market detail API: market + player + events, auth-gated, NOT_FOUND DomainError
- `app/markets/[marketId]/page.tsx` (new) — market detail page: player header, stats grid, inline trade panel, full timeline
- `components/trade-panel.tsx` (new) — inline trade panel: YES/NO selector, amount input, live quote, confirm
- `components/market-card.tsx` — added "View details" link to detail page, polished card layout
- `app/markets/page.tsx` — added player search, team filter, status filter, sort (kickoff/YES price/liquidity/volume)
- `lib/client-api.ts` — added `MarketDetailResponse` type
- `middleware.ts` — extended protection to `/markets/[marketId]` routes
- `tests/market-detail.test.ts` (new) — 10 integration tests for serialization, player resolution, event ordering, DomainError
- `tests/a11y/app-accessibility.spec.ts` — added market detail page to axe suite
- `HANDOFF.md`, `ROADMAP.md`, `TODO.md` — updated

## Files Changed in FX-003

- `lib/domain-errors.ts` (new)
- `lib/trade.service.ts` (new)
- `lib/settlement.service.ts` (new)
- `lib/void.service.ts` (new)
- `lib/leaderboard.service.ts` (new)
- `lib/db-amm.ts` (reduced to re-export barrel)
- `lib/api-response.ts`
- `app/api/trades/route.ts`
- `app/api/settlements/route.ts`
- `tests/service-layer.test.ts` (new)
- `HANDOFF.md`
- `TODO.md`
- `ROADMAP.md`

## Files Changed in FX-006

- `lib/nfl-data/types.ts` (new) — NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord, NflSyncResult types
- `lib/nfl-data/provider.ts` (new) — INflDataProvider interface
- `lib/nfl-data/demo-provider.ts` (new) — DemoNflDataProvider: 20 teams, 13 players, 10 games, 1 week, full slate
- `lib/nfl-data/future-provider.placeholder.ts` (new) — FutureSportsDataProvider stub with not-implemented errors
- `lib/nfl-sync.service.ts` (new) — syncNflData(): idempotent upsert of weeks/games/players, create-only markets
- `app/api/admin/nfl/sync-demo/route.ts` (new) — POST admin-only sync endpoint
- `app/api/admin/nfl/stats/route.ts` (new) — GET admin-only stats endpoint
- `prisma/schema.prisma` — added Player.status, Player.externalProviderId, Game.externalProviderId, Game.id @default(cuid())
- `prisma/migrations/20260628200000_fx006_nfl_data_engine/migration.sql` (new) — schema migration
- `app/admin/page.tsx` — added NFL Data panel with stats, Sync Demo button, and sync result display
- `lib/client-api.ts` — added NflSyncResponse and NflStatsResponse types
- `tests/nfl-data-engine.test.ts` (new) — 27 tests covering provider unit tests, sync idempotency, admin authorization
- `HANDOFF.md`, `ROADMAP.md`, `TODO.md` — updated

## Files Changed in FX-007

- `prisma/schema.prisma` - added `MarketPriceHistory` relation/model.
- `prisma/migrations/20260628220000_fx007_market_intelligence/migration.sql` - additive history table migration.
- `lib/market-analytics.service.ts` - new analytics/history/sentiment/trending/portfolio service.
- `lib/market-event.service.ts` - records material price snapshots when market events move price.
- `app/api/markets/[marketId]/route.ts` - returns chart history and sentiment.
- `app/api/portfolio/route.ts` - returns expanded portfolio analytics.
- `app/api/analytics/dashboard/route.ts` - new dashboard analytics API.
- `components/analytics-charts.tsx` - responsive Recharts market and equity charts.
- `components/analytics-dashboard.tsx` - home dashboard sections.
- `app/markets/[marketId]/page.tsx` - market sentiment and history charts.
- `app/portfolio/page.tsx` - real equity curve and analytics summary.
- `app/page.tsx` - market intelligence dashboard.
- `lib/client-api.ts` - FX-007 response types.
- `tests/market-analytics.test.ts` - 6 analytics tests.
- `package.json`, `package-lock.json` - added Recharts.
- `HANDOFF.md`, `ROADMAP.md`, `TODO.md` - updated.

## Last Verified Results

- `npm run prisma:generate` - passed
- `npx prisma migrate deploy` - passed after local baseline of older `db push` schema
- `npm run lint` - passed on 2026-06-28
- `npm run typecheck` - passed on 2026-06-28
- `npm test` - passed on 2026-06-28, 137 tests
- `npm run build` - passed on 2026-06-28
- `npm run prisma:seed` - passed
- `npm run test:a11y` - passed, 6 tests

Known non-blocking warning: Playwright dev server may show a future Next.js `allowedDevOrigins` warning for `127.0.0.1`.

## Known Issues

- A migration exists, but docs/scripts still need to fully switch from `prisma db push` to migrate-first workflows.
- In-memory rate limiting is only a placeholder.
- CSRF protection is still needed for cookie-authenticated POST routes before broader public release.
- `/markets` is route-protected so users choose an account before trading.
- Trade execution still lacks explicit concurrency controls/row-level locking.
- `ADMIN_ADJUSTMENT` API workflow exists (`POST /api/admin/adjustments`) but has no admin UI page yet.
- Legacy `lib/store.tsx` may still exist but should not be used for real app state.
- No Solana integration yet by design.
- FX-007 charts use persisted snapshots when present and MarketEvent/opening/current fallback data for older markets.

## Recommended Next Implementation Ticket

Next ticket: FX-008 — Concurrency Safety (row-level locking or serializable strategy for trade execution, simultaneous trade tests, and balance/pool overwrite protection).
