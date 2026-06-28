# FX009 Handoff - Real User Accounts & Platform Identity

## Summary

FX009 replaces the demo account selector with real email/password accounts while preserving FantasyX as a free-play mock-credit platform. No Solana, crypto, deposits, withdrawals, custody, wagering, or real-money behavior was added.

## Completed

- Added account fields to `User`: first name, last name, display name, password hash, and role.
- Added `Session` model for server-side sessions with hashed opaque tokens.
- Added Prisma migration `20260628233000_fx009_real_accounts`.
- Replaced raw `fantasyx_user_id` cookie with signed httpOnly `fantasyx_session`.
- Added password hashing and verification with Node `crypto.scrypt`.
- Added `/signup`, `/login`, `/account`, and `/settings`.
- Added APIs for signup, login, logout, session, account, and settings.
- Removed public demo account picker API and UI.
- Signup grants 10,000 mock credits and writes a `SEED_GRANT` ledger entry.
- Seed now creates an env-driven admin from `ADMIN_*` variables.
- Login can bootstrap or repair the env-defined admin account when credentials match `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Navigation now shows Login/Sign Up when logged out and Markets/Portfolio/Leaderboard/Account/Settings/Logout when logged in.
- Admin APIs authorize via authenticated admin role/session.

## FX009.5 Follow-Up

- Middleware now includes `/account`, `/settings`, `/login`, and `/signup` in the matcher.
- Logged-out protected pages redirect to `/login?next=...`.
- Logged-in users visiting `/login` or `/signup` redirect to `/markets`.
- Login `next` paths are sanitized to internal URLs only.
- Normal signup cannot reserve the configured `ADMIN_EMAIL`.
- Stale current-state demo-auth documentation was cleaned up.

## Required Environment Variables

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_FIRST_NAME`
- `ADMIN_LAST_NAME`

## Tests Added

- `tests/auth-accounts.test.ts`
- Covers signup, duplicate email rejection, password hashing, login success/failure, logout, session persistence, authenticated trading, unauthorized trading rejection, user isolation, and admin permissions.

## Verification

- `npm run prisma:generate` - passed
- `npx prisma migrate deploy` - passed after baselining the pre-existing local `db push` schema
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm test` - passed, 137 tests across 9 files
- `npm run build` - passed
- `npx vercel deploy --prod --yes` - passed
- Production smoke passed for home, signup, session persistence, trading, portfolio, admin login, and admin stats.

## Notes

- Production must define `SESSION_SECRET` and `ADMIN_*` env vars before Vercel build/start.
- Seed resets seeded market/account/trade state and should only be run intentionally.
- CSRF protection and durable rate limiting remain future security hardening work.
