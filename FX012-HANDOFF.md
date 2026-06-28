# FX012 Handoff — Live NFL Data, Automated Scoring & Settlement

## Summary

FX012 adds automated weekly operations to FantasyX. An administrator can now import CSV fantasy scores, preview settlement outcomes before committing, approve batch settlement with a single click, and lock markets past kickoff — all from dedicated admin pages.

FantasyX remains entirely free-play. No Solana, crypto, deposits, withdrawals, or real money.

## Completed

### Schema (migration `20260628250000_fx012_scoring_import`)
- Added `ImportStatus` enum: `PENDING`, `VALIDATED`, `IMPORTED`, `FAILED`
- Added `ScoreImport` model — tracks each CSV upload (who, when, how many rows, errors)
- Added `PlayerScore` model — stores Half-PPR stats + positional/overall ranks per player per week
- Added 3 new `AdminAuditAction` values: `SCORE_IMPORT`, `SETTLEMENT_BATCH`, `KICKOFF_LOCK`

### Services
- `lib/scoring.service.ts` — `calculateHalfPpr()` + `rankPlayers()` with dense positional and overall ranking, tie handling
- `lib/score-import.service.ts` — CSV parsing, validation (missing columns, bad positions, duplicates, unknown players), DB import with re-import support (overwrites previous score for same player+week)
- `lib/settlement-preview.service.ts` — `generateSettlementPreview()` (read-only, no mutations) + `approveBatchSettlement()` (loops every scored player, settles all eligible markets atomically, writes SETTLEMENT_BATCH audit log)

### API Routes
- `POST /api/admin/scoring/import?weekId=` — multipart CSV upload; resolves players by `player_id` or `player_name`
- `GET /api/admin/scoring/imports?weekId=` — list imports for a week
- `GET /api/admin/scoring/preview/[weekId]` — generate settlement preview (no mutations)
- `POST /api/admin/scoring/approve` — approve batch settlement
- `POST /api/admin/markets/lock-by-kickoff` — lock all OPEN markets where kickoff has passed
- `GET /api/admin/operations?weekId=` — operations dashboard stats (markets by status, players scored, settlement progress)

### Admin Pages
- `/admin/data` — NFL data sync page with provider architecture docs and per-entity sync results
- `/admin/scoring` — 4-step workflow: (1) select week + kickoff lock, (2) import CSV, (3) preview settlement, (4) approve

### Admin Home Enhanced
- Operations dashboard on `/admin` showing current week stats, settlement progress bar, last import timestamp
- Quick nav links to `/admin/data`, `/admin/weeks`, `/admin/markets`, `/admin/scoring`

### Tests
- `tests/scoring.test.ts` — 29 new tests
- Total: **203 tests** (all passing)

## CSV Format

```
player_name,team,position,pass_yards,pass_tds,interceptions,rush_yards,rush_tds,receptions,rec_yards,rec_tds,fumbles,two_point_conv
Patrick Mahomes,KC,QB,312,2,0,18,0,0,0,0,0,0
```

Or use `player_id` instead of `player_name` for exact DB ID matching (more reliable for admin use).

## Half-PPR Scoring

| Category | Points |
|----------|--------|
| Passing yards | 1 pt / 25 yards |
| Passing TD | 4 pts |
| Interception | -2 pts |
| Rushing yards | 1 pt / 10 yards |
| Rushing TD | 6 pts |
| Reception | 0.5 pts |
| Receiving yards | 1 pt / 10 yards |
| Receiving TD | 6 pts |
| Fumble lost | -2 pts |
| 2-pt conversion | 2 pts |

## Weekly Admin Workflow (FX-012)

1. Go to `/admin/weeks` → create & activate the week
2. Go to `/admin/markets` → generate slate, open markets
3. Go to `/admin/scoring` → click "Lock Markets Past Kickoff" when games start
4. After games: import the scoring CSV (download template for format)
5. Click "Generate Preview" → review which markets will be YES/NO
6. Click "Approve Settlement →" → confirm → batch settlement completes
7. `/admin` shows settlement progress bar

## Kickoff Guard

Trading is already rejected server-side for markets past kickoff (in `lib/trade.service.ts` via `assertBeforeKickoff(market.kickoffTime)`). The "Lock Markets Past Kickoff" button additionally updates market **status** to LOCKED in the database, so the UI shows the correct state.

## Architecture Notes

### Provider Abstraction

The NFL data provider interface (`lib/nfl-data/provider.ts`) is unchanged. To connect a real NFL API:
1. Create a class implementing `INflDataProvider`
2. Swap it in `app/api/admin/nfl/sync-demo/route.ts`

No other code changes needed.

### Re-import Safety

Re-importing a CSV for the same week overwrites previous scores for those players. Old scores for players NOT in the new CSV are preserved. The `ScoreImport` record tracks every upload for audit purposes.

### Settlement Atomicity

Each player's markets are settled in an individual `prisma.$transaction()`. If one player's settlement fails, others still succeed. Errors are collected and returned in the result. Previously settled markets are skipped (not double-settled).

## Files Changed

### New
- `prisma/migrations/20260628250000_fx012_scoring_import/migration.sql`
- `lib/scoring.service.ts`
- `lib/score-import.service.ts`
- `lib/settlement-preview.service.ts`
- `app/api/admin/scoring/import/route.ts`
- `app/api/admin/scoring/imports/route.ts`
- `app/api/admin/scoring/preview/[weekId]/route.ts`
- `app/api/admin/scoring/approve/route.ts`
- `app/api/admin/markets/lock-by-kickoff/route.ts`
- `app/api/admin/operations/route.ts`
- `app/admin/data/page.tsx`
- `app/admin/scoring/page.tsx`
- `tests/scoring.test.ts`
- `FX012-HANDOFF.md`

### Modified
- `prisma/schema.prisma` — new models, enums
- `app/admin/page.tsx` — operations dashboard + quick nav

## Test Results

```
Test Files  12 passed (12)
Tests       203 passed (203)
```

## Build Verification

```
npm run lint       ✓
npm run typecheck  ✓
npm test           ✓ (203 tests)
npm run build      ✓
```

## Next Recommended Ticket

**FX-013 — Live Provider Integration & Scheduled Locks**
- Connect a real NFL stats API (SportsData.io, MySportsFeeds)
- Implement a Vercel cron job or scheduled task for kickoff-based auto-lock
- Add a score import from a live stats API (skip CSV)
- Email/Slack notifications when settlement is complete
