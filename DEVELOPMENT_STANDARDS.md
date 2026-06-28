# FantasyX Development Standards

These standards are the source of truth for future FantasyX implementation work.

## Product Constraints

- Keep the product free-play unless explicitly approved otherwise.
- Do not add real-money wagering.
- Do not add deposits or withdrawals.
- Do not add custody.
- Do not add mainnet SOL.
- Do not add production crypto settlement.
- Solana work must start as wallet identity/testnet-only design.

## Folder Structure

Current MVP can keep the existing structure, but new substantial work should move toward:

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
|   |-- repositories/
|   |-- services/
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

Rules:

- Server-only code must not be imported into client components.
- Domain logic should not depend on React.
- API routes should be thin.
- Services own business rules.
- Repositories own database access.
- UI components should avoid direct Prisma/server imports.

## Naming

Files:

- React components: `kebab-case.tsx`.
- Services: `*.service.ts`.
- Repositories: `*.repository.ts`.
- Domain policies: `*.policy.ts`.
- Tests: `*.test.ts` or `*.spec.ts`.
- Zod schemas: `*.schema.ts`.

Types:

- Use explicit domain names: `MarketStatus`, `TradeExecution`, `SettlementResult`.
- Avoid vague names such as `data`, `payload`, or `item` outside tiny scopes.
- API DTOs should end with `Response`, `Request`, or `Dto`.

Database:

- Prisma models use PascalCase.
- Database table/column mappings use snake_case where mapped.
- Enum values use uppercase stable constants.

## TypeScript Standards

- Prefer strict types over `unknown` or broad casts.
- Keep API boundary parsing with Zod.
- Do not trust client input.
- Avoid duplicating response types manually when DTO mappers can be shared.
- Use typed domain errors instead of string matching.
- Keep pure functions pure.

## API Standards

API routes must:

- Authenticate where required.
- Authorize privileged actions.
- Validate request bodies/query params with Zod.
- Call service-layer functions.
- Return stable response DTOs.
- Return safe error messages.
- Never trust `userId` from client payload for authenticated user actions.

State-changing routes must:

- Validate CSRF once CSRF support exists.
- Be idempotent where double execution would be harmful.
- Write audit/ledger events where applicable.

## Database Standards

- Use Prisma migrations for schema changes.
- Do not rely on `prisma db push` for shared development once migrations exist.
- Add indexes intentionally for query paths.
- Keep balance-affecting events append-only in the ledger.
- Use constraints for uniqueness and idempotency.
- Avoid storing derived values unless they are cached/read models with a clear update strategy.

## Business Logic Standards

- Put product rules in services or domain modules, not page components.
- Market lifecycle transitions must go through policy/service functions.
- Trade execution must be atomic.
- Settlement and void flows must be idempotent.
- Leaderboard updates should not be mixed into unrelated logic once services are split.

## AMM Standards

- Keep AMM quote math pure and testable.
- Server computes final execution.
- Client estimates are informational only.
- Add server-side slippage tolerance before wider release.
- Use decimal-safe math before production-like volume.
- Protect market pool updates from concurrent overwrite.

## Auth and Authorization Standards

- Session user is derived server-side.
- Do not accept authenticated `userId` from client payload.
- Admin APIs require server-side permission checks.
- Future roles should use permissions, not only `isAdmin`.
- Signed/server-side sessions are required before non-local demo use.
- CSRF protection is required for cookie-authenticated POST routes before non-local demo use.

## Testing Standards

Minimum test categories:

- Unit tests for pure domain functions.
- Integration tests for database-backed services.
- API tests for validation/auth/authorization.
- E2E tests for critical user flows.
- Accessibility tests for major pages and dialogs.

Required before merging core market changes:

- Trade spend and balance tests.
- Position share tests.
- Market status guard tests.
- Settlement payout tests.
- Double-pay prevention tests.
- Void refund tests.
- Double-refund prevention tests.
- Auth impersonation tests.

Required before merging UI workflow changes:

