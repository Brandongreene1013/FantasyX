# FantasyX Architecture Review

Date: 2026-06-28

Scope: database, API, authentication, authorization, business logic, AMM, state management, folder structure, components, performance, accessibility, testing, security, scalability, and developer experience.

This review intentionally does not refactor code. It documents current state, risks, and recommended direction before further implementation.

## Executive Summary

FantasyX is in a solid MVP state: it has a working Next.js App Router frontend, Prisma/Postgres persistence, mock account selection, session-derived trades, admin-only settlement APIs, focused money/market tests, and axe accessibility coverage.

The main architectural weakness is that product logic, persistence logic, and API route orchestration are still concentrated in broad utility files such as `lib/db-amm.ts` and page-level client components. That is acceptable for an MVP, but it will become fragile as markets, weeks, leaderboards, settlement workflows, audits, and eventual wallet-linked accounts expand.

The highest-impact next move is to introduce clear domain/service boundaries and a proper ledger model before adding more features.

## Area Review

### 1. Database

Grade: B-

Problems:

- Schema covers core MVP entities but lacks a true money ledger.
- `User.mockBalance` is mutable state without an auditable transaction table.
- `Position.costBasis` is aggregated, which loses lot-level accounting detail.
- Settlement and void payouts use `Position.realizedPayout` as an idempotency marker, blending payout state into position state.
- No committed migrations; workflow uses `prisma db push`.
- `NflWeek.status` is a plain string while market status uses enums.
- No indexes for some future admin queries, such as unsettled markets by week/status/player.

Technical Debt:

- Mutable balances are easy to corrupt under concurrency.
- Financial-like state is not append-only, even though it should be auditable.
- Decimal precision choices are MVP-friendly but should be reviewed before higher volume or on-chain simulation.

Recommended Refactors:

- Add committed Prisma migrations.
- Add `BalanceLedgerEntry` or `AccountTransaction` model for deposits of mock credits, trade spends, payouts, refunds, and adjustments.
- Add `MarketEvent` or `AdminAuditLog` for lock/open/settle/void actions.
- Convert `NflWeek.status` to an enum.
- Add explicit settlement idempotency constraints per market/action.

Suggested Folder Structure:

```text
src/server/db/
|-- prisma.ts
|-- repositories/
|   |-- markets.repository.ts
|   |-- users.repository.ts
|   |-- positions.repository.ts
|   `-- leaderboard.repository.ts
`-- migrations/
```

Suggested Design Patterns:

- Repository pattern for database reads/writes.
- Append-only ledger for all balance mutations.
- Idempotency key pattern for settlement and void operations.

Long-Term Scalability Concerns:

- Direct balance mutation will not scale to concurrent trading or external settlement.
- Leaderboard recalculation over all users will become expensive.
- Adding Solana later will be harder without a clean off-chain ledger abstraction.

### 2. API

Grade: B

Problems:

- API routes are thin, which is good, but they call broad utility functions directly.
- Response shapes are manually duplicated in `lib/client-api.ts`.
- Error responses are simple but not standardized enough for larger clients.
- No route-level OpenAPI/schema documentation.
- No versioning strategy.

Technical Debt:

- Route handlers, Zod schemas, and client response types can drift.
- API errors expose raw `Error.message`, which is useful in development but risky later.
- Routes do not consistently separate command APIs from query APIs.

Recommended Refactors:

- Introduce service functions such as `tradeService.buyShares`, `portfolioService.getPortfolio`, and `settlementService.settlePlayer`.
- Add shared response DTO mappers.
- Standardize error codes: `AUTH_REQUIRED`, `INSUFFICIENT_BALANCE`, `MARKET_NOT_OPEN`, etc.
- Keep Zod schemas near route contracts.

Suggested Folder Structure:

```text
src/server/api/
|-- routes/
|-- schemas/
|-- responses/
`-- errors.ts

src/server/services/
|-- trade.service.ts
|-- portfolio.service.ts
|-- settlement.service.ts
|-- slate.service.ts
`-- leaderboard.service.ts
```

