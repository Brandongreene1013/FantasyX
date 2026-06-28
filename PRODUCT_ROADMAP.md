# FantasyX Product Roadmap

This roadmap breaks FantasyX into engineering sprints. The product remains free-play/mock-credit until explicitly reviewed and approved otherwise.

## Sprint 0 - Architecture Baseline

Goal:

Establish the current MVP as a maintainable, reviewable baseline.

Features:

- Architecture review complete.
- Source-of-truth planning docs complete.
- Current free-play constraints documented.

Database changes:

- None.

API changes:

- None.

UI changes:

- None.

Tests required:

- No new tests for documentation-only sprint.

Definition of Done:

- `ARCHITECTURE_REVIEW.md`, `ROADMAP.md`, `TECH_DEBT.md`, `PRODUCT_ROADMAP.md`, `PRODUCT_REQUIREMENTS_DOCUMENT.md`, `SYSTEM_ARCHITECTURE.md`, and `DEVELOPMENT_STANDARDS.md` exist and are current.

Estimated complexity:

- Low.

Dependencies:

- Completed architecture review.

Risk level:

- Low.

## Sprint 1 - Database Discipline and Ledger Foundation

Goal:

Make mock-credit accounting auditable and schema changes repeatable.

Features:

- Prisma migrations introduced.
- Append-only account ledger added.
- Existing balance mutations routed through ledger-aware services.
- Seed data creates ledger entries for starting mock credits.

Database changes:

- Add initial Prisma migration.
- Add `AccountLedgerEntry`.
- Optional: add balance snapshot/cache fields if needed.
- Add indexes on `userId`, `type`, `createdAt`, and related trade/settlement IDs.

API changes:

- No new public routes required.
- Trade and settlement APIs should return ledger-aware balance results.

UI changes:

- Portfolio/account bar should continue showing mock balance.
- Optional internal transaction history can remain hidden until Sprint 6.

Tests required:

- Ledger entry created on trade spend.
- Ledger entry created on settlement payout.
- Ledger entry created on void refund.
- User balance reconciles with ledger.
- Existing money/market tests continue passing.

Definition of Done:

- Migrations replace `prisma db push` in primary setup docs.
- Every balance-affecting operation writes a ledger entry.
- Balance reconciliation test passes.
- No direct untracked mock-balance mutation remains in domain services.

Estimated complexity:

- Medium-High.

Dependencies:

- Current Prisma schema.
- Current trade and settlement services.

Risk level:

- High, because this touches core money-like state.

## Sprint 2 - Domain Service Refactor

Goal:

Separate product rules from route handlers and reduce `lib/db-amm.ts` coupling.

Features:

- Trade service.
- Settlement service.
- Void/refund service.
- Leaderboard service.
- Typed domain errors.
- Market lifecycle policy.

Database changes:

- Optional `MarketEvent` or `AdminAuditLog` if included here; otherwise defer to Sprint 4.

API changes:

- Existing APIs call services instead of broad utility helpers.
- API errors map domain error codes to stable HTTP responses.

UI changes:

- No intentional visual changes.
- UI should use stable error messages from API.

Tests required:

- Unit tests for market lifecycle policy.
- Service-level tests for trade, settlement, void, and leaderboard.
- API route tests for mapped error responses.

Definition of Done:

- `lib/db-amm.ts` is deleted or reduced to pure compatibility exports.
- Trade, settlement, void, and leaderboard logic are independently testable.
- Domain errors have stable codes.

Estimated complexity:

- High.

Dependencies:

- Sprint 1 ledger decisions.

Risk level:

- High, because refactor touches core behavior.

## Sprint 3 - Auth and Security Hardening

Goal:

Use real free-play user accounts while preventing unsafe session assumptions and easy tampering.

Status:

- Completed in FX009 for real account creation, password hashing, server-side sessions, role-backed admin authorization, account/settings pages, and demo-login removal.
- FX009.5 hardened route protection, safe login redirects, admin-email signup reservation, stale documentation cleanup, and auth routing tests.
- FX010 added session-bound CSRF protection for authenticated mutations, sell trades, trade idempotency keys, and serializable trade execution.
- Remaining hardening: durable/shared rate limiting.

Features:

- Server-side session table.
- Signed httpOnly session cookie.
- Authorization guard helpers.
- Durable rate-limit adapter interface.

Database changes:

- Optional `Session` table if server-side sessions are chosen.
- Optional `Role`/`Permission` fields or tables.

API changes:

- Login issues signed/server-side session.
- Logout invalidates session.
- Authenticated mutating routes require CSRF validation.
- Admin APIs use permission guard.

UI changes:

- Login uses email/password.
- Signup creates a real account with 10,000 mock credits.
- Account/settings pages expose platform identity.
- AccountBar remains visually similar.

Tests required:

- Forged session rejected.
- Missing CSRF rejected for authenticated mutations.
- Non-admin cannot settle.
- Logged-out user cannot trade.
- Existing forged `userId` test remains.

Definition of Done:

- Raw `userId` cookie is gone.
- Sensitive routes validate an authenticated server session.
- Admin access is enforced server-side by role/permission.
- CSRF protection covers authenticated mutating routes before broader public release.

Estimated complexity:

- Medium-High.

Dependencies:

- Existing account/session implementation.

Risk level:

- Medium-High.

## Sprint 4 - Admin Audit and Market Operations

Goal:

Make admin market operations traceable and safer.

Features:

- Admin audit log.
- Admin action reasons.
- Market lifecycle validation.
- Settlement correction design documented.

Database changes:

- Add `AdminAuditLog` or `MarketEvent`.
- Add fields for actor, action, target, previous state, new state, reason, timestamp.

API changes:

- Settlement, lock, open, void APIs write audit events.
- Admin routes accept optional reason.

UI changes:

- Admin action forms include optional reason.
- Admin page shows recent audit events per market/player.

Tests required:

- Audit event created for lock/open/void/settle.
- Audit event captures actor.
- Invalid lifecycle transition rejected.

Definition of Done:

- Every admin state change is auditable.
- Admin UI exposes enough context for review.

Estimated complexity:

- Medium.

Dependencies:

- Sprint 2 services.
- Sprint 3 auth guards.

Risk level:

- Medium.

## Sprint 5 - E2E Coverage and Developer Workflow

Goal:

Make the project safer for future iteration and handoffs.

Features:

- E2E smoke tests.
- Test factories.
- One-command verification.
- DB reset scripts.
- CI workflow.

Database changes:

- Test fixtures/factories only.

API changes:

- None unless testability requires small helper routes in test-only mode.

UI changes:

- None.

Tests required:

- Login -> buy YES -> portfolio updates.
- Admin login -> settle player -> payout updates.
- Non-admin admin access denied.
- Accessibility suite remains green.

Definition of Done:

- `npm run verify` exists and passes.
- CI runs lint, typecheck, tests, and build.
- E2E smoke suite covers critical paths.

Estimated complexity:

- Medium.

Dependencies:

- Stable auth from Sprint 3.

Risk level:

- Medium.

## Sprint 6 - Portfolio and Ledger UX

Goal:

Expose account activity and improve user trust in mock-credit balances.

Features:

- Transaction history.
- Trade history.
- Settlement payout/refund history.
- Portfolio filters by week/status.

Database changes:

- Uses ledger from Sprint 1.
- Optional indexes for ledger history pagination.

API changes:

- `GET /api/account/activity`
- Optional portfolio query params for week/status.

UI changes:

- Portfolio activity tab/section.
- Clear realized vs unrealized P&L.
- Empty states for no trades, no payouts, no refunds.

Tests required:

- Activity endpoint pagination.
- Ledger entries render correctly.
- Realized/unrealized P&L cases.

Definition of Done:

