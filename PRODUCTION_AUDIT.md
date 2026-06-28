# FantasyX Production Audit

Date: 2026-06-28
Sprint: FX008 - Production Readiness
Production URL: https://fantasy-x.vercel.app

## Summary

FantasyX is deployed on Vercel with a Neon PostgreSQL database. The core implemented production loop was verified: demo login, market browsing, YES/NO buys, portfolio reads, leaderboard reads, admin lock/open/void/settlement APIs, migrations, seeded data, and page refresh.

This sprint did not add new product features. Two requested flows, selling positions and creating markets from the UI, are not part of the current implemented application and remain documented gaps.

## Issues

| Issue | Severity | Root Cause | Fix | Status |
| --- | --- | --- | --- | --- |
| Vercel deploy failed on first migration | High | `20260628121000_fx001_append_only_ledger/migration.sql` contained a UTF-8 BOM character rejected by Neon/Postgres. | Removed BOM and recovered the failed migration record using one-time Vercel build recovery. | Fixed |
| Vercel build needed Prisma migration/generate steps | High | Default Next build did not guarantee Prisma migrations and generated client on Vercel. | Added `vercel.json` and `npm run vercel-build` with `prisma migrate deploy && prisma generate && next build`. | Fixed |
| Local build broke when migration deploy was added directly to `build` | Medium | Local DB was created by `db push`, so `prisma migrate deploy` could not baseline it. | Restored `npm run build` to `next build`; added separate `vercel-build`. | Fixed |
| Environment variables were under-documented | Medium | `.env.example` only showed local `DATABASE_URL`. | Expanded `.env.example` with required `DATABASE_URL` and Vercel/Neon shape. | Fixed |
| Missing env caused low-context Prisma/runtime failures | Medium | No explicit server env validation existed before Prisma client creation. | Added `lib/env.ts` and validation on Prisma initialization. | Fixed |
| API unknown errors could expose raw exception messages | High | `apiError` returned `error.message` for unknown errors. | Unknown errors now return safe fallback messages, structured logs, and request IDs. | Fixed |
| Admin adjustment missing target user returned generic 500 after safe-error change | Medium | Route threw raw `Error` for expected not-found state. | Converted to `DomainError("NOT_FOUND")`. | Fixed |
| Admin note missing market returned generic 500 after safe-error change | Medium | Route threw raw `Error` for expected not-found state. | Converted to `DomainError("NOT_FOUND")`. | Fixed |
| Request IDs missing from API error responses | Medium | Middleware and API errors did not share a request identifier. | Middleware now adds `x-request-id`; API errors include and return request IDs. | Fixed |
| Visible placeholder copy on player page | Low | Earlier sprint used placeholder wording for demo projections/history. | Reworded to production-safe demo model language. | Fixed |
| Production demo data initially felt empty | Medium | Seed data had markets but no real trade activity. | Seed now creates real demo trades through existing trade service and one settlement through settlement service. | Fixed |
| `sell positions` flow missing | High | Current product only implements buy YES/NO and settlement payouts/refunds; no sell service, API, UI, or tests exist. | Not implemented in FX008 because it is new product/trading functionality and conflicts with "Do NOT build new product features." | Open |
| `create market` admin flow missing | Medium | Current market creation is via seed and NFL sync service; admin UI does not create arbitrary markets. | Not implemented in FX008 because it is new product/admin functionality and conflicts with sprint scope. | Open |
| Trade execution lacks explicit row-level locking | High | Current Prisma transaction does not lock user/market rows for simultaneous trade pressure. | Documented as next correctness ticket; existing tests still cover ordinary transaction safety. | Open |
| Demo auth is not production-grade identity | Medium | Demo account cookie stores account ID for MVP convenience. | Kept by design for free-play demo; documented as known issue. | Open |
| In-memory rate limiting is not durable | Medium | Middleware Map is per runtime instance. | Kept as MVP protection only; documented as known issue. | Open |

## Production Smoke Results

Verified against `https://fantasy-x.vercel.app`:

- `GET /` -> 200
- `GET /login` -> 200
- `GET /api/auth/demo-users` -> 200
- `GET /api/analytics/dashboard?weekId=nfl_2026_w1` -> 200 with active market data
- `POST /api/auth/login` -> 200 with cookie session
- `GET /api/portfolio` with session -> 200
- `POST /api/trades` with session -> 200 for a small YES trade

## API Audit

Implemented API routes:

- `GET /api/auth/demo-users`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/session`
- `GET /api/slate`
- `POST /api/trades`
- `GET /api/portfolio`
- `GET /api/trade-history`
- `GET /api/account-ledger`
- `GET /api/market-events`
- `GET /api/leaderboard`
- `POST /api/settlements`
- `POST /api/admin/adjustments`
- `POST /api/admin/notes`
- `GET /api/admin/audit-history`
- `POST /api/admin/nfl/sync-demo`
- `GET /api/admin/nfl/stats`
- `GET /api/analytics/dashboard`

All routes use typed validation or guarded service calls where applicable. Expected auth/domain/validation failures return stable JSON. Unknown server failures now return safe fallback JSON and structured logs.

## Vercel Compatibility

- Prisma works on Vercel using Neon `DATABASE_URL`.
- `prisma migrate deploy` works on clean production deploys.
- `prisma generate` runs during Vercel build.
- No SQLite assumptions were found.
- No application runtime depends on localhost URLs.
- Build succeeds without manual intervention after the one-time migration recovery.
