# FantasyX

Free-play MVP for weekly NFL fantasy football prediction markets.

Users buy mock-credit YES or NO shares on whether NFL players finish Top 3, Top 5, or Top 10 at their position in weekly half-PPR fantasy scoring. This project intentionally excludes real-money wagering, deposits, withdrawals, wallet custody, mainnet SOL, and production crypto settlement.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod validation
- Vitest business-logic tests
- Playwright + axe accessibility tests

## Setup

Recommended path when Docker Desktop is unreliable: use a hosted development
Postgres database from Neon, Supabase, Vercel Postgres, or another disposable
dev database.

```powershell
npm install
npm run prisma:generate
npm run db:check
npm run db:prepare
npm run dev
```

Open `http://localhost:3000/signup`, create an account, then trade from `/markets`.

Optional local Docker database:

```powershell
docker compose up -d
npm run db:prepare
```

## Environment

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/fantasyx_dev?sslmode=require"
SESSION_SECRET="replace-with-at-least-32-random-characters"
AUTH_BASE_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-strong-admin-password"
ADMIN_FIRST_NAME="FantasyX"
ADMIN_LAST_NAME="Admin"
```

Authentication supports verified email/password accounts, authenticator-app 2FA,
trusted devices, recovery codes, and optional Google, Apple, and Microsoft sign-in.
See `.env.example` for provider callback URLs and email delivery variables. The
`ADMIN_*` values are used by database seeding only; runtime login cannot create or
promote an administrator.

Do not commit `.env` files or secrets.

Production deployment uses Vercel + Neon/Postgres. See `DEPLOYMENT.md`.

## Main Commands

```powershell
npm run dev
npm run db:check
npm run db:prepare
npm run lint
npm run typecheck
npm run test
npm run test:a11y
npm run test:e2e
npm run build
npm run verify:fast
npm run verify
npm run vercel-build
npm run prisma:push
npm run prisma:seed
```

Use `npm run verify:fast` when no database is available. It runs lint,
typecheck, the no-DB rate-limit unit tests, and production build.

Use `npm run verify` for the full gate. It requires a migrated and seeded
Postgres database and runs lint, typecheck, full Vitest, build, and the
Playwright E2E smoke test. DB-backed tests are never silently skipped.

`npm run db:prepare` runs migrations and seed data against `DATABASE_URL`.
Use it only on a disposable dev/test database; the seed script resets seeded
market, trade, account, and analytics state.

Use `npm run vercel-build` only for Vercel-style migration/build verification against a migration-managed database.

## Current Features

- Real email/password signup and login
- Password hashing with scrypt
- Server-side session table with signed httpOnly session cookie
- Protected routes redirect logged-out users to `/login?next=...` with internal-only redirect handling
- Account and settings pages
- Admin and portfolio route protection
- Database-backed market slate, trades, portfolio, leaderboard, and settlements
- Mock-credit AMM price movement
- Buy and sell YES/NO position flow
- Trade safeguards for locked, settled, void, and insufficient-balance cases
- Session-bound CSRF protection for authenticated state-changing routes
- Admin rank settlement, lock/open, and void flows
- Settlement double-pay and void double-refund prevention
- WCAG-oriented accessibility pass with axe tests
- Production-safe API errors with request IDs
- Vercel deployment support with Prisma migrations
- Installable PWA shell with manifest, service worker, offline fallback, app icons, and standalone launch
- `/live` Live Sunday command center with games, market board, tape, portfolio, movers, leaderboard, player tracker, and watchlist dashboard
- Browser notification permission prompt and local alert preferences

## FantasyX OS / PWA

FantasyX can be installed from supported mobile and desktop browsers. The PWA launches at `/live`, keeps the authenticated browser session, caches the app shell for offline fallback, and reconnects to live market data through SSE with polling fallback.

Offline mode displays the cached shell and a connection banner. Mutating actions still require network connectivity.

## Important Constraints

- Keep this free-play only.
- Do not add real-money flows.
- Do not add Solana/mainnet settlement yet.
- API routes must derive the user from the session cookie, not client payloads.
- Admin APIs must require an authenticated admin role.
- `SESSION_SECRET` must be set in production.
- Client mutations include `x-csrf-token`; server routes reject missing or invalid tokens.
