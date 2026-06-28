# FantasyX Roadmap

This roadmap prioritizes architectural work by impact and dependency order. It assumes the product remains free-play/mock-credit until the MVP is validated.

## Project Status

Current milestone: FX009 Real User Accounts & Platform Identity complete.

Overall MVP foundation completion: 99%.

Next logical milestone: Concurrency Safety, then E2E smoke tests.

Sprint 2 focus:

- Completed: FX-001 Append-Only Ledger Foundation.
- Completed: FX-002 Market Event Engine.
- Completed: FX-003 Service Layer Split.
- Completed: FX-004 Market Experience.
- Completed: FX-005 Player Intelligence.
- Completed: FX-006 NFL Data Engine.
- Completed: FX-007 Market Intelligence & Analytics.
- Completed: FX009 Real User Accounts & Platform Identity.
- Remaining: Concurrency-safe trade execution.
- Remaining: E2E smoke tests for login, trade, portfolio, and settlement.

## Completed - FX009 Real User Accounts & Platform Identity

Implemented:

- Added real email/password signup and login.
- Added user account fields, `UserRole`, password hashes, and server-side `Session` rows.
- Replaced the raw user-id cookie with a signed httpOnly `fantasyx_session` cookie.
- Added `/signup`, `/account`, and `/settings`; rewrote `/login`.
- Removed the public demo account selector flow.
- Signup grants 10,000 mock credits through the ledger.
- Seed creates an administrator from `ADMIN_*` environment variables.
- Added `tests/auth-accounts.test.ts`; the suite has continued to grow in later sprints.

## Completed - FX-007 Market Intelligence & Analytics

Implemented:

- Added `MarketPriceHistory` as an additive analytics read model with Prisma migration.
- Added `lib/market-analytics.service.ts` for market history generation, material price snapshots, sentiment scoring, trending ranking, biggest movers, portfolio analytics, and dashboard reads.
- Updated market event emission to persist price-history snapshots when market prices materially move.
- Added Recharts and `components/analytics-charts.tsx` for responsive market charts and equity curve charts.
- Added market detail charts for YES/NO price history, volume history, and open interest history.
- Added market sentiment visuals for bullish score, bearish score, confidence score, and YES movement.
- Expanded portfolio analytics with current portfolio value, weekly/all-time P&L, unrealized/realized gain-loss, win rate, average entry, largest position, best trade, worst trade, and real equity curve.
- Added `GET /api/analytics/dashboard` and home dashboard sections for trending markets, biggest movers, recently settled, highest volume, highest open interest, and most active players.
- Added `tests/market-analytics.test.ts` with 6 focused tests for history calculations, sentiment, trending, movers, chart data generation, and portfolio analytics.
- All 127 tests pass.

## Completed - FX-006 NFL Data Engine

Implemented:

- Created `lib/nfl-data/types.ts`: shared provider types (NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord, NflSyncResult).
- Created `lib/nfl-data/provider.ts`: INflDataProvider interface with getTeams, getPlayers, getGames, getWeeks, getSlate.
- Created `lib/nfl-data/demo-provider.ts`: DemoNflDataProvider with 20 NFL teams, 13 seeded players, 10 games, full Week 1 2026 slate.
- Created `lib/nfl-data/future-provider.placeholder.ts`: FutureSportsDataProvider stub for future real-data integration.
- Created `lib/nfl-sync.service.ts`: syncNflData() — idempotent upsert of weeks, games, and players; create-only markets (never overwrites existing AMM pool state).
- Created `POST /api/admin/nfl/sync-demo`: admin-only sync endpoint; returns created/updated counts.
- Created `GET /api/admin/nfl/stats`: admin-only stats endpoint with counts and status breakdowns.
- Updated `app/admin/page.tsx`: added "NFL Data" section with stat boxes, Sync Demo button, and sync result display.
- Updated `prisma/schema.prisma`: Player.status, Player.externalProviderId, Game.externalProviderId, Game.id @default(cuid()).
- Created migration `prisma/migrations/20260628200000_fx006_nfl_data_engine/migration.sql`.
- Added `tests/nfl-data-engine.test.ts`: 27 tests covering DemoNflDataProvider unit tests, sync idempotency, duplicate prevention, admin authorization, and API endpoints.
- All 121 tests pass.

## Completed - FX-004 Market Experience

Implemented:

- Created `GET /api/markets/[marketId]` returning market, player, game, and event timeline. Auth-gated; returns 404 DomainError for missing markets.
- Created `app/markets/[marketId]/page.tsx`: player header with position/team/opponent/status badges, 6-stat grid (YES price, NO price, liquidity, volume, open interest, opening YES), inline trade panel, full event timeline.
- Created `components/trade-panel.tsx`: inline YES/NO selector with live quote (estimated shares, average entry, balance after), confirm button, disabled states, accessible error/success regions.
- Updated `app/markets/page.tsx`: added player name search, team filter dropdown, status filter dropdown, sort by kickoff/YES price asc/desc/liquidity/volume. Result count display.
- Updated `components/market-card.tsx`: added "View details" link to market detail page, opponent display, result shown on settled/void markets.
- Updated `middleware.ts`: extended route protection to `/markets/[marketId]`.
- Added `tests/market-detail.test.ts`: 10 integration tests covering serialization, opponent resolution, event ordering, NOT_FOUND error code.
- Added market detail page to axe accessibility suite (11 a11y tests total).