Suggested Design Patterns:

- Command/query separation.
- DTO mapping layer.
- Typed domain errors with stable error codes.

Long-Term Scalability Concerns:

- More clients, mobile apps, or external admin tools will need stable API contracts.
- Direct route-to-Prisma coupling makes background jobs and workers harder to share.

### 3. Authentication

Grade: C+

Problems:

- Mock auth is intentionally minimal and has no passwords.
- Session cookie stores raw `userId`.
- No signed/encrypted session token.
- No CSRF protection for cookie-authenticated POST routes.
- Demo users are publicly listable.

Technical Debt:

- Current session helper is useful for MVP but not safe as production auth.
- Raw user ID cookies are easy to forge locally.
- Auth concerns are mixed with demo-account behavior.

Recommended Refactors:

- Replace raw `userId` cookie with signed session token or server-side session ID.
- Add CSRF protection for state-changing requests.
- Separate demo auth from future wallet-linked auth behind an `AuthProvider` interface.
- Add session expiration and rotation.

Suggested Folder Structure:

```text
src/server/auth/
|-- session.ts
|-- csrf.ts
|-- providers/
|   |-- demo.provider.ts
|   `-- wallet.provider.ts
`-- guards.ts
```

Suggested Design Patterns:

- Provider pattern for auth methods.
- Server-side session store or signed session token.
- Guard helpers for route protection.

Long-Term Scalability Concerns:

- Wallet linking, account recovery, and admin permissions need stronger identity primitives.
- Production deployment will require secure cookie and CSRF design.

### 4. Authorization

Grade: B-

Problems:

- Admin API correctly checks `user.isAdmin`.
- Middleware only checks cookie presence, not whether the user exists or is admin.
- UI hides admin tools for non-admin users, but API enforcement is the real protection.
- Authorization is boolean, not role/permission based.

Technical Debt:

- `isAdmin` will not cover future roles such as trader, analyst, settlement operator, support, auditor.
- Admin action audit trail is missing.

Recommended Refactors:

- Add role/permission enum or join table.
- Add `requirePermission("markets:settle")` style guards.
- Add audit logging for all privileged actions.

Suggested Folder Structure:

```text
src/server/auth/
|-- permissions.ts
`-- guards.ts
```

Suggested Design Patterns:

- RBAC for near-term.
- Permission-based authorization for admin actions.
- Audit log pattern.

Long-Term Scalability Concerns:

- Admin settlement is high-impact and must be auditable.
- Multi-operator workflows will need permission boundaries and review states.

### 5. Business Logic

Grade: C+

Problems:

- Core logic is concentrated in `lib/db-amm.ts`.
- Trading, settlement, voiding, payout, and leaderboard refresh live in one file.
- Domain invariants are enforced in code but not expressed as reusable domain policies.
- The code uses balance mutation instead of ledger events.
- Leaderboard calculations are mixed into settlement functions.

Technical Debt:

- Adding cancellation, corrections, late stat changes, or multi-week support will make the utility file hard to maintain.
- Domain errors are plain strings.

Recommended Refactors:

- Split trade, settlement, void, payout, and leaderboard logic into services.
- Create domain policies for market status transitions.
- Introduce typed domain errors.
- Move leaderboard refresh to a separate service or async job.

Suggested Folder Structure:

```text
src/domain/
|-- markets/
|-- trades/
|-- settlement/
|-- portfolio/
`-- leaderboard/
```

Suggested Design Patterns:

- Domain service pattern.
- State machine for market lifecycle.
- Typed domain errors.
- Event-driven updates for leaderboard and audit trails.

Long-Term Scalability Concerns:

- More market types will multiply conditional logic.
- Stat corrections and resettlements need explicit lifecycle handling.

### 6. AMM

Grade: B-

Problems:

