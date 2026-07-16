# FX020 Handoff - Beta Growth Loop

## Status

FX020 is implemented and build-verified. Database-backed integration tests still need to be rerun once Docker Desktop/Postgres is available locally.

## Sprint Direction

The project direction shifted from provider-backed intelligence to launch-readiness for NFL season. The highest-leverage next move is to make every early user capable of inviting the next user.

## What Changed

- Added a referral-code growth loop for public beta.
- Added `User.referralCode`, `User.referredByUserId`, and self-referential referral relations.
- Added Prisma migration `20260708200000_fx020_beta_growth_loop`.
- Added `lib/referrals.ts` for referral-code generation, normalization, lookup, and backfill.
- Updated signup so `/signup?ref=CODE` attributes the new account to the referring user.
- Updated account API to return referral code, invite URL, referral count, and inviter display name.
- Updated account page with a copyable invite panel.
- Updated signup page to show the active invite code.
- Updated seed users with deterministic demo referral codes.
- Added auth/account test coverage for referral attribution.

## Product Impact

FantasyX now has a basic user acquisition loop:

1. Existing user opens account page.
2. User copies their invite link.
3. New user lands on `/signup?ref=CODE`.
4. Signup attributes the account to the referrer.
5. Referrer sees referral count on account page.

This remains free-play only and does not change balances, trading, settlement, leaderboard, custody, crypto, or real-money behavior.

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260708200000_fx020_beta_growth_loop/migration.sql`
- `lib/referrals.ts`
- `lib/api-validation.ts`
- `lib/auth.ts`
- `lib/client-api.ts`
- `app/api/auth/signup/route.ts`
- `app/api/session/route.ts`
- `app/api/account/route.ts`
- `app/signup/page.tsx`
- `app/account/page.tsx`
- `prisma/seed.ts`
- `tests/auth-accounts.test.ts`

## Verification

Passed:

```powershell
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Blocked:

```powershell
npm run test -- tests/auth-accounts.test.ts
```

Reason: Docker Desktop/Postgres was not running. `docker compose up -d` failed because the Docker daemon pipe was unavailable.

## Next Recommended Sprint

FX021 should focus on beta conversion and retention:

- First-trade guided path after onboarding.
- Shareable market links/cards for specific players and markets.
- Lightweight invite/referral leaderboard.
- E2E smoke test for signup with referral -> onboarding -> first trade -> portfolio.
- Production launch checklist: domain, analytics, error logging, rate limit strategy, and seed/reset discipline.
