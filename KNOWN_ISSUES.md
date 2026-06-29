# FantasyX Known Issues

Date: 2026-06-28 (updated after FX-016.5)

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

9. Account page win rate is not yet returned by `/api/account`.
   - The `winRate` field is optional on the client type and defaults to 0.
   - The "Sharp" achievement (win rate > 60%) will never earn until the API is extended.
   - Fix: add `winRate` calculation to `app/api/account/route.ts` using trade history.

10. Home page "Locking Soon" requires `kickoffTime` on market data from the slate API.
    - If `kickoffTime` is absent or not included in the slate response, the section is silently hidden.
    - Fix: verify `kickoffTime` is included in `/api/slate` market objects.

13. Pixel avatars at xs/sm sizes (24–32px) lose detail due to 16×16 grid — use md+ for meaningful display.

14. Market board row-flash only works when SSE is connected; polling fallback (12s) does not trigger flashes since there is no price diff tracking on REST responses.

15. Gainers/Losers sections on home page are empty until demo trades move market prices away from openingPrice. Run `npm run prisma:seed` to populate demo data.

12. Vercel Hobby plan serverless functions time out (10–60s), which recycles SSE connections.
    - The `useLiveExchange` hook falls back to polling every 12s automatically on SSE error/disconnect.
    - Fix: upgrade to Vercel Pro for longer function duration, or use Edge Runtime with Durable Objects for persistent SSE.

11. `openingPrice` must be set at market creation for 24h move % calculations.
    - The exchange ticker and home movers use `(yesPrice - openingPrice) / openingPrice`.
    - If `openingPrice` is 0, move% is always 0 and movers/gainers/losers sections will be empty.
    - Fix: verify AMM seed and market generation sets `openingPrice` to the initial yes price.

## Not Allowed Without Separate Approval

- Real-money wagering.
- Deposits or withdrawals.
- Custody.
- Mainnet Solana.
- Production smart contracts.
- Crypto settlement.