- Loading, empty, and error state coverage where practical.
- Keyboard flow check for modals/forms.
- Axe test remains green.

Test data:

- Prefer factories/builders over repeated manual setup.
- Tests must clean up their own records or run in isolated schemas.

## Documentation Standards

Update docs when changing:

- Setup commands.
- Database schema.
- Auth/session behavior.
- API routes.
- Market lifecycle.
- Settlement rules.
- Security posture.
- Solana/wallet assumptions.

Source-of-truth docs:

- `PRODUCT_REQUIREMENTS_DOCUMENT.md`
- `PRODUCT_ROADMAP.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEVELOPMENT_STANDARDS.md`
- `ARCHITECTURE_REVIEW.md`
- `TECH_DEBT.md`

## Accessibility Standards

Target:

- WCAG 2.2 AA.

Requirements:

- Semantic landmarks.
- Skip-to-content link.
- Visible focus states.
- Keyboard-accessible controls.
- Accessible names for all interactive elements.
- Form labels and helper/error text connected with `aria-describedby`.
- Dialogs use `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, and focus return.
- Live regions for async success/errors.
- Color contrast meets AA.
- Axe tests cover major pages.

Do not merge UI changes that break keyboard access or axe tests.

## Performance Standards

MVP:

- Keep pages responsive on seeded data.
- Avoid unnecessary client recomputation.
- Avoid loading unrelated data.

Growth:

- Paginate lists that can grow.
- Move heavy recalculations to services/workers.
- Cache or denormalize read models when justified.
- Avoid full leaderboard recalculation in request paths at scale.

## Security Standards

Never commit:

- `.env` files.
- API keys.
- Private keys.
- Wallet mnemonics.
- Production secrets.

Required practices:

- Validate all inputs.
- Authorize all privileged actions.
- Use safe public errors.
- Add audit logs for admin actions.
- Add durable rate limiting before deployment.
- Add CSRF protection before non-local cookie-auth demo.
- Keep real-money and mainnet features out of scope until reviewed.

## Error Handling Standards

- Use typed domain errors with stable codes.
- Map domain errors to appropriate HTTP status codes.
- Client should display safe, actionable messages.
- Logs should preserve internal diagnostic details where appropriate.
- Do not branch on raw error message strings in UI.

Suggested error shape:

```ts
{
  error: {
    code: "MARKET_NOT_OPEN",
    message: "Market is not open."
  }
}
```

## Commit Standards

Use concise, descriptive commits.

Preferred prefixes:

- `feat:`
- `fix:`
- `test:`
- `docs:`
- `refactor:`
- `chore:`
- `security:`

Examples:

- `docs: add product roadmap and PRD`
- `refactor: split trade service from db amm helper`
- `test: add non-admin settlement rejection coverage`

Commit rules:

- Keep unrelated changes separate.
- Include tests with behavior changes.
- Update docs with architecture or setup changes.
- Do not commit generated folders or secrets.

## Review Checklist

Product:

- Does this preserve free-play/mock-credit constraints?
- Does this avoid real-money or mainnet crypto functionality?
- Does this match the PRD?

Architecture:

- Is business logic in the correct service/domain layer?
- Are API routes thin?
- Are server/client boundaries respected?
- Does the folder placement match standards?

Database:

- Is there a migration?
- Are indexes/constraints appropriate?
- Are balance-affecting changes ledgered?

Security:

- Is auth required where needed?
- Is authorization server-side?
- Are inputs validated?
- Are errors safe?
- Are secrets excluded?

Testing:

- Are unit/integration/E2E tests added at the right level?
- Do existing tests still pass?
- Are edge cases covered?

Accessibility:

- Keyboard usable?
- Focus visible?
- Labels and names correct?
- Axe suite passes?

Performance:

- Is data fetching scoped?
- Are growing lists paginated or planned?
- Are heavy calculations kept out of hot paths?

Developer Experience:

- Are docs updated?
- Are commands still accurate?
- Is the change easy for another engineer or assistant to continue?
