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

```powershell
npm install
docker compose up -d
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/signup`, create an account, then trade from `/markets`.

## Environment

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasyx?schema=public"
SESSION_SECRET="replace-with-at-least-32-random-characters"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-strong-admin-password"
ADMIN_FIRST_NAME="FantasyX"
ADMIN_LAST_NAME="Admin"
```

Do not commit `.env` files or secrets.

Production deployment uses Vercel + Neon/Postgres. See `DEPLOYMENT.md`.

## Main Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:a11y
npm run build
npm run vercel-build
npm run prisma:push
npm run prisma:seed
```

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

## Important Constraints

- Keep this free-play only.
- Do not add real-money flows.
- Do not add Solana/mainnet settlement yet.
- API routes must derive the user from the session cookie, not client payloads.
- Admin APIs must require an authenticated admin role.
- `SESSION_SECRET` must be set in production.
- Client mutations include `x-csrf-token`; server routes reject missing or invalid tokens.
