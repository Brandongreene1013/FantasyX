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
npm run prisma:push
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/login`, choose a demo account, then trade from `/markets`.

## Environment

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasyx?schema=public"
```

Do not commit `.env` files or secrets.

## Main Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:a11y
npm run build
npm run prisma:push
npm run prisma:seed
```

## Current Features

- Demo account login with secure httpOnly cookie
- Admin and portfolio route protection
- Database-backed market slate, trades, portfolio, leaderboard, and settlements
- Mock-credit AMM price movement
- Trade safeguards for locked, settled, void, and insufficient-balance cases
- Admin rank settlement, lock/open, and void flows
- Settlement double-pay and void double-refund prevention
- WCAG-oriented accessibility pass with axe tests

## Important Constraints

- Keep this free-play only.
- Do not add real-money flows.
- Do not add Solana/mainnet settlement yet.
- API routes must derive the user from the session cookie, not client payloads.
- Admin APIs must require `user.isAdmin`.
