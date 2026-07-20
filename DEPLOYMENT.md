# FantasyX Deployment

Production URL: https://fantasy-x.vercel.app

## Platform

- Vercel project: `fantasy-x`
- Database: Neon PostgreSQL via Vercel integration
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`, and `AUTH_BASE_URL`
- Required for email authentication: `RESEND_API_KEY` and `AUTH_EMAIL_FROM`
- Required for social login: the credentials for each enabled Google, Microsoft, or Apple provider
- Seed-only admin vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`
- Recommended beta env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Local Development

Recommended database path: use a hosted dev Postgres database from Neon,
Supabase, Vercel Postgres, or another disposable dev database. This avoids
blocking local verification on Docker Desktop.

```powershell
npm install
npm run prisma:generate
npm run db:check
npm run db:prepare
npm run dev
```

Open `http://localhost:3000/signup`.

`npm run prisma:seed` creates the admin account from the `ADMIN_*` variables and seeded NFL market data. It also creates non-public development trader rows used only to populate analytics and leaderboard history.

Optional Docker database:

```powershell
docker compose up -d
npm run db:prepare
```

Do not spend sprint time debugging Docker Desktop if it is stuck. A hosted dev
Postgres URL in `.env.local` is the preferred fallback.

Admin access is provisioned only by the explicit seed operation. The public login route never creates users, changes roles, or refreshes an administrator password from environment variables.

Email/password accounts must verify their email address before the first login. In production, verification and password-reset links are delivered through Resend. Social sign-in providers appear only when their complete credential set is configured.

Login redirects only allow internal `next` paths. External or protocol-relative redirect targets fall back to `/markets`.

Authenticated client mutations fetch a CSRF token from `/api/session` and send it as `x-csrf-token`. Production `SESSION_SECRET` must stay stable across deployments or existing session/CSRF tokens will become invalid.

## Local Verification

```powershell
npm run verify:fast
npm run verify
```

`npm run verify:fast` does not require a database. It runs lint, typecheck, the
focused no-DB rate-limit tests, and build.

`npm run verify` is the full gate. It requires a reachable, migrated, and seeded
Postgres database and runs lint, typecheck, full Vitest, build, and the E2E
golden-path smoke test. If `DATABASE_URL` is missing or unreachable, it fails
with setup guidance for hosted dev Postgres or optional Docker Postgres.

Before full verification against a disposable dev/test database:

```powershell
npm run db:check
npm run db:prepare
```

`npm run db:prepare` runs migrations and seed data against `DATABASE_URL`.
Do not run it casually in production because the seed script resets seeded
market, trade, account, and analytics state.

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
4. Set `AUTH_BASE_URL` to the canonical HTTPS application URL.
5. Add `RESEND_API_KEY` and a verified `AUTH_EMAIL_FROM` sender.
6. Add credentials and registered callback URLs for each enabled OAuth provider. Apple web callbacks require a registered HTTPS domain.
7. Add `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME` only if the seed operation will provision an administrator.
8. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` before beta launch so rate limits are durable across Vercel instances.
9. Deploy to Vercel. Vercel runs `prisma migrate deploy` automatically.
10. Seed manually only when intentionally resetting market/account seed data:

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

1. Create a new account from `/signup`, verify its email, and log in.
2. Request and complete a password reset; confirm the reset link cannot be reused.
3. Enable authenticator-app 2FA, sign in with a TOTP code, and test one recovery code.
4. Verify each configured social provider shows its account-selection screen and returns to FantasyX.
5. Open Markets and buy YES and NO on an open market.
6. Open Portfolio and confirm balance/positions update.
7. Confirm a signed-out visitor can browse but cannot submit a trade.
8. Login as the seeded admin and lock/open/settle or void a market.
9. Launch the packaged desktop app and verify the browser-to-app login handoff completes once and cannot be replayed.
