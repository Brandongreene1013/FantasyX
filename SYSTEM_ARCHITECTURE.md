# FantasyX System Architecture

## Architecture Principles

- Free-play first.
- Server is source of truth.
- All balance changes must be auditable.
- Trading and settlement must be transactionally safe.
- Wallets are identity links until explicitly approved otherwise.
- Real-money and mainnet crypto are out of scope for the current product.

## High-Level Architecture

```text
Client
  |
  | HTTPS
  v
Next.js API Routes / Server Actions
  |
  v
Application Services
  |-- Auth Service
  |-- Trade Service
  |-- AMM Service
  |-- Portfolio Service
  |-- Settlement Service
  |-- Leaderboard Service
  |-- Admin Audit Service
  |
  v
Database / Ledger / Read Models
  |
  v
Workers and Queues
  |-- Market Lock Worker
  |-- Leaderboard Worker
  |-- Scoring Import Worker
  |-- Settlement Worker
  |
  v
External Providers
  |-- NFL Schedule/Data Provider
  |-- Fantasy Scoring Provider
  |-- Future Wallet Provider
  |-- Future Oracle Provider
```

## Client

Responsibilities:

- Render responsive trading UI.
- Fetch authenticated session state.
- Display slate, prices, positions, and leaderboard.
- Submit trade and admin commands.
- Provide accessible interactions.

Non-responsibilities:

- Client does not decide final trade execution price.
- Client does not choose user ID for trades.
- Client does not settle markets.
- Client does not mutate balances directly.

Recommended client layers:

```text
src/client/
|-- api/
|-- hooks/
|-- mutations/
`-- state/

src/features/
|-- auth/
|-- markets/
|-- portfolio/
|-- leaderboard/
`-- admin/
```

Future client data strategy:

- Use query/mutation hooks.
- Centralize invalidation after trades/settlement.
- Add polling or SSE for market prices.

## API

Responsibilities:

- Authenticate requests.
- Authorize privileged actions.
- Validate inputs.
- Call application services.
- Return stable DTO responses.

API categories:

- Auth APIs
- Slate/query APIs
- Trade command APIs
- Portfolio query APIs
- Leaderboard query APIs
- Admin command APIs
- Future scoring import APIs
- Future wallet-link APIs

Recommended patterns:

- Zod request validation.
- Stable response DTOs.
- Typed domain errors.
- Route handlers should stay thin.
- Service layer owns business rules.

## Database

Primary database:

- PostgreSQL.

ORM:

- Prisma.

Core tables:

- Users
- Sessions
- Players
- NFL weeks
- Games
- Markets
- Trades
- Positions
- Settlements
- Leaderboard entries
- Account ledger entries
- Admin audit logs
- Market events
- Future score imports

Database principles:

- Use migrations.
- Keep financial-like events append-only.
- Use constraints for uniqueness and idempotency.
- Index high-volume query paths.
- Avoid relying only on application code for critical invariants.

## Services

Application services should sit between API routes and database repositories.

### Auth Service

Responsibilities:

- Email/password signup and login.
- Password hashing.
- Server-side session creation and validation.
- Logout.
- Future wallet-linked identity.

Current implementation:

- `User` stores `firstName`, `lastName`, `displayName`, unique email, password hash, and role.
- `Session` stores hashed opaque session tokens with expiration.
- The browser receives a signed httpOnly `fantasyx_session` cookie.
- API routes derive the user from the session and never trust a client-supplied user id.
- Signup creates a 10,000 mock-credit `SEED_GRANT` ledger entry.
- Middleware protects `/markets`, `/markets/*`, `/players/*`, `/portfolio`, `/history`, `/admin`, `/account`, and `/settings`.
- Logged-in users visiting `/login` or `/signup` are redirected to `/markets`.
- Login `next` redirects are constrained to internal paths to prevent open redirects.

### Trade Service

Responsibilities:

- Validate market tradability.
- Validate user balance.
- Quote and execute AMM trade.
- Update market pools.
- Create trade record.
- Update position.
- Write ledger entry.
- Return execution result.

### AMM Service

Responsibilities:

- Quote YES/NO trades.
- Calculate shares, price before, price after, average price, and slippage.
- Enforce optional max slippage.
- Maintain pure deterministic math separate from database writes.

### Portfolio Service

Responsibilities:

- Load authenticated user portfolio.
- Calculate open value.
- Calculate realized and unrealized P&L.
- Read ledger activity.

### Settlement Service

Responsibilities:

- Settle market or player markets.
- Determine YES/NO outcomes from final rank.
- Pay winning shares.
- Prevent double-pay.
- Write settlement records.
- Write ledger entries.
- Emit audit events.

### Void Service

Responsibilities:

- Validate void eligibility.
- Refund cost basis.
- Prevent double-refund.
- Write ledger entries.
- Emit audit events.

### Leaderboard Service

Responsibilities:

- Calculate weekly P&L.
- Update leaderboard rows.
- Eventually maintain incremental read models.

### Admin Audit Service

Responsibilities:

- Record privileged actions.
- Store actor, action, target, previous state, next state, reason, and timestamp.

## Workers

Workers should handle scheduled or heavier background work outside request/response paths.

Recommended workers:

- Market Lock Worker: locks markets at kickoff.
- Leaderboard Worker: recalculates or incrementally updates leaderboard.
- Scoring Import Worker: processes uploaded fantasy scoring files.
- Settlement Worker: settles batches from confirmed rank data.
- Audit/Event Worker: processes domain events if event-driven architecture is adopted.

## Queues

Queue use cases:

- Batch settlement.
- Score import processing.
- Leaderboard recalculation.
- Notification/event processing.

Queue requirements:

- Retry support.
- Idempotency keys.
- Dead-letter handling.
- Job status visibility for admin tools.

Potential technologies:

- Postgres-backed job table for early MVP.
- BullMQ/Redis for more advanced background jobs.
- Managed queue in hosted environments.

## Ledger

The ledger is the source of truth for mock-credit balance changes.

Ledger entry types:

- `SEED_GRANT`
- `TRADE_SPEND`
- `SETTLEMENT_PAYOUT`
- `VOID_REFUND`
- `ADMIN_ADJUSTMENT`
- `CORRECTION`

Ledger fields:

- id
- userId
- type
- amount
- balanceAfter
- tradeId
- marketId
- settlementId
- adminId
- idempotencyKey
- metadata
- createdAt

Rules:

- Ledger entries are append-only.
- Negative entries reduce balance.
- Positive entries increase balance.
- Every balance mutation has a ledger entry.
- Idempotency keys prevent duplicate payout/refund events.

## AMM

Current MVP:

- Constant-product AMM.
- YES price derived from pool balances.
- NO price equals `1 - YES price`.

Long-term AMM requirements:

- Pure quote function.
- Server-side execution.
- Slippage tolerance.
- Decimal-safe math.
- Explicit market pool locking/concurrency.
- Optional fees.
- Liquidity lifecycle if LPs are introduced.

AMM boundaries:

- AMM math should not know about users.
- Trade service should combine AMM quote with user, balance, ledger, and position writes.

## Wallet Layer

Current state:

- No wallet functionality.

Future wallet layer:

- Wallet linking for identity only.
- Signature challenge.
- Wallet unlinking.
- Wallet address history/audit.
- No deposits.
- No withdrawals.
- No custody.
- No mainnet settlement.

Wallet service responsibilities:

- Generate challenge.
- Verify signature.
- Link wallet to user.
- Prevent duplicate wallet links.
- Record wallet link audit events.

## Oracle Layer

Current state:

- Manual admin settlement.

Future oracle layer:

- Fetch fantasy scoring/rank data.
- Normalize provider data.
- Calculate half-PPR ranks.
- Provide settlement preview.
- Support manual review before committing settlement.

Oracle principles:

- Provider data is input, not automatic truth, until reviewed.
- Settlement commits must be auditable.
- Stat corrections need explicit correction workflow.

Potential providers:

- NFL schedule provider.
- Fantasy scoring provider.
- Sports data provider.
- Internal CSV upload.

## Future Solana Program

Current state:

- No Solana program.
- No on-chain settlement.

Future testnet-only exploration:

- Wallet identity link.
- Optional public proof of market settlement.
- Optional testnet representation of free-play state.

Questions before Solana program design:

- What market state belongs on-chain?
- Is AMM state on-chain or off-chain?
- Are trades on-chain or mirrored?
- How are outcomes attested?
- What is the oracle trust model?
- How are disputes/corrections handled?

Hard constraints:

- No mainnet SOL.
- No real deposits.
- No withdrawals.
- No custody.
- No production wagering.

## Background Jobs

Required jobs:

- Lock markets at kickoff.
- Recalculate leaderboards.
- Process scoring imports.
- Batch settle reviewed results.

Job design:

- Idempotent.
- Retryable.
- Observable.
- Emits audit/event records.
- Does not double-pay or double-refund.

## External Providers

Near-term:

- None required for seeded MVP.
- CSV/manual scoring import can come first.

Future:

- NFL schedule provider.
- Fantasy scoring provider.
- Identity/wallet provider.
- Monitoring/observability provider.
- Email/notification provider if user accounts expand.

Provider abstraction:

- External providers should be wrapped in adapter interfaces.
- Raw provider payloads should be stored for audit/debug when relevant.
- Provider failures should not corrupt settlement state.

## Suggested Long-Term Folder Structure

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
|-- client/
|   |-- api/
|   |-- hooks/
|   `-- mutations/
|-- domain/
|   |-- amm/
|   |-- markets/
|   |-- trades/
|   |-- settlement/
|   |-- ledger/
|   `-- scoring/
|-- server/
|   |-- api/
|   |-- auth/
|   |-- db/
|   |-- services/
|   |-- repositories/
|   |-- jobs/
|   |-- queues/
|   `-- security/
|-- shared/
|   |-- types/
|   |-- errors/
|   `-- formatting/
`-- tests/
    |-- unit/
    |-- integration/
    |-- e2e/
    |-- a11y/
    `-- factories/
```

## Deployment Architecture

MVP local:

- Next.js dev server.
- Docker Postgres.
- Prisma.

Internal beta:

- Hosted Next.js app.
- Managed Postgres.
- Migration deploy step.
- Durable rate limit store.
- Basic observability.

Future scale:

- App/API service.
- Worker service.
- Managed queue.
- Managed Postgres.
- Cache/rate-limit store.
- Monitoring and alerting.