## Completed - FX-003 Service Layer Split

Implemented:

- Created `lib/trade.service.ts`: AMM quote, market validation, balance check, trade record, position upsert, ledger entry, market event emit.
- Created `lib/settlement.service.ts`: single-market and player-batch settlement, lock, unlock, payout, audit records, leaderboard refresh.
- Created `lib/void.service.ts`: void market, position refunds, idempotency guard, audit records, leaderboard refresh.
- Created `lib/leaderboard.service.ts`: weekly leaderboard refresh scoped to users with positions in the week.
- Created `lib/domain-errors.ts`: typed `DomainError` class with 10 stable codes and HTTP status mapping.
- Reduced `lib/db-amm.ts` to a backward-compatible re-export barrel — no logic lives there.
- Updated `lib/api-response.ts` to handle `DomainError` → structured `{ error, code }` response with correct HTTP status.
- Updated `app/api/trades/route.ts` and `app/api/settlements/route.ts` to import from service modules directly.
- Added `tests/service-layer.test.ts` with 20 new focused tests: trade YES/NO, domain error codes, settlement idempotency, void idempotency, leaderboard scoping, lock/unlock, and apiError HTTP mapping.
- All 41 existing FX-001/FX-002 tests still pass.

## Completed - FX-002 Market Event Engine

Implemented:

- Created `lib/market-event.service.ts` with typed emit functions for TRADE, PRICE_CHANGE, SETTLE, LOCK, UNLOCK, VOID, and ADMIN_NOTE events.
- Refactored `lib/db-amm.ts` to use the market event service for consistent event payloads.
- Added `POST /api/admin/adjustments` for ADMIN_ADJUSTMENT ledger entries with audit records.
- Added `POST /api/admin/notes` for ADMIN_NOTE market events.
- Added `GET /api/admin/audit-history` for querying admin audit logs with market, action, and actor filters.
- Added admin authorization boundary tests for all admin endpoints.
- Fixed `refreshLeaderboardForWeek` to scope to users with positions in the week instead of all users.
- 21 new tests covering event consistency, ordering, admin workflows, and authorization boundaries.

## Completed - FX-001 Append-Only Ledger Foundation

Implemented:

- Expanded `AccountLedgerEntry` with `adminId`, `metadata`, and `CORRECTION` support.
- Added committed Prisma migration for the current schema.
- Added append-only database trigger protection for ledger update/delete attempts.
- Added `lib/ledger-service.ts` for transaction-safe balance mutation and reconciliation.
- Refactored trade spend, settlement payout, and void refund balance changes through the ledger service.
- Added idempotency-key duplicate protection before balance mutation.
- Added reconciliation utilities for one user and all users.
- Added unit coverage for pure ledger balance math.
- Added integration coverage for seed grants, trade spend ledger rows, settlement payout ledger rows, void refund ledger rows, reconciliation mismatch detail, duplicate payout/refund prevention, metadata, admin attribution, correction entries, trade history, portfolio calculations, market history, and audit records.
- Documented ledger rows as append-only. The application exposes read-only ledger access and no route/helper for editing or deleting ledger entries.

## Completed - Sprint 1 Exchange Foundation

Implemented:

- Append-only `AccountLedgerEntry` records for seed grants, trade spends, trade proceeds, settlement payouts, and void refunds.
- Market summary fields for opening price, volume, and open interest.
- Unified `MarketEvent` records for trades, price changes, lock, unlock, settle, void, and admin notes.
- Immutable-style `AdminAuditLog` records for settlement, void, lock, and unlock actions.
- Trade History page at `/history` with week, player, position, market, and status filters.
- Market Timeline component used on `/markets` and `/history`.
- Portfolio history display for open positions, closed positions, realized P&L, unrealized P&L, average entry, current value, return %, and equity curve chart.
- Tests for ledger reconciliation, trade history, portfolio calculations, market history, audit records, and event ordering.

Remaining Sprint 1 follow-up:

- FX-002 Admin Audit: add the `ADMIN_ADJUSTMENT` workflow and complete market-edit audit coverage.
- Production load test concurrency-safe trade execution.

## P0 - Correctness and Safety Foundation - 78% Complete

Goal: make the money/market core reliable before adding new features.

1. Add Prisma migrations - complete for FX-001
   - Initial migration committed under `prisma/migrations`.
   - Follow-up: docs and scripts still need a full migrate-first workflow.

2. Add ledger-based mock balance accounting - complete for core flows
   - Completed: `AccountLedgerEntry` model.
   - Completed: seed grants, trade spends, settlement payouts, and void refunds.
   - Completed: correction support, metadata, admin attribution, idempotency keys, and reconciliation utilities.
   - Completed: `ADMIN_ADJUSTMENT` API workflow with ledger and audit records.
   - Remaining: operational reconciliation reports/alerts.

