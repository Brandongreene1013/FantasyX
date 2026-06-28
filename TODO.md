# TODO

## Active

_No active tickets. Next sprint TBD._

## Completed - FX-014 Public Beta Mobile UX & Visual Identity

1. Added dark sports-trading design system to `tailwind.config.ts`: `surface`, `panel`, `panel2`, `rim`, `frost`, `muted`, `neon`, `charge`, `amber`, `crimson`, `qb/rb/wr/te` position colors; glow shadows; hero/card/neon gradients; `pulse-slow` and `slide-up` animations.
2. Updated `app/globals.css`: color-scheme dark, body defaults, `.animate-shimmer`, `.market-card-hover`, `.text-gradient-neon/gold`, `.pb-safe`, dark scrollbar.
3. Created `lib/team-colors.ts`: `getTeamColors()` for all 32 NFL teams + FA, `getPositionColor()`, `ALL_TEAMS`.
4. Created `components/ui/player-avatar.tsx`: `PlayerAvatar` with team-color gradient + initials + position badge; `headshotUrl` hook for future licensed images.
5. Created `components/ui/stat-pill.tsx`, `price-badge.tsx`, `trend-badge.tsx`, `loading-skeleton.tsx`, `empty-state.tsx`.
6. Created `components/bottom-nav.tsx`: 5-tab mobile bottom nav (Home/Markets/Portfolio/Leaders/Account) with neon active indicator and safe-area padding.
7. Rewrote `components/site-nav.tsx`: desktop links + admin link; mobile defers to `<BottomNav>`.
8. Redesigned `components/account-bar.tsx`: compact wallet + balance, P&L badge, admin indicator.
9. Updated `app/layout.tsx`: `dark` class on html, `themeColor #0D1117`, glassmorphism header, `pb-24 sm:pb-8`.
10. Rewrote `app/page.tsx`: hero gradient, neon headline, How It Works cards, Trending/Movers/Locking-Soon sections.
11. Rewrote `app/markets/page.tsx`: search + clear, position pill tabs, expandable filter panel, threshold tabs, optimistic watchlist star.
12. Rewrote `app/markets/[marketId]/page.tsx`: player hero card with team colors, large YES/NO price tiles, sentiment bars, mobile-first layout.
13. Rewrote `app/portfolio/page.tsx`: hero stats, analytics grid, equity curve, Open/Closed tabs, `PlayerAvatar` position cards.
14. Rewrote `app/leaderboard/page.tsx`: top-3 podium, full table with rank icons, current user highlight.
15. Rewrote `app/login/page.tsx` and `app/signup/page.tsx`: dark glass-card forms with neon CTAs.
16. Updated `components/market-card.tsx`: position strip, PlayerAvatar, flame/clock indicators, watchlist star, YES/NO price buttons.
17. Updated `components/page-heading.tsx`: dark tokens.
18. Added `WatchMarket` model to `prisma/schema.prisma`; `favoriteTeam` + `onboardingDone` on `User`.
19. Created and deployed `prisma/migrations/20260628270000_fx014_watchlist_onboarding/migration.sql`.
20. Created `app/api/watchlist/route.ts` (GET) and `app/api/watchlist/[marketId]/route.ts` (POST add/remove).
21. Created `app/onboarding/page.tsx`: 5-step flow with team picker; calls onboarding API.
22. Created `app/api/auth/onboarding/route.ts`: saves `favoriteTeam` + `onboardingDone`.
23. Updated signup to redirect to `/onboarding` on success.
24. tsc clean, lint clean, 230/230 tests passing, build clean.

## Completed - FX-013 Real NFL Provider Integration & Scheduled Jobs