- Users can explain their mock balance from activity history.
- Portfolio remains accessible and mobile-friendly.

Estimated complexity:

- Medium.

Dependencies:

- Sprint 1 ledger.

Risk level:

- Medium.

## Sprint 7 - Week and Slate Management

Goal:

Move beyond a single seeded Week 1 slate.

Features:

- Multi-week navigation.
- Admin week management.
- Slate creation/import workflow.
- Kickoff-based locking.

Database changes:

- Review `NflWeek.status` enum.
- Optional slate import tables.
- Optional scheduled job metadata.

API changes:

- `GET /api/weeks`
- Admin week/slate management routes.
- Trade route rejects markets past kickoff even if stale status says open.

UI changes:

- Week selector on markets, portfolio, leaderboard, admin.
- Admin slate management screen.

Tests required:

- Week switching.
- Past-kickoff trade rejection.
- Slate import validation.
- Lock job behavior.

Definition of Done:

- App supports more than one NFL week without code changes.
- Markets cannot remain tradeable after kickoff.

Estimated complexity:

- High.

Dependencies:

- Sprint 2 services.
- Sprint 5 E2E baseline.

Risk level:

- High.

## Sprint 8 - Scoring Import and Settlement Automation

Goal:

Reduce manual settlement errors.

Features:

- Half-PPR fantasy scoring import.
- Rank calculation by position/week.
- Preview settlement before commit.
- Batch settlement.

Database changes:

- Add scoring import records.
- Add player weekly score/rank records.

API changes:

- Admin scoring upload/import endpoint.
- Settlement preview endpoint.
- Batch settlement endpoint.

UI changes:

- Admin import screen.
- Settlement preview table.
- Error reporting for missing players or invalid ranks.

Tests required:

- Half-PPR score calculation.
- Rank tie handling.
- Preview does not mutate state.
- Batch settlement pays once.

Definition of Done:

- Admin can import scores, preview outcomes, and settle a week safely.

Estimated complexity:

- High.

Dependencies:

- Sprint 4 audit.
- Sprint 7 week management.

Risk level:

- High.

## Sprint 9 - Performance and Real-Time Readiness

Goal:

Prepare for more users, markets, and frequent price changes.

Features:

- Incremental leaderboard updates.
- Pagination.
- Polling or SSE for market prices.
- Basic observability.

Database changes:

- Add indexes for high-volume reads.
- Optional read-model tables for portfolio/leaderboard.

API changes:

- Paginated routes.
- Price polling endpoint or SSE stream.
- Request IDs and structured error responses.

UI changes:

- Live/stale price indicators.
- Pagination or infinite scroll where needed.

Tests required:

- Pagination tests.
- Leaderboard update tests.
- Price refresh behavior.

Definition of Done:

- Larger seed datasets remain responsive.
- Leaderboard no longer requires full synchronous recalculation in settlement path.

Estimated complexity:

- Medium-High.

Dependencies:

- Sprint 2 service boundaries.

Risk level:

- Medium.

## Sprint 10 - Solana Testnet Architecture Prototype

Goal:

Design and prototype wallet-linked, testnet-only architecture without real-money behavior.

Features:

- Wallet linking as identity only.
- Testnet design proposal.
- Prototype read-only wallet connect.
- No deposits, withdrawals, custody, mainnet SOL, or wagering.

Database changes:

- Review `walletAddress`.
- Add wallet link audit/history if needed.

API changes:

- Wallet-link challenge/verify routes.
- Wallet unlink route.

UI changes:

- Optional wallet connect/link account panel.
- Clear testnet/free-play copy.

Tests required:

- Wallet signature challenge verification.
- Wallet cannot alter balances.
- Linked wallet cannot bypass auth/permissions.

Definition of Done:

- Wallet linking is identity-only.
- No money movement exists.
- Solana architecture proposal is approved before program work.

Estimated complexity:

- High.

Dependencies:

- Security hardening.
- Product/legal decision.

Risk level:

- High.
