# FX-013 Handoff: Real NFL Provider Integration & Scheduled Jobs

## Status: COMPLETE

All deliverables shipped. 230 tests pass. TypeScript clean. No ESLint errors.

---

## What Was Built

### Provider Architecture

| File | Description |
|------|-------------|
| `lib/nfl-data/provider-config.ts` | Env-based factory + `getProviderStatus()` / `getConfiguredProvider()` |
| `lib/nfl-data/providers/sleeper-provider.ts` | Sleeper API adapter (free, no API key) |
| `lib/nfl-data/providers/sportsdata-provider.ts` | SportsData.io adapter shell (paid, requires API key) |

**Provider selection via `NFL_DATA_PROVIDER` env var:**
- `demo` (default) — bundled static data, no network
- `sleeper` — free Sleeper public API, no API key needed
- `sportsdataio` — requires `NFL_DATA_API_KEY`
- `disabled` — provider disabled

Missing API key for a key-required provider → logs warning, falls back to demo. **API key is never logged.**

### Scheduled Cron Endpoints

| Route | Schedule | Auth | Description |
|-------|----------|------|-------------|
| `POST /api/cron/lock-markets` | Every 15 min | `CRON_SECRET` | Auto-locks OPEN markets past kickoff |
| `POST /api/cron/sync-nfl` | Every 6 hours | `CRON_SECRET` | Syncs current week data from provider |

Both endpoints also accept `GET` for Vercel health pings.

**Auth:** `Authorization: Bearer {CRON_SECRET}` (Vercel standard) or `x-cron-secret: {CRON_SECRET}` header for local testing.

### Operation Logging

| File | Description |
|------|-------------|
| `lib/operation-log.service.ts` | `startOperation`, `finishOperation`, `runTracked` — DB-backed op logging |
| `prisma/migrations/20260628260000_fx013_operation_logs/migration.sql` | `operation_logs` table |

Every cron job and admin sync is logged with type, status, duration, summary JSON, and error message. Queryable via `getLastOperation`, `getLastSuccessfulOperation`, `getRecentOperations`.

### Rate Limiting

`lib/rate-limit.ts` — `RateLimitAdapter` interface + `InMemoryRateLimitAdapter`.  
Production: swap `defaultRateLimiter` with a Redis-backed adapter for multi-instance deployments.

### New Admin API Routes

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/admin/provider-status` | Admin session | Provider config + cron health |
| `POST /api/admin/nfl/sync` | Admin + CSRF | Manual NFL sync with operation logging |
| `GET /api/admin/operations/history` | Admin session | Last 30 operation logs |

### Updated Pages

- **`/admin/data`** — Provider status banner, live vs. demo indicator, CRON_SECRET warning, manual sync buttons for each op, sync results, operation log table, provider config instructions
- **`/admin`** — (preserved from FX-012) Quick nav, operations dashboard

### vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/lock-markets", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/sync-nfl",     "schedule": "0 */6 * * *" }
  ]
}
```

---

## Environment Variables

```env
# Provider selection
NFL_DATA_PROVIDER=sleeper        # demo | sleeper | sportsdataio | disabled
NFL_DATA_API_KEY=                # required for sportsdataio only; never logged

# Cron protection
CRON_SECRET=<random-secret>      # protects /api/cron/* endpoints
```

---

## Hard Constraints Maintained

- No Solana. No crypto. No real-money wagering.
- No deposits, no withdrawals, no custody.
- Admin still reviews settlement preview and manually approves — **no auto-settlement from live data.**
- `NFL_DATA_API_KEY` is read once at server startup and never logged.

---

## Test Coverage

- `tests/provider.test.ts` — 27 tests covering:
  - Provider selection (`getProviderStatus`, `getConfiguredProvider`)
  - Demo fallback when API key missing
  - Unknown provider name fallback
  - CRON_SECRET validation logic
  - Rate limiter (allow, block, reset)
  - `SleeperNflDataProvider` (mocked fetch): teams, player filter, injury status, games, weeks, error handling
  - `operation-log.service` (DB): start, finish, runTracked success/failure, getLastSuccessful

**Total: 230 tests, 13 test files, all passing.**

---

## Next Ticket

FX-014 (TBD by roadmap).

For real-time kickoff locking, increase cron frequency or use a webhook from the data provider. SportsData.io provides real-time feed subscriptions.
