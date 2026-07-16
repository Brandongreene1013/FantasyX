# FX022 Handoff - Launch Instrumentation and Activation Metrics

## Status

FX022 is implemented and build-verified. Database-backed tests still need Docker Desktop/Postgres running before they can be rerun locally.

## Sprint Direction

FX022 adds first-party beta instrumentation so FantasyX can measure the launch funnel without depending on external analytics.

## What Changed

- Added `BetaEventType` enum and `BetaEvent` model.
- Added migration `20260708210000_fx022_beta_instrumentation`.
- Added `lib/beta-events.ts` with best-effort event tracking helpers.
- Added `POST /api/beta-events` for authenticated client-side beta events.
- Added `GET /api/admin/beta` for admin activation metrics.
- Added `/admin/beta` dashboard.
- Added Beta Metrics link to `/admin`.
- Tracked server-side events:
  - `SIGNUP`
  - `REFERRAL_SIGNUP`
  - `ONBOARDING_COMPLETE`
  - `FIRST_TRADE`
- Tracked client-side events:
  - `INVITE_COPY`
  - `MARKET_SHARE`

## Product Impact

FantasyX can now answer beta-launch questions:

- How many users signed up?
- How many came through referrals?
- How many completed onboarding?
- How many made a first trade?
- Are users copying invite links?
- Are users sharing specific markets?
- Which users are driving referrals?

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260708210000_fx022_beta_instrumentation/migration.sql`
- `lib/beta-events.ts`
- `app/api/beta-events/route.ts`
- `app/api/admin/beta/route.ts`
- `app/admin/beta/page.tsx`
- `app/admin/page.tsx`
- `app/api/auth/signup/route.ts`
- `app/api/auth/onboarding/route.ts`
- `app/api/trades/route.ts`
- `app/account/page.tsx`
- `components/share-market-button.tsx`
- `lib/client-api.ts`

## Verification

Passed:

```powershell
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Build initially hit the recurring stale `.next` readlink issue under OneDrive. Clearing generated `.next` output and rerunning build passed.

Blocked:

```powershell
npx prisma migrate deploy
npm run test -- tests/auth-accounts.test.ts
```

Reason: Docker Desktop/Postgres is still unavailable locally.

## Next Recommended Sprint

FX023 should focus on beta launch hardening:

- Durable/shared rate limiting plan and implementation.
- Basic production observability checklist.
- Add `npm run verify` script.
- Add Playwright smoke test for referral signup -> onboarding -> first trade -> portfolio.
- Add launch checklist doc for domain, Vercel env vars, Neon/Postgres, seed discipline, and rollback steps.
