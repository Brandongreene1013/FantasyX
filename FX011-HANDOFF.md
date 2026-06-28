# FX-011 Handoff — Market Creation Engine & Weekly Slate Builder

## Summary

FX-011 adds a complete weekly market creation system to FantasyX. An administrator can now generate an entire NFL week's prediction markets in minutes instead of manually creating each one. The sprint adds market templates, a weekly slate generator, week management, a dedicated admin market dashboard, bulk operations, and full market status lifecycle support.

## What Was Built

### New Status Values

`MarketStatus` now includes `DRAFT` and `SCHEDULED` in addition to the original `OPEN`, `LOCKED`, `SETTLED`, and `VOID`. This enables a create-review-publish workflow where admins generate markets in DRAFT, review them, then bulk-open when ready.

### Market Templates (`lib/market-template.service.ts`)

8 static templates define which threshold types apply to each position:

| Position | Templates         |
|----------|-------------------|
| QB       | TOP_3, TOP_5      |
| RB       | TOP_5, TOP_10     |
| WR       | TOP_5, TOP_10     |
| TE       | TOP_3, TOP_5      |

Templates are code-defined (not DB-stored) for simplicity and are exported for use in both the generator and the admin UI.

### Market Generation Service (`lib/market-generation.service.ts`)

`generateMarketsForWeek(options)`:

- Fetches all active players (or a filtered subset via `playerIds`)
- Applies position-appropriate templates
- Prevents duplicates via market ID uniqueness and player/week/threshold unique constraint
- Supports `initialStatus` of `DRAFT` or `OPEN`
- Creates a market event (ADMIN_NOTE) and admin audit record per market
- Returns: `{ playersProcessed, marketsCreated, marketsSkipped, errors }`

`bulkMarketAction(weekId, action, adminId)`:

- Supports `OPEN`, `LOCK`, `VOID`, `ARCHIVE` bulk actions
- Skips ineligible markets (e.g., SETTLED markets on VOID)
- Creates market events and admin audit records
- Returns: `{ affected, skipped, action }`

### Week Service (`lib/week.service.ts`)

- `createWeek(input)` — creates a new `NflWeek` with `SCHEDULED` status and writes a `WEEK_CREATE` audit record
- `updateWeekStatus(weekId, newStatus, adminId)` — transitions week through `SCHEDULED → ACTIVE → COMPLETE → ARCHIVED` with audit records
- `listWeeksWithCounts()` — returns all weeks with market counts, player counts, and per-status breakdowns
- `getWeekWithCounts(weekId)` — single week with counts

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/weeks` | GET | List all weeks with counts |
| `/api/admin/weeks` | POST | Create a new week |
| `/api/admin/weeks/[weekId]` | PATCH | Update week status |
| `/api/admin/markets` | GET | List markets with filters (weekId, status, position) |
| `/api/admin/markets/generate` | POST | Generate markets for a week |
| `/api/admin/markets/bulk-action` | POST | Bulk OPEN/LOCK/VOID/ARCHIVE |

All routes require admin authentication and CSRF on mutations.

### Admin Market Dashboard (`/admin/markets`)

Exchange operations console with:

- Week selector (pulls from DB)
- Status stats grid (DRAFT / SCHEDULED / OPEN / LOCKED / SETTLED / VOID counts)
- Current week status indicator with market + player counts
- Generate Markets panel with template list and DRAFT/OPEN status selector
- Bulk actions (Open All / Lock All / Void All / Archive Week) with confirmation dialogs
- Full market table with player, position, threshold, status, YES price, volume, trade count, kickoff

### Admin Weeks Page (`/admin/weeks`)

Week management console with:

- Create week form (season, week number, date range pickers)
- Week cards showing status, market counts, progress bar for settlement
- Activate / Deactivate / Archive actions per week
- Link to view markets for each week

### Middleware

`/admin/*` routes are now fully protected at the middleware level (in addition to API-level admin checks).

## Schema Changes

Migration: `prisma/migrations/20260628240000_fx011_market_creation_engine/migration.sql`

- `MarketStatus`: Added `DRAFT`, `SCHEDULED`
- `AdminAuditAction`: Added `MARKET_CREATE`, `BULK_OPEN`, `BULK_LOCK`, `BULK_VOID`, `WEEK_CREATE`, `WEEK_ACTIVATE`, `WEEK_DEACTIVATE`, `WEEK_ARCHIVE`

## Tests

`tests/market-generation.test.ts` — 24 tests:

- **Market Templates**: template count, per-position threshold coverage
- **Week Service**: create, duplicate rejection, activate/deactivate/archive
- **Market Generation**: generates for specified players, idempotency, DRAFT vs OPEN status
- **Bulk Actions**: bulk lock, bulk open, void skips settled, error on missing week
- **API Authorization**: all 4 new admin routes reject non-admin requests with 403
- **API Integration**: weeks list, week create, market generate

Total: 174 tests (150 existing + 24 new). All pass.

## Files Changed

### New Files

- `lib/market-template.service.ts`
- `lib/market-generation.service.ts`
- `lib/week.service.ts`
- `app/api/admin/weeks/route.ts`
- `app/api/admin/weeks/[weekId]/route.ts`
- `app/api/admin/markets/route.ts`
- `app/api/admin/markets/generate/route.ts`
- `app/api/admin/markets/bulk-action/route.ts`
- `app/admin/markets/page.tsx`
- `app/admin/weeks/page.tsx`
- `prisma/migrations/20260628240000_fx011_market_creation_engine/migration.sql`
- `tests/market-generation.test.ts`
- `FX011-HANDOFF.md`

### Modified Files

- `prisma/schema.prisma` — added DRAFT, SCHEDULED, 8 new audit actions
- `lib/types.ts` — MarketStatus union updated
- `lib/db-serialization.ts` — DbMarket status union updated
- `lib/client-api.ts` — added 4 new response types
- `middleware.ts` — added `/admin/*` route protection
- `ROADMAP.md`, `TODO.md`, `SYSTEM_ARCHITECTURE.md` — updated

## Definition of Done

An admin can now:

1. Go to `/admin/weeks` and create a new NFL week
2. Activate the week
3. Go to `/admin/markets` and click "Generate All Markets" for instant slate creation
4. Review the market table (all markets created in OPEN or DRAFT)
5. Use bulk actions to Lock All, Open All, Void All, or Archive Week
6. Navigate back to `/admin` for per-player settlement

No database manual intervention required.

## Last Verified Results

- `npx prisma migrate deploy` — passed
- `npx prisma generate` — passed
- `npm run typecheck` — passed
- `npm test` — 174 tests pass
- `npm run build` — passed

## Known Limitations

- The generate API generates markets for **all active players** by default. The `playerIds` filter scopes generation to specific players (used in tests for isolation).
- Templates are code-defined; future templates (fantasy points over/under, passing/rushing/receiving yards, TDs, receptions) will extend `MARKET_TEMPLATES` in `lib/market-template.service.ts`.
- Bulk ARCHIVE uses VOID status for market state; a separate `ARCHIVED` market status could be added in a future sprint.
- No UI for filtering market generation by position group yet (all templates fire for all matching players).

## Next Recommended Ticket

FX-012 — Kickoff-Based Auto-Lock & Scoring Import:

- Scheduled job to auto-lock markets at kickoff
- CSV upload for fantasy scoring data
- Calculate half-PPR positional ranks from score imports
- Settlement preview before commit
