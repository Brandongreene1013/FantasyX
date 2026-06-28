# FantasyX / Sunday Markets Handoff

## Summary

FantasyX is a database-backed, free-play NFL fantasy prediction market MVP. Users trade mock-credit YES/NO shares on whether players finish Top 3, Top 5, or Top 10 at their weekly half-PPR positional rank.

Warning: no real-money wagering, deposits, withdrawals, custody, mainnet Solana, or production smart contracts are implemented. Solana is a future direction only.

## Current State

- Next.js App Router UI with mobile-first pages.
- Prisma/Postgres persistence through Docker Compose.
- Mock demo-account auth using a secure httpOnly cookie named `fantasyx_user_id`.
- `/login` lets users select seeded demo accounts.
- Trades, portfolio, and admin settlement use the authenticated session user.
- Trades do not trust `userId` from client payloads.
- Admin settlement route requires `user.isAdmin`.
- FX-001 Append-Only Ledger Foundation is complete: true ledger service, reconciliation utilities, migration, metadata, admin attribution, correction type, append-only protection, and idempotency safeguards.
- FX-002 Market Event Engine is complete: market event service with typed emit functions, admin adjustment workflow with ledger and audit records, admin note events, audit history API, and admin authorization boundary tests.
- FX-003 Service Layer Split is complete: trade, settlement, void, and leaderboard logic extracted from `lib/db-amm.ts` into dedicated services; typed domain errors with stable codes; `lib/db-amm.ts` reduced to a backward-compatible re-export barrel.
- FX-004 Market Experience is complete: market detail pages, inline trade panel, market discovery filters/sort, UI polish, and expanded test coverage.
- Accessibility hardening and axe tests are in place.

## Features Completed

- Mock account login with httpOnly cookie session.
- Protected `/markets`, `/markets/[marketId]`, `/portfolio`, `/history`, and `/admin` routes.
- Market detail pages at `/markets/[marketId]` with player info, market stats, inline trade panel, and full event timeline.
- Market discovery with player name search, team filter, status filter, position tabs, threshold tabs, and multi-column sort.
- Database-backed slate, trading, portfolio, leaderboard, settlement, history, ledger, and market events.
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

Open `http://localhost:3000/login`.

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

Migration:

- `prisma/migrations/20260628121000_fx001_append_only_ledger/migration.sql`
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
- `/login` - demo account selection
- `/markets` - protected market slate and trading
- `/portfolio` - protected authenticated-user portfolio
- `/history` - protected trade history and market timeline
- `/leaderboard` - leaderboard
- `/admin` - protected admin settlement UI
- `/slate` - redirects to `/markets`

## API Routes

- `GET /api/auth/demo-users`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/session`
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
- `lib/amm.ts` - pure AMM math
- `lib/api-validation.ts` - Zod schemas
- `middleware.ts` - route protection and placeholder rate limiting

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

No new environment variables were added.

Required:

- `DATABASE_URL`

## Breaking Changes

- Database schema changed. Existing local databases must run `npm run prisma:push` before running the app.
- A committed migration now exists. Fresh shared environments should move toward `prisma migrate deploy`; local legacy DBs may still need `npm run prisma:push` until migration workflow is fully normalized.
- Seed now clears and recreates ledger, market event, and admin audit records.
- `/history` is a new protected route and requires login.

## Tests

Business logic:

```powershell
npm run test
```

Covers AMM price movement, ledger math, seed grant ledger rows, trade spend ledger rows, spend/balance behavior, position shares, locked/settled/void trade rejection, insufficient balance, settlement payout ledger rows, double-pay ledger prevention, void refund ledger rows, double-refund ledger prevention, forged `userId` rejection, ledger reconciliation, reconciliation mismatch details, ledger idempotency, correction metadata/admin attribution, trade history, portfolio calculations, market history, admin audit records, and market event ordering.

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

## Last Verified Results

- `npm run prisma:generate` - passed
- `npm run prisma:push` - passed
- `npm run lint` - passed on 2026-06-28
- `npm run typecheck` - passed on 2026-06-28
- `npm test` - passed on 2026-06-28, 71 tests (61 existing + 10 new FX-004)
- `npm run build` - passed on 2026-06-28
- `npm run prisma:seed` - passed
- `npm run test:a11y` - passed, 6 tests

Known non-blocking warning: Playwright dev server may show a future Next.js `allowedDevOrigins` warning for `127.0.0.1`.

## Known Issues

- A migration exists, but docs/scripts still need to fully switch from `prisma db push` to migrate-first workflows.
- In-memory rate limiting is only a placeholder.
- Demo auth has no passwords and is not production auth.
- `/markets` is route-protected so users choose an account before trading.
- Equity curve is a placeholder visualization, not a production chart.
- Trade execution still lacks explicit concurrency controls/row-level locking.
- `ADMIN_ADJUSTMENT` API workflow exists (`POST /api/admin/adjustments`) but has no admin UI page yet.
- Legacy `lib/store.tsx` may still exist but should not be used for real app state.
- No Solana integration yet by design.

## Recommended Next Implementation Ticket

Next ticket: FX-005 — Concurrency Safety (row-level locking for trades), E2E smoke tests, and admin UI for ADMIN_ADJUSTMENT.
