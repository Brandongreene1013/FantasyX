# FantasyX Deployment

Production URL: https://fantasy-x.vercel.app

## Platform

- Vercel project: `fantasy-x`
- Database: Neon PostgreSQL via Vercel integration
- Required env var: `DATABASE_URL`

## Local Development

```powershell
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/login`.

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
3. Deploy to Vercel.
4. Vercel runs `prisma migrate deploy` automatically.
5. Seed manually only when intentionally resetting demo data:

```powershell
npx vercel env run --environment=production -- npm run prisma:seed
```

Do not run seed casually in production: it resets demo state.

## Current One-Time Migration Note

The first Vercel deployment failed because the initial migration had a UTF-8 BOM character. The BOM was removed, the failed migration was marked rolled back, and migrations were successfully reapplied. Future deploys now run cleanly with no pending migrations.

## Deploy Command

```powershell
npx vercel deploy --prod --yes
```

## Post-Deploy Smoke Test

Check:

- `GET https://fantasy-x.vercel.app/login`
- `GET https://fantasy-x.vercel.app/api/auth/demo-users`
- `GET https://fantasy-x.vercel.app/api/analytics/dashboard?weekId=nfl_2026_w1`

Then manually verify:

1. Select a demo account.
2. Open Markets.
3. Buy YES on an open market.
4. Buy NO on an open market.
5. Open Portfolio and confirm balance/positions update.
6. Open Leaderboard.
7. Login as `Demo Coach`.
8. Open Admin and lock/open/settle or void a market.