- Pure AMM math exists and is testable.
- Constant-product behavior is simple and MVP-appropriate.
- Price is recomputed from pool state, but stored prices can drift if any write misses an update.
- No explicit fees, liquidity provider model, or bounded max trade size.
- No concurrency lock around market pool updates.

Technical Debt:

- AMM terminology is slightly inverted: buying YES adds to NO pool and removes YES inventory, which should be documented heavily.
- No slippage tolerance check from client to server.
- Uses JavaScript number math before saving decimals.

Recommended Refactors:

- Add server-side quote endpoint or quote validation inside trade execution.
- Add slippage tolerance to trade payload.
- Use decimal-safe math for pool calculations.
- Use row-level lock or serializable transaction strategy for market updates.

Suggested Folder Structure:

```text
src/domain/amm/
|-- constant-product.ts
|-- quote.ts
|-- execution.ts
`-- types.ts
```

Suggested Design Patterns:

- Pure functions for quotes.
- Command handler for execution.
- Optimistic concurrency or row-level locking.

Long-Term Scalability Concerns:

- Concurrent trades can overwrite pool state or overspend balances without stronger locking.
- Real-money or on-chain settlement would require a much more rigorous market-maker model.

### 7. State Management

Grade: B-

Problems:

- Real app state now comes from APIs, which is good.
- Client pages do manual `useEffect` fetching and local loading/error state.
- Refresh is coordinated with `window.dispatchEvent("fantasyx:data-changed")`.
- Legacy `lib/store.tsx` remains and can confuse future agents.
- No shared cache/query layer.

Technical Debt:

- Duplicated loading/error/retry patterns across pages.
- Global browser event is brittle.
- Page-level fetching logic will grow noisy.

Recommended Refactors:

- Remove or archive `lib/store.tsx`.
- Introduce TanStack Query or a small internal query hook layer.
- Create reusable hooks: `useSlate`, `usePortfolio`, `useSession`, `useLeaderboard`.
- Centralize mutation invalidation.

Suggested Folder Structure:

```text
src/client/api/
|-- client.ts
|-- hooks/
|   |-- use-session.ts
|   |-- use-portfolio.ts
|   |-- use-slate.ts
|   `-- use-leaderboard.ts
`-- mutations/
```

Suggested Design Patterns:

- Query/mutation hooks.
- Cache invalidation.
- Container/presentational component split.

Long-Term Scalability Concerns:

- Manual fetching will become inconsistent as pages and widgets grow.
- Real-time market updates need a stronger subscription or polling model.

### 8. Folder Structure

Grade: C+

Problems:

- MVP structure is simple but flat.
- `lib/` contains domain, API, auth, Prisma, formatting, client fetchers, and legacy state.
- Pages contain both orchestration and presentation.
- No clear server/client/domain boundaries.

Technical Debt:

- New files will gravitate to `lib/`, making ownership unclear.
- Future Claude/Codex agents may touch the wrong layer.

Recommended Refactors:

- Adopt a feature/domain-oriented structure.
- Separate server-only code from client-only code.
- Move reusable UI to `components/ui` and domain UI to feature folders.

Suggested Folder Structure:

```text
src/
|-- app/
|-- components/
|   |-- ui/
|   `-- layout/
|-- features/
|   |-- auth/
|   |-- markets/
|   |-- portfolio/
|   |-- leaderboard/
|   `-- admin/
|-- domain/
|   |-- amm/
|   |-- markets/
|   |-- trades/
|   `-- settlement/
|-- server/
|   |-- auth/
|   |-- db/
|   |-- services/
|   `-- api/
|-- client/
|   `-- api/
`-- shared/
    |-- types/
    `-- formatting/
```

Suggested Design Patterns:

- Feature folders for UI.
- Domain services for product rules.
- Server-only repository/service layers.

Long-Term Scalability Concerns:

- Flat architecture slows onboarding and increases accidental coupling.

### 9. Components

Grade: B-

Problems:

- Components are readable and mobile-first.
- Some pages duplicate `StatePanel` and loading/error patterns.
- Trade modal owns focus management manually.
- Admin page is large and mixes data loading, permissions, mutation, and rendering.
- No component library primitives beyond Tailwind classes.

Technical Debt:

- Repeated button, card, badge, metric, and panel styles.
- Harder to keep accessibility/focus behavior consistent.

Recommended Refactors:

- Extract shared `Button`, `Card`, `Badge`, `StatePanel`, `Metric`, and `Modal` primitives.
- Split Admin page into `AdminWeekSelector`, `PlayerSettlementRow`, and `MarketSettlementCard`.
- Keep market cards presentational.

Suggested Folder Structure:

```text
components/
|-- ui/
|-- layout/
`-- feedback/

features/markets/components/
features/admin/components/
```

Suggested Design Patterns:

- Presentational/container split.
- Compound modal/dialog primitive.
- Design system primitives.

Long-Term Scalability Concerns:

- As product workflows grow, duplicated UI logic will increase accessibility and consistency risk.

### 10. Performance

Grade: C+

Problems:

- MVP data volume is tiny, so performance is acceptable.
- `/api/portfolio` loads all user positions and recent trades with nested market/player data.
- Leaderboard refresh reads all users and all positions.
- Client pages refetch full slate and portfolio after trades.
- No pagination for trades/positions/markets.

Technical Debt:

- Mark-to-market calculations are recomputed repeatedly.
- Leaderboard is write-heavy during settlement and not optimized.

Recommended Refactors:

- Add pagination where lists can grow.
- Add targeted invalidation after trades.
- Add denormalized weekly user stats or materialized leaderboard table updated incrementally.
- Add indexes for admin and leaderboard queries.

Suggested Folder Structure:

```text
src/server/services/leaderboard.service.ts
src/server/jobs/recalculate-leaderboard.ts
```

Suggested Design Patterns:

- Incremental aggregation.
- Background jobs.
- Query caching for public slate data.

Long-Term Scalability Concerns:

- Full leaderboard recalculation over all users will not scale.
- Real-time market prices need streaming/polling strategy.

### 11. Accessibility

Grade: A-

Problems:

- Strong work already done: landmarks, skip link, focus states, modal focus trap, labels, aria-live, axe tests.
- Manual focus trap can be fragile.
- Some icon/text buttons should be reviewed as UI density increases.
- Axe tests do not replace keyboard/manual screen reader QA.

Technical Debt:

- Accessibility logic is bespoke inside `TradeModal`.
- No Storybook or component-level accessibility checks.

Recommended Refactors:

- Extract reusable accessible modal/dialog primitive.
- Add manual QA checklist to PR process.
- Add keyboard E2E test for login, market filter, trade modal, and admin form.

Suggested Folder Structure:

```text
components/ui/dialog.tsx
components/ui/button.tsx
tests/e2e/keyboard.spec.ts
```

Suggested Design Patterns:

- Accessible primitives.
- Testing pyramid with axe plus keyboard flow tests.

Long-Term Scalability Concerns:

- More modals/forms can regress accessibility unless primitives are centralized.

### 12. Testing

Grade: B-

Problems:

- Business tests cover core trade and settlement safeguards.
- Axe tests cover major pages.
- No full E2E smoke tests for login -> trade -> portfolio.
- No concurrency tests.
- Tests use local database state directly.
- API route tests import route handlers directly, which is useful but not full HTTP coverage.

Technical Debt:

- Database tests are not isolated by schema/container per run.
- No factories/builders for test data.
- No coverage for CSRF, admin denial, logout, or non-admin settlement rejection.

Recommended Refactors:

- Add Playwright smoke tests for critical user flows.
- Add test data factories.
- Add authorization tests for admin route denial.
- Add concurrency tests for simultaneous trades.
- Add API integration tests over HTTP.

Suggested Folder Structure:

```text
tests/
|-- unit/
|-- integration/
|-- e2e/
|-- a11y/
`-- factories/
```

Suggested Design Patterns:

- Test data builder/factory.
- Arrange-act-assert.
- Separate pure unit tests from DB integration tests.

Long-Term Scalability Concerns:

- Without E2E smoke tests, auth and client/API integration can break while unit tests pass.

### 13. Security

Grade: C

Problems:

- Mock auth is intentionally not production-grade.
- Raw `userId` cookie can be forged.
- No CSRF protection on cookie-authenticated POST routes.
- Rate limiting is in-memory and bypassable across instances.
- Public demo-user list includes balances and admin flag.
- Error messages expose internal domain details.
- No security headers beyond Next defaults.

Technical Debt:

- Demo auth may accidentally be mistaken for production auth later.
- Admin actions lack audit log.

Recommended Refactors:

- Add signed sessions or server-side session table.
- Add CSRF token validation.
- Add durable rate limiting.
- Add security headers policy.
- Restrict demo account listing to development or explicitly label it as demo-only.
- Add admin audit logging.

Suggested Folder Structure:

```text
src/server/security/
|-- csrf.ts
|-- rate-limit.ts
|-- headers.ts
`-- audit.ts
```

Suggested Design Patterns:

- Defense in depth.
- Signed cookies/server sessions.
- Audit log.

Long-Term Scalability Concerns:

- Wallet-linked accounts will raise stakes around impersonation and replay.
- Any real-money direction requires a full security/compliance redesign.

### 14. Scalability

Grade: C

Problems:

- Current architecture is suitable for a local MVP, not high concurrency.
- No queue/job system.
- No durable rate limiting.
- No read caching.
- No real-time price update mechanism.
- Balance and pool updates are not protected with explicit database locking strategy.

Technical Debt:

- Synchronous settlement refreshes leaderboard inside the same transaction.
- More users and markets will stress naive recalculation.

Recommended Refactors:

- Add service boundaries before scale work.
- Add background jobs for leaderboard recalculation and market locking.
- Use database transaction isolation/locking for trades.
- Add event table for trade/settlement events.
- Consider polling/SSE/WebSocket for market price updates.

Suggested Folder Structure:

```text
src/server/jobs/
src/server/events/
src/server/queues/
```

Suggested Design Patterns:

- Event-driven architecture.
- CQRS-lite for commands and read models.
- Worker queue for scheduled and heavy tasks.

Long-Term Scalability Concerns:

- Concurrent trading correctness is the main blocker before any public beta.
- Leaderboard and portfolio read models should become incremental.

### 15. Developer Experience

Grade: B

Problems:

- README/HANDOFF/CLAUDE docs are helpful.
- Scripts cover lint, typecheck, build, tests, seed, and Prisma push.
- No migration workflow.
- No one-command local reset.
- No pre-commit or CI config.
- Logs and generated files are present in the workspace.

Technical Debt:

- Future contributors may run stale DB state.
- `package.json#prisma` seed config has a Prisma 7 deprecation warning.

Recommended Refactors:

- Add `db:reset`, `db:migrate`, and `verify` scripts.
- Add CI workflow for lint, typecheck, tests, build.
- Move Prisma seed config to `prisma.config.ts` when ready.
- Add `.dockerignore` and review `.gitignore`.

Suggested Folder Structure:

```text
scripts/
|-- reset-db.ts
|-- verify.ps1
`-- seed-demo.ts
```

Suggested Design Patterns:

- Single command verification.
- Reproducible local environment.
- CI gate before handoff.

Long-Term Scalability Concerns:

- Without CI and migrations, architecture quality will drift quickly.

## Highest Impact Recommendations

1. Add a ledger model before expanding money/settlement features.
2. Split `lib/db-amm.ts` into trade, settlement, payout, and leaderboard services.
3. Add signed/server-side sessions and CSRF before any non-local demo.
4. Add migrations and test data factories.
5. Add E2E smoke tests for login, trade, portfolio, and admin settlement.
6. Remove or quarantine legacy `lib/store.tsx`.
7. Add explicit concurrency controls for balance and market pool updates.
