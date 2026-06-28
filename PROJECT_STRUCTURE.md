# Project Structure

```text
FantasyX/
|-- app/
|   |-- api/
|   |   |-- auth/
|   |   |-- leaderboard/
|   |   |-- portfolio/
|   |   |-- session/
|   |   |-- settlements/
|   |   |-- slate/
|   |   `-- trades/
|   |-- admin/
|   |-- leaderboard/
|   |-- login/
|   |-- markets/
|   |-- portfolio/
|   |-- slate/
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|-- lib/
|-- prisma/
|-- tests/
|   |-- a11y/
|   `-- money-market.test.ts
|-- middleware.ts
|-- docker-compose.yml
|-- package.json
|-- playwright.config.ts
|-- vitest.config.ts
|-- README.md
|-- HANDOFF.md
|-- TODO.md
|-- PROJECT_STRUCTURE.md
`-- ACCESSIBILITY.md
```

## Major Areas

`app/` contains Next.js App Router pages, layout, global styles, and API route handlers.

`app/api/auth/` contains email/password signup, login, and logout routes.

`app/api/trades/`, `portfolio/`, `settlements/`, `slate/`, and `leaderboard/` are the database-backed product APIs.

`components/` contains reusable UI such as account bar, market cards, tabs, headings, and trade modal.

`lib/` contains domain logic, Prisma client setup, auth helpers, AMM math, database transaction helpers, validation, API response utilities, formatting, and client fetch helpers.

`prisma/` contains the database schema and seed script.

`tests/money-market.test.ts` contains Vitest coverage for money, AMM, settlement, void, and session-user trade safeguards.

`tests/a11y/` contains Playwright + axe accessibility tests.

## Excluded From ZIP

- `node_modules/`
- `.next/`
- `dist/`
- `build/`
- `.env`
- `.git/`
- logs
- cache folders
- test output folders
- TypeScript build info
