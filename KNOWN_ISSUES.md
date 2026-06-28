# FantasyX Known Issues

Date: 2026-06-28

## Production Gaps

1. Sell positions are not implemented.
   - Current app supports buy YES, buy NO, settlement payouts, and void refunds.
   - There is no sell quote, sell execution service, sell ledger type, API route, UI, or test coverage.
   - This should be its own product/trading sprint because it changes AMM and ledger behavior.

2. Admin create-market UI is not implemented.
   - Markets are created by seed data and NFL sync.
   - Arbitrary market creation requires validation, audit policy, duplicate prevention, and admin UI.

3. Trade execution lacks explicit concurrency locking.
   - Current transactions are atomic for ordinary execution.
   - Simultaneous trade pressure can still risk stale market pool or balance reads.
   - Recommended next ticket: row-level locking or serializable transaction strategy.

4. Demo auth is not production-grade identity.
   - Demo account selection uses an httpOnly cookie with account ID.
   - This remains acceptable only for free-play MVP/demo usage.

5. Rate limiting is in-memory.
   - Middleware rate limits are per runtime instance.
   - Use durable/shared rate limiting before broader public usage.

6. Seed resets demo data.
   - `npm run prisma:seed` is idempotent in the sense that it does not duplicate data.
   - It intentionally resets demo data and should only be run deliberately.

7. Live NFL stats are not connected.
   - FX-006 added provider abstraction and demo sync.
   - Player projections/history still use demo model data until a real provider is connected.

8. Production observability is minimal.
   - FX008 added structured server error logging and request IDs.
   - There is no external log drain, alerting, or metrics dashboard yet.

9. npm audit reports 2 moderate findings.
   - `npm install` completed successfully but reported moderate vulnerabilities.
   - No `npm audit fix --force` was run because it may introduce breaking dependency changes.

## Not Allowed Without Separate Approval

- Real-money wagering.
- Deposits or withdrawals.
- Custody.
- Mainnet Solana.
- Production smart contracts.
- Crypto settlement.
