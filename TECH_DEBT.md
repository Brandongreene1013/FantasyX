# FantasyX Technical Debt Register

This file tracks known technical debt after the architectural review. Priorities are based on correctness risk, future feature friction, and security impact.

## P0 - Must Address Before Public Beta

### TD-001: No append-only balance ledger

Impact: High

Current State:

- `User.mockBalance` is directly updated during trades, settlement payouts, and void refunds.
- `Position.realizedPayout` is used as an idempotency marker.

Risk:

- Balance corruption is hard to audit.
- Double-pay and double-refund prevention depends on position state.
- Future wallet-linked flows will need an auditable source of truth.

Recommendation:

- Add `AccountLedgerEntry`.
- Record every balance-affecting event.
- Treat `mockBalance` as derived or cached.

### TD-002: Trade execution lacks explicit concurrency control

Impact: High

Current State:

- Trades run inside Prisma transactions, but there is no explicit row lock or optimistic version field for market pools/user balances.

Risk:

- Simultaneous trades may read stale pool or balance state.
- Market price movement can be overwritten.

Recommendation:

- Add transaction isolation review.
- Use row-level locking where practical or optimistic concurrency via version fields.
- Add concurrent trade tests.

### TD-003: CSRF protection for real account sessions

Impact: High

Current State:

- Real accounts use signed httpOnly cookies backed by server-side `Session` rows.
- Cookie-authenticated POST routes do not validate CSRF tokens.

Risk:

- Browser-authenticated users could be induced to submit state-changing requests.

Recommendation:

- Add CSRF token issuance and validation.
- Cover trade, settlement, account, settings, and auth state-changing routes.

### TD-004: Durable/shared rate limiting

Impact: High

Current State:

- Middleware rate limiting uses an in-memory map per runtime instance.

Risk:

- Limits are not shared across serverless instances.

Recommendation:

- Move rate limiting to a durable/shared store before broader release.

### TD-005: No committed migrations

Impact: High

Current State:

- Project uses `prisma db push`.

Risk:

- Schema changes are not versioned.
- Harder handoff, review, rollback, and deployment.

Recommendation:

- Create initial migration from current schema.
- Adopt `prisma migrate dev` locally and `prisma migrate deploy` in CI/deploy.

## P1 - Important MVP Hardening

### TD-006: `lib/db-amm.ts` is too broad

Impact: Medium-High

Current State:

- Trading, settlement, voiding, payouts, and leaderboard refresh live in one file.

Risk:

- Hard to reason about invariants.
- Future changes can create regressions across unrelated workflows.

Recommendation:

- Split into trade, settlement, payout, void, and leaderboard services.

### TD-007: Leaderboard recalculation scans all users

Impact: Medium-High

Current State:

- `refreshLeaderboardForWeek` loads all users and positions.

Risk:

- Poor scaling as user count grows.
- Settlement transactions get slower.

Recommendation:

- Recalculate affected users only.
- Move full recalculation to a background job.
- Consider weekly user stats table.

### TD-008: No admin audit trail

Impact: Medium-High

Current State:

- Settlement records capture settled user for settled markets, but lock/open/void actions have no audit log.

Risk:

- Admin mistakes or malicious actions are hard to investigate.

Recommendation:

- Add `AdminAuditLog` or `MarketEvent`.
- Record previous state, new state, actor, action, and reason.

### TD-009: Legacy localStorage store remains

Impact: Medium

Current State:

- `lib/store.tsx` still exists but is not used for real state.

Risk:

- Future agents may accidentally reintroduce it.
- Confuses architecture handoff.

Recommendation:

- Delete it or move to `archive/legacy-store.tsx` with a clear warning.

### TD-010: Client fetching is manual and duplicated

Impact: Medium

Current State:

- Pages use `useEffect`, local loading state, and manual retry handling.
- `window.dispatchEvent("fantasyx:data-changed")` coordinates refreshes.

Risk:

- Inconsistent stale data behavior.
- Harder to add live updates.

Recommendation:

- Add TanStack Query or internal hooks.
- Use mutation invalidation instead of browser events.

### TD-011: API response contracts can drift

Impact: Medium

Current State:

