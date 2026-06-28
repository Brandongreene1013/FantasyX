# TODO

## Completed - FX-003 Service Layer Split

1. Created `lib/trade.service.ts` with `executeDbBuy`: market/user validation, AMM quote, trade record, market pool update, ledger entry, market event emit, position upsert.
2. Created `lib/settlement.service.ts` with `settleDbMarket`, `settleDbPlayerMarkets`, `lockDbMarket`, `openDbMarket`: settlement lifecycle, payout, audit records, leaderboard refresh.
3. Created `lib/void.service.ts` with `voidDbMarket`: void guard, position refunds, idempotency, audit records, leaderboard refresh.
4. Created `lib/leaderboard.service.ts` with `refreshLeaderboardForWeek`: scoped to users with positions in the week only.
5. Created `lib/domain-errors.ts` with `DomainError` class: 10 stable error codes, HTTP status mapping.
6. Reduced `lib/db-amm.ts` to backward-compatible re-export barrel. No logic remains in that file.
7. Updated `lib/api-response.ts` to map `DomainError` → `{ error, code }` with correct HTTP status code.
8. Updated `app/api/trades/route.ts` and `app/api/settlements/route.ts` to import from service modules directly.
9. Added `tests/service-layer.test.ts`: 20 new tests for trade YES/NO, insufficient balance, market status guards, settlement idempotency, void idempotency, leaderboard scoping, lock/unlock, and domain error HTTP mapping.
10. All 41 existing FX-001/FX-002 tests still pass. Total: 61 tests.

## Completed - FX-002 Market Event Engine

1. Created `lib/market-event.service.ts` with typed emit functions for all event types.
2. Refactored `lib/db-amm.ts` to use the market event service instead of inline `createMarketEvent` calls.
3. Added `ADMIN_ADJUSTMENT` API workflow with ledger entries and admin audit records.
4. Added `ADMIN_NOTE` market event workflow through API.
5. Added admin audit history query API with market, action, and actor filters.
6. Added admin authorization boundary tests (non-admin rejection for adjustments, notes, audit history, settlements).
7. Added unauthenticated request rejection tests.
8. Fixed `refreshLeaderboardForWeek` to scope to users with positions in the week.
9. 21 new tests covering event consistency, ordering, admin workflows, and authorization.

## P0 - Next Implementation Ticket

1. Add concurrency-safe trade execution with row-level locking (SELECT FOR UPDATE on market and user rows).
2. Add E2E smoke tests for login -> trade -> portfolio and admin -> settlement -> payout.
3. Add `ADMIN_ADJUSTMENT` admin UI page.

## P1 - Newly Discovered Technical Debt

1. `User.mockBalance` is still a mutable cached balance; add scheduled reconciliation checks and admin-visible mismatch alerts.
2. Settlement and void idempotency rely partly on position payout state; move toward explicit payout/refund records.
3. Migration workflow exists but setup docs/scripts still reference `prisma db push`.
4. Market events are recorded, but no market detail page exists for a single full timeline.
5. Equity curve is a placeholder using simple bars instead of a real chart component.
6. `ADMIN_ADJUSTMENT` workflow exists via API but has no admin UI page yet.
7. No pagination yet for trade history, ledger entries, or market events.

## P2 - Bugs / Risk Areas To Watch

1. Concurrent trades may still read stale market pool or user balance data — row-level locking needed.
2. The append-only trigger is committed in migration; local `prisma db push` databases do not automatically receive trigger behavior.
3. Seed resets all exchange history; this is fine for local demo but not for persistent environments.
4. In-memory rate limiting is not durable across instances.
5. Demo auth uses mock accounts and is not production authentication.
6. Legacy `lib/store.tsx` can confuse future work if accidentally imported.
7. Trade request idempotency keys are not implemented yet; only ledger mutations have idempotency coverage.

## P3 - Future Improvements

1. Add kickoff-based automatic market locking.
2. Add multi-week slate navigation.
3. Add player search, team filters, and market sorting.
4. Add fantasy rank/scoring import workflow.
5. Add richer leaderboard filtering by week.
6. Add market detail pages with full event timelines and price/liquidity charts.
7. Replace browser event refreshes with query/mutation invalidation.

## P4 - Nice-To-Have Enhancements

1. Add a real chart library for equity curves and market history.
2. Add CSV export for trade history and ledger entries.
3. Add admin notes directly from market timeline.
4. Add user-facing account statement page from ledger entries.
5. Add a single `npm run verify` command for lint, typecheck, tests, and build.

## P5 - Later Solana Planning

1. Keep Solana design separate from the free-play MVP.
2. Start with testnet-only wallet identity linking.
3. Do not add deposits, withdrawals, custody, mainnet SOL, or real-money wagering until the free-play product is validated and reviewed.
