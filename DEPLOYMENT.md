# FantasyX Deployment

Production URL: https://fantasy-x.vercel.app

## Platform

- Vercel project: `fantasy-x`
- Database: Neon PostgreSQL via Vercel integration
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`

## Local Development

```powershell
npm install
docker compose up -d
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/signup`.

`npm run prisma:seed` creates the admin account from the `ADMIN_*` variables and seeded NFL market data. It also creates non-public development trader rows used only to populate analytics and leaderboard history.

If an older production database already has the admin email but a stale or empty password hash, logging in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` upgrades that account to the admin role and refreshes its password hash.

Login redirects only allow internal `next` paths. External or protocol-relative redirect targets fall back to `/markets`.

Authenticated client mutations fetch a CSRF token from `/api/session` and send it as `x-csrf-token`. Production `SESSION_SECRET` must stay stable across deployments or existing session/CSRF tokens will become invalid.

## Local Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` intentionally runs only `next build` for local compatibility with existing `db push` databases.

## Vercel Build

Vercel uses `vercel.json`:

```json
{
  "buildCommand": "npm run vercel-build"
}
```

`npm run vercel-build` runs:

```powershell
prisma migrate deploy && prisma generate && next build
```

This ensures schema migrations and Prisma Client generation happen in Vercel before Next.js builds.

## Production Database

For a fresh production database:

1. Attach Neon/Postgres to the Vercel project.
2. Confirm `DATABASE_URL` exists for Production and Preview.
3. Add `SESSION_SECRET` with at least 32 random characters.
4. Add `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME`.
5. Deploy to Vercel.
6. Vercel runs `prisma migrate deploy` automatically.
7. Seed manually only when intentionally resetting market/account seed data:

```powershell
npx vercel env run --environment=production -- npm run prisma:seed
```

Do not run seed casually in production: it resets seeded market, trade, account, and analytics state.

## Current One-Time Migration Note

The first Vercel deployment failed because the initial migration had a UTF-8 BOM character. The BOM was removed, the failed migration was marked rolled back, and migrations were successfully reapplied. Future deploys now run cleanly with no pending migrations.

## Deploy Command

```powershell
npx vercel deploy --prod --yes
```

## Post-Deploy Smoke Test

Check:

- `GET https://fantasy-x.vercel.app/login`
- `GET https://fantasy-x.vercel.app/api/analytics/dashboard?weekId=nfl_2026_w1`

Then manually verify:

1. Create a new account from `/signup`.
2. Open Markets.
3. Buy YES on an open market.
4. Buy NO on an open market.
5. Open Portfolio and confirm balance/positions update.
6. Open Leaderboard.
7. Login as the admin account from `ADMIN_EMAIL`.
8. Open Admin and lock/open/settle or void a market.
