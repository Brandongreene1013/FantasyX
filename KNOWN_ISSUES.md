# FantasyX Known Issues

Date: 2026-06-28

## Production Gaps

1. Admin create-market UI is not implemented.
   - Markets are created by seed data and NFL sync.
   - Arbitrary market creation requires validation, audit policy, duplicate prevention, and admin UI.

2. Trade execution concurrency needs production load testing.
   - FX010 added serializable trade transactions, row-level user/market locks, and bounded retries.
   - High-volume multi-instance behavior should still be load-tested before public beta.

3. CSRF is active, but token rotation is simple.
   - FX010 added session-bound CSRF tokens for authenticated state-changing routes.
   - Future hardening can rotate tokens periodically or per form if needed.

4. Rate limiting is in-memory.
   - Middleware rate limits are per runtime instance.
   - Use durable/shared rate limiting before broader public usage.

5. Seed resets seeded market/account data.
   - `npm run prisma:seed` is idempotent in the sense that it does not duplicate data.
   - It intentionally resets seeded market, trade, account, and analytics data and should only be run deliberately.

6. Live NFL stats are not connected.
   - FX-006 added provider abstraction and demo sync.
   - Player projections/history still use demo model data until a real provider is connected.

7. Production observability is minimal.
   - FX008 added structured server error logging and request IDs.
   - There is no external log drain, alerting, or metrics dashboard yet.

8. npm audit reports 2 moderate findings.
   - `npm install` completed successfully but reported moderate vulnerabilities.
   - No `npm audit fix --force` was run because it may introduce breaking dependency changes.

## Not Allowed Without Separate Approval

- Real-money wagering.
- Deposits or withdrawals.
- Custody.
- Mainnet Solana.
- Production smart contracts.
- Crypto settlement.
