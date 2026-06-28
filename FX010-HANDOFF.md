# FX010 Handoff - Sell Positions, Trade Integrity & CSRF

## Summary

FX010 adds sell-position functionality and hardens authenticated trading. FantasyX remains free-play and mock-credit only. No Solana, crypto, deposits, withdrawals, real money, wagering, or automated scoring work was added.

## Completed

- Added AMM sell quote/execution math for YES and NO shares.
- Added sell execution service for existing positions.
- Updated `POST /api/trades` to support `BUY` and `SELL`.
- Added `TradeAction` and `Trade.idempotencyKey`.
- Added `LedgerEntryType.TRADE_PROCEEDS`.
- Added Prisma migration `20260628235000_fx010_sell_csrf_trade_integrity`.
- Added serializable trade transactions with PostgreSQL row locks on user and market rows.
- Added bounded retry for serialization/write-conflict errors.
- Added kickoff guard for buy and sell trades.
- Added session-bound CSRF tokens through `/api/session`.
- Added CSRF validation to authenticated state-changing routes.
- Updated client API helpers to send `x-csrf-token`.
- Added sell controls to market detail and portfolio open positions.
- Updated portfolio/trade-history DTOs to include buy/sell action.

## Sell Behavior

- Selling YES adds YES shares back to the AMM pool and pays proceeds out of the NO pool.
- Selling NO adds NO shares back to the AMM pool and pays proceeds out of the YES pool.
- Positions reduce the sold side's shares.
- Cost basis is reduced proportionally by sold shares.
- User mock balance increases through a `TRADE_PROCEEDS` ledger row.
- A `SELL` trade row records side, shares, proceeds, prices, and idempotency key.

## CSRF

- Logged-in clients receive `csrfToken` from `GET /api/session`.
- Mutating client helpers send `x-csrf-token`.
- Missing or invalid tokens return 403.
- Login and signup are exempt because they create sessions.

## Concurrency Strategy

- `POST /api/trades` runs buy and sell execution in serializable Prisma transactions.
- The trade service locks the user and market rows before reading balances, pools, positions, or trade idempotency rows.
- Serialization/write-conflict errors are retried with a bounded retry loop.
- Client retries use `Trade.idempotencyKey` so repeated submissions return the existing trade instead of executing twice.

## Tests

- Sell YES.
- Sell NO.
- Cannot sell more shares than owned.
- Sell updates balance, position, ledger, and trade history.
- Locked, settled, and void markets reject sells.
- Missing/invalid CSRF rejected.
- Valid CSRF accepted.
- Duplicate trade idempotency key does not duplicate execution.

## Verification

- `npm install` - passed; npm audit still reports 2 moderate findings
- `npm run prisma:generate` - passed
- `npx prisma migrate deploy` - passed locally
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm test` - passed, 150 tests across 10 files
- `npm run build` - passed
- `npx vercel deploy --prod --yes` - passed
- Production migration `20260628235000_fx010_sell_csrf_trade_integrity` - applied during Vercel build
- Production smoke on `https://fantasy-x.vercel.app` - passed signup, session/CSRF, buy YES, sell YES, portfolio refresh
- Production CSRF smoke - authenticated trade without `x-csrf-token` returned 403

## Remaining Work

- Production load testing for concurrent trades.
- Durable/shared rate limiting.
- Admin create-market UI.