- Zod validates requests, but responses are manually typed in `lib/client-api.ts`.

Risk:

- Client assumptions can drift from API responses.

Recommendation:

- Add DTO mappers and shared response types.
- Consider response validation for critical routes.

### TD-012: Domain errors are plain strings

Impact: Medium

Current State:

- Business logic throws `Error("Market is not open")`, etc.

Risk:

- UI and API cannot reliably branch by error type/code.
- Error messages may leak implementation details.

Recommendation:

- Add `DomainError` with stable codes and safe public messages.

## P2 - Quality and Developer Experience

### TD-013: Missing E2E smoke tests

Impact: Medium

Current State:

- Unit/integration business tests and a11y tests exist.
- No full user-flow tests.

Risk:

- Login, trade, and portfolio integration can break while lower-level tests pass.

Recommendation:

- Add Playwright smoke tests for login, buy, portfolio, admin settlement.

### TD-014: No test factories

Impact: Medium

Current State:

- Tests manually create all database records.

Risk:

- Tests become verbose and inconsistent.

Recommendation:

- Add factories for users, weeks, games, players, markets, positions, and trades.

### TD-015: Admin page is too large

Impact: Medium

Current State:

- `app/admin/page.tsx` mixes fetching, authorization display, mutation, and all rendering.

Risk:

- Hard to maintain as admin workflows grow.

Recommendation:

- Split into feature components and hooks.

### TD-016: No design-system primitives

Impact: Low-Medium

Current State:

- Buttons, cards, badges, state panels, and metrics are repeated.

Risk:

- Inconsistent accessibility and styling over time.

Recommendation:

- Add `components/ui` primitives.

### TD-017: Manual modal focus trap

Impact: Low-Medium

Current State:

- `TradeModal` implements focus trapping manually.

Risk:

- Future modals may duplicate or regress keyboard behavior.

Recommendation:

- Extract accessible `Dialog` primitive or use a proven headless dialog library.

### TD-018: Prisma seed config deprecation warning

Impact: Low

Current State:

- Prisma warns that `package.json#prisma` seed config will be removed in Prisma 7.

Risk:

- Future Prisma upgrade friction.

Recommendation:

- Move to `prisma.config.ts` when upgrading Prisma workflow.

### TD-019: Generated/log files present in workspace

Impact: Low

Current State:

- `.next`, `node_modules`, logs, test results, and tsbuildinfo exist locally.

Risk:

- Handoff noise and accidental archive inclusion.

Recommendation:

- Keep `.gitignore` strict.
- Add `.dockerignore`.
- Use clean archive script.

## P3 - Strategic Future Debt

### TD-020: No market lifecycle state machine

Impact: Medium

Current State:

- Market transitions are enforced by ad hoc checks.

Risk:

- Future reopen, correction, cancellation, and settlement-review flows get messy.

Recommendation:

- Define allowed transitions in a state machine/policy module.

### TD-021: No scheduled jobs

Impact: Medium

Current State:

- Market locking and settlement are manual.

Risk:

- Markets may remain open after kickoff unless admins act.

Recommendation:

- Add job runner for kickoff lock and leaderboard refresh.

### TD-022: No real-time market update model

Impact: Medium

Current State:

- Pages refetch manually after trades.

Risk:

- Multiple users can see stale prices.

Recommendation:

- Start with polling.
- Later evaluate SSE or WebSocket.

### TD-023: Solana boundary is undefined

Impact: Medium

Current State:

- Schema has `walletAddress`, but no wallet-linking architecture.

Risk:

- Future Solana work could leak into core market logic prematurely.

Recommendation:

- Write a separate Solana testnet architecture proposal.
- Keep wallet identity separate from money movement.

## Suggested Debt Burn-Down Order

1. TD-005: Add migrations.
2. TD-001: Add ledger.
3. TD-002: Add trade concurrency controls.
4. TD-006: Split domain services.
5. TD-003 and TD-004: CSRF and durable rate limiting.
6. TD-008: Admin audit log.
7. TD-013: E2E smoke tests.
8. TD-009: Remove legacy store.
9. TD-010: Add query/mutation hooks.
10. TD-020: Add market lifecycle state machine.
