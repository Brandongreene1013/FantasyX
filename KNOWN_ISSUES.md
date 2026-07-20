# FantasyX Known Issues

Date: 2026-06-28 (updated after FX-017)

## Production Gaps

1. Trade execution concurrency needs production load testing.
   - FX010 added serializable trade transactions, row-level user/market locks, and bounded retries.
   - High-volume multi-instance behavior should still be load-tested before public beta.

2. CSRF is active, but token rotation is simple.
   - FX010 added session-bound CSRF tokens for authenticated state-changing routes.
   - Future hardening can rotate tokens periodically or per form if needed.

3. Rate limiting is in-memory.
   - Middleware rate limits are per runtime instance.
   - Use durable/shared rate limiting before broader public usage.

4. Seed resets seeded market/account data.
   - `npm run prisma:seed` is idempotent in the sense that it does not duplicate data.
   - It intentionally resets seeded market, trade, account, and analytics data and should only be run deliberately.

5. Live NFL stats and live game state are not fully connected.
   - Provider architecture exists, but `/live` quarter, clock, possession, and score are market-derived placeholders.
   - A real live NFL game-state provider is still required.

6. PWA offline mode is read-only.
   - FX017 caches the shell and GET responses, but does not queue trades, settings changes, or admin mutations while offline.
   - This is intentional to avoid stale or duplicate trade execution.

7. Browser notifications are permission/local-preference scaffolding.
   - True push notifications still require Web Push subscription persistence, a delivery service, and notification audit policy.

8. Production observability is minimal.
   - FX008 added structured server error logging and request IDs.
   - There is no external log drain, alerting, or metrics dashboard yet.

9. npm audit reports 2 moderate findings.
   - `npm install` completed successfully but reported moderate vulnerabilities.
   - No `npm audit fix --force` was run because it may introduce breaking dependency changes.

10. Account page win rate is not yet returned by `/api/account`.
    - The `winRate` field is optional on the client type and defaults to 0.
    - The "Sharp" achievement will never earn until the API is extended.

11. Home page "Locking Soon" requires `kickoffTime` on market data from the slate API.
    - If `kickoffTime` is absent or not included in the slate response, the section is silently hidden.

12. Pixel avatars at xs/sm sizes lose detail due to the small grid.
    - Use medium or larger avatars for meaningful display.

13. Market board row-flash works best when SSE is connected.
    - Polling fallback is reliable, but visual flash timing is less precise.

14. Gainers/Losers sections can be empty until demo trades move market prices away from opening price.
    - Run `npm run prisma:seed` to populate demo trade movement locally.

15. Vercel Hobby plan serverless functions can recycle SSE connections.
    - The `useLiveExchange` hook falls back to polling every 12 seconds automatically on SSE error/disconnect.

16. `openingPrice` must be set at market creation for 24h move percentage calculations.
    - The exchange ticker and movers use `(yesPrice - openingPrice) / openingPrice`.

17. FX026 database-backed and browser flow verification requires a running local PostgreSQL service.
    - On 2026-07-18, DB-backed Vitest checks failed before assertions because `localhost:5432` was unreachable.
    - Re-run `npm run test`, `npm run test:a11y`, and `npm run test:e2e` after starting PostgreSQL and preparing the database.
    - Manual buy, partial sell, MAX sell, refresh persistence, and mobile layout checks still need browser verification in that environment.

## Not Allowed Without Separate Approval

- Real-money wagering.
- Deposits or withdrawals.
- Custody.
- Mainnet Solana.
- Production smart contracts.
- Crypto settlement.