3. Split domain services - complete (FX-003)
   - Trade execution in `lib/trade.service.ts`.
   - Settlement/void logic in `lib/settlement.service.ts` and `lib/void.service.ts`.
   - Leaderboard recalculation in `lib/leaderboard.service.ts`.
   - Typed domain errors with stable codes in `lib/domain-errors.ts`.

4. Add concurrency protection - implemented in FX010
   - Trade execution uses serializable transactions.
   - User and market rows are locked during trade execution.
   - Trade idempotency keys prevent duplicate client retries.
   - Remaining: production load testing under concurrent trade pressure.

5. Add admin audit log - complete
   - Completed: settle, lock, unlock, and void audit records.
   - Completed: actor, action, market/week/player, previous state, next state, timestamp, and optional reason.
   - Completed: admin adjustment audit records, admin note events, and audit history query API.

## P1 - Auth, Authorization, and Security Hardening

Goal: harden the real account/session system before broader release.

1. Real account sessions - complete in FX009/FX009.5
   - Signed httpOnly cookie backed by server-side session rows.
   - Demo account selection removed.

2. Add CSRF protection - implemented in FX010
   - Protect authenticated cookie-backed mutating routes.
   - Cover trades, settlements, logout, settings, and admin actions.
   - Login and signup remain exempt because they create sessions.

3. Expand authorization model
   - Replace boolean-only admin checks with roles or permissions.
   - Start with `TRADER`, `ADMIN`, `SETTLEMENT_OPERATOR`, `AUDITOR`.

4. Replace in-memory rate limiting
   - Use a durable/shared store before deployment.
   - Keep route-specific limits for trade and settlement routes.

5. Add security tests - in progress
   - Non-admin cannot settle.
   - Logged-out user cannot trade.
   - Forged user ID cannot trade as another account.
   - Invalid/unsigned session is rejected.
   - Missing/invalid CSRF is rejected for sell trades.

## P2 - Testing and Developer Workflow

Goal: make changes safer and easier for future agents or contributors.

1. Add E2E smoke tests
   - Login as demo user.
   - Buy YES.
   - Confirm portfolio updates.
   - Login as admin.
   - Settle player markets.
   - Confirm payouts/leaderboard update.

2. Add test factories
   - Users, players, weeks, games, markets, positions, trades.
   - Keep DB tests compact and readable.

3. Add a single verify script
   - `npm run verify` should run lint, typecheck, unit tests, build, and optionally a11y.

4. Add reset scripts
   - `npm run db:reset`
   - `npm run db:seed`
   - `npm run db:fresh`

5. Add CI
   - Run lint, typecheck, tests, and build on PR.
   - Run a11y tests on scheduled/manual or full CI if runtime is acceptable.

## P3 - Product MVP Expansion

Goal: improve product completeness while preserving free-play constraints.

1. Add kickoff-based market locking
   - Scheduled job or server-side guard.
   - Trade route should reject markets past kickoff even if status is stale.

2. Add multi-week support
   - Week selector.
   - Week-specific leaderboard and portfolio filtering.
   - Admin week management.

3. Add fantasy scoring import workflow
   - Admin import CSV/manual table.
   - Calculate positional ranks from half-PPR scoring.
   - Settle markets from rank results.

4. Add transaction history
   - Portfolio trade list.
   - Ledger activity feed.
   - Settlement payout/refund history.

5. Add market discovery
   - Player search.
   - Team filters.
   - Sort by price, liquidity, kickoff, position, status.

## P4 - Performance and Scale

Goal: prepare for more users, markets, and live updates.

1. Add incremental leaderboard read model
   - Avoid full user/position recalculation in settlement transactions.
   - Update affected users or process recalculation asynchronously.

2. Add background jobs
   - Market locking.
   - Leaderboard recalculation.
   - Rank import processing.
   - Audit/event processing.

3. Add market price update strategy
   - Polling first.
   - SSE/WebSocket later if needed.

4. Add pagination
   - Trades.
   - Positions.
   - Admin market lists.
   - Leaderboard.

5. Add observability
   - Structured logs.
   - Request IDs.
   - Basic metrics around trade failures, settlement runs, and API latency.

## P5 - Solana Planning, Later

Goal: plan blockchain support without contaminating the free-play MVP.

1. Write a Solana architecture proposal
   - Testnet-only.
   - No deposits or withdrawals.
   - No mainnet SOL.
   - No production wagering.

2. Define account-linking model
   - Wallet address as identity link only.
   - Preserve mock credits.
   - No custody.

3. Define what belongs on-chain vs off-chain
   - Market state.
   - Trades.
   - Settlement attestations.
   - Leaderboards.

4. Complete legal/compliance review before any real-money direction.

## Suggested First Implementation Sprint

1. FX-002 Admin Audit: add admin adjustment and market edit workflows with immutable audit records.
2. Add tests for non-admin settlement rejection and admin authorization boundaries.
3. Move trade execution to `src/server/services/trade.service.ts`.
4. Add typed domain errors.
5. Add concurrent trade safety tests.
6. Remove legacy `lib/store.tsx` after confirming no imports.