1. Created `lib/nfl-data/provider-config.ts`: env-based provider factory; `NFL_DATA_PROVIDER` env var; falls back to DemoNflDataProvider with console.warn if API key missing; API key NEVER logged.
2. Created `lib/nfl-data/providers/sleeper-provider.ts`: SleeperNflDataProvider — free, no API key; static 32-team list; active QB/RB/WR/TE from /players/nfl endpoint; injury status mapping; returns [] for games (no schedule endpoint).
3. Created `lib/nfl-data/providers/sportsdata-provider.ts`: SportsDataIoProvider shell — paid; `Ocp-Apim-Subscription-Key` header auth; all methods implemented against paid API.
4. Created `lib/operation-log.service.ts`: `OperationLog` CRUD, `runTracked()` wrapper, `Prisma.InputJsonValue` cast for summary JSON field.
5. Created `lib/rate-limit.ts`: `RateLimitAdapter` interface; `InMemoryRateLimitAdapter` with window-based counters; `defaultRateLimiter` export.
6. Created `app/api/cron/lock-markets/route.ts`: POST+GET; `Authorization: Bearer CRON_SECRET` auth; wraps `runTracked("CRON_LOCK_MARKETS")`.
7. Created `app/api/cron/sync-nfl/route.ts`: POST+GET; `Authorization: Bearer CRON_SECRET` auth; wraps `runTracked("CRON_SYNC_NFL")`.
8. Created `app/api/admin/provider-status/route.ts`: GET; requireAdminUser.
9. Created `app/api/admin/nfl/sync/route.ts`: POST; requireAdminUser + requireCsrf; Zod: `{ season?, week?, op }`.
10. Created `app/api/admin/operations/history/route.ts`: GET; requireAdminUser.
11. Added `vercel.json`: cron lock-markets every 15 min, sync-nfl every 6 hours.
12. Rewrote `app/admin/data/page.tsx`: provider status panel, manual sync controls, operation log table.
13. Created `tests/provider.test.ts`: 27 tests — provider selection, cron auth, rate limiter, Sleeper mocked fetch, op log DB.
14. Created `FX013-HANDOFF.md` and `SPRINT SUMMARIES/FX013-.../SUMMARY.md`.

## Completed - FX009 Real User Accounts & Platform Identity

1. Added real email/password signup and login.
2. Added scrypt password hashing and generic login failure messaging.
3. Added signed httpOnly `fantasyx_session` cookie backed by server-side `Session` rows.
4. Added `UserRole`, account identity fields, and FX009 Prisma migration.
5. Added `/signup`, `/account`, and `/settings`; removed the demo account picker.
6. Signup grants 10,000 mock credits through a ledger `SEED_GRANT`.
7. Seed creates the admin from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME`.
8. Added `tests/auth-accounts.test.ts`; later sprints expanded the test suite.

## Completed - FX-007 Market Intelligence & Analytics

1. Added `MarketPriceHistory` model and migration for additive market price history snapshots.
2. Created `lib/market-analytics.service.ts`: chart history generation, material snapshot recording, sentiment scoring, trending ranking, biggest movers, portfolio analytics, and dashboard reads.
3. Updated market event emission to persist price snapshots when market prices materially change.
4. Created `components/analytics-charts.tsx`: responsive Recharts YES/NO price, volume, open-interest, and equity curve charts.
5. Created `GET /api/analytics/dashboard`: trending markets, biggest movers, recently settled, highest volume, highest open interest, and most active players.
6. Updated market detail pages with market sentiment, confidence, YES movement, and three analytics charts.
7. Updated portfolio with current portfolio value, weekly/all-time P&L, unrealized/realized gain-loss, win rate, average entry, largest position, best trade, worst trade, and real equity curve.
8. Updated home page with the market intelligence dashboard.
9. Added `tests/market-analytics.test.ts`: 6 tests.

## Completed - FX-006 NFL Data Engine

1. Created `lib/nfl-data/types.ts`: NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord, NflSyncResult.
2. Created `lib/nfl-data/provider.ts`: INflDataProvider interface.
3. Created `lib/nfl-data/demo-provider.ts`: DemoNflDataProvider with 20 teams, 13 players, 10 games, Week 1 2026 slate.
4. Created `lib/nfl-sync.service.ts`: idempotent sync; upserts weeks, games, players; creates only missing markets.
5. Created `POST /api/admin/nfl/sync-demo` and `GET /api/admin/nfl/stats`.
6. Created admin NFL Data panel in `/admin/data`.
7. Added `tests/nfl-data.test.ts`: 27 tests.
