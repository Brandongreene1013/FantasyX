# FantasyX Live Data Operations

## Provider

FantasyX supports licensed SportsDataIO NFL data through the existing provider adapter. Production activation requires a commercial SportsDataIO agreement and an unscrambled production key.

```env
NFL_DATA_PROVIDER="sportsdataio"
NFL_DATA_API_KEY="server-side-production-key"
CRON_SECRET="random-secret-with-at-least-32-bytes"
```

Never place the provider key in a `NEXT_PUBLIC_*` variable, browser request, mobile bundle, desktop bundle, log, or analytics event.

## Sync Flow

1. `/api/cron/sync-nfl` performs the daily schedule/player sync.
2. `/api/cron/sync-live` performs a lightweight score-state sync for the current or next database week.
3. Both GET and POST live-sync requests require `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`.
4. Game state is normalized and stored before the public slate and SSE routes read it.
5. The browser never calls SportsDataIO directly.

Optional target override:

```text
/api/cron/sync-live?season=2026&week=1
```

During games, invoke the live endpoint every 15-30 seconds within the provider contract and hosting limits. Vercel Hobby cron is daily-only and cannot operate a live scoreboard. Use a compliant external scheduler or upgrade the execution environment before enabling frequent calls.

## Safety

- Scores, period, clock, possession, and provider status are display data only.
- Live-score updates never settle FantasyX markets or write account ledgers.
- Settlement continues through final player-stat imports and administrative approval.
- Missing fields remain null and render as unavailable.
- Live records older than 90 seconds render `Updates delayed`.
- Trial or replay data must only be used in clearly identified development/test environments.

## Logos And Branding

FantasyX does not ingest or display NFL, league, team, helmet, or uniform logos. The scoreboard uses plain team abbreviations in original FantasyX UI components. Do not scrape artwork from league, team, media, search, encyclopedia, or social sites. A score-data agreement does not grant image rights unless the signed contract explicitly says it does.

## Activation Checklist

- Confirm the signed agreement permits commercial display in web and downloadable clients.
- Confirm allowed polling frequency, caching, retention, attribution, and redistribution terms.
- Confirm production data is accurate and unscrambled.
- Add the three server-side variables in Vercel Production.
- Run a SportsDataIO replay through scheduled, live, halftime, overtime, delayed, postponed, canceled, and final states.
- Trigger one manual `Sync Live Scores` operation in `/admin/data`.
- Verify `/api/health?deep=1` using the cron bearer secret.
- Keep provider invoices and license terms with company records.
