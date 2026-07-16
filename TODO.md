# TODO

## Active

FX024 - Provider-Ready Projection Ingestion.

1. Add projection source abstraction separate from roster/schedule providers.
2. Add projection metadata/source/date tracking.
3. Add admin projection import preview before market generation.
4. Keep ADP as fallback pricing context only.
5. Remaining hardening follow-ups: structured observability/metrics, production load testing, CI pipeline.

## Completed - FX-024.5 Beta Launch Hardening

1. Added `lib/rate-limit-upstash.ts`: Upstash-Redis fixed-window adapter over the REST API (edge + Node compatible, fail-open, token never logged).
2. Added `lib/rate-limit-config.ts`: env-gated limiter factory (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`), in-memory fallback with one-time warning, `enforceRateLimit`, `getClientIp`, route limit constants.
3. Added `RateLimitError` (429, code `RATE_LIMITED`) and mapped it in `lib/api-response.ts` with `x-ratelimit-*` headers.
4. Wired route-level limits: trades 30/min per user, login/signup 10/min per IP, beta-events 60/min per user.
5. Documented the per-instance limitation of the middleware IP bucket.
6. Added `npm run verify` (`scripts/verify.mjs`): lint → typecheck → tests → build, fail-fast, with an actionable Postgres preflight message before DB-backed tests.
7. Added `npm run test:e2e` (`playwright.e2e.config.ts`, `tests/e2e/golden-path.spec.ts`): signup → onboarding → buy YES → portfolio → admin settle → payout in balance and ledger.
8. Updated `.env.example` with Upstash variables.
9. Added `tests/rate-limit.test.ts`: 11 tests (adapter windows, fail-open, factory selection, 429 mapping, client IP).

## Completed - FX-023 Week 1 Player Universe and Research-Based Opening Prices

1. Updated seed Week 1 schedule to the current published 2026 slate.
2. Expanded seed player universe from 105 to 119 players.
3. Added ADP/rank and matchup context inputs to opening price model.
4. Updated seed market generation to use researched pricing context.
5. Added `FX023-PRICING-RESEARCH.md`.
6. Added focused opening-price tests for researched context.
7. Verification: typecheck, opening-price tests, lint, and build passed.

## Completed - FX-022 Launch Instrumentation and Activation Metrics

1. Added `BetaEventType` enum and `BetaEvent` table.
2. Added migration `20260708210000_fx022_beta_instrumentation`.
3. Created `lib/beta-events.ts`.
4. Added `POST /api/beta-events`.
5. Added `GET /api/admin/beta`.
6. Added `/admin/beta` activation dashboard.
7. Tracked signup, referral signup, onboarding completion, first trade, invite copy, and market share.
8. Verification: prisma generate, typecheck, lint, and build passed.

## Completed - FX-021 Beta Conversion and Market Sharing

1. Added first-trade guided path after onboarding.
2. Created `components/first-trade-coach.tsx`.
3. Updated onboarding completion to land on `/markets?coach=first-trade`.
4. Created `components/share-market-button.tsx`.
5. Added share/copy market links on market cards and market detail pages.
6. Verification: typecheck, lint, and build passed.

## Completed - FX-020 Beta Growth Loop

1. Added referral-code fields and self-referential inviter relation to `User`.
2. Added Prisma migration `20260708200000_fx020_beta_growth_loop`.
3. Created `lib/referrals.ts` for referral code generation, normalization, lookup, and backfill.
4. Updated signup to attribute `/signup?ref=CODE` signups to the referrer.
5. Updated account API with referral code, invite URL, referral count, and inviter display name.
6. Added copyable invite link panel to `/account`.
7. Added active invite-code display to `/signup`.
8. Added deterministic demo referral codes to seed users.
9. Added referral attribution coverage to `tests/auth-accounts.test.ts`.
10. Verification: prisma generate, typecheck, lint, and build passed. DB tests were blocked because Docker Desktop/Postgres was unavailable.

## Completed - FX-016.5 Bloomberg Terminal Rebrand

1. Created `lib/opening-price-model.ts`: logistic pricing model (projection→rank→probability, status multipliers, clamped [0.05,0.95]).
2. Rewrote `lib/nfl-data/demo-provider.ts`: 32 teams, 16 games, 105 players (20 QB / 30 RB / 40 WR / 15 TE).
3. Rewrote `prisma/seed.ts`: all 105 players, 16 games, 6 demo users, 42 diverse demo trades, model-based pricing.
4. Created `components/ui/terminal-panel.tsx`: Bloomberg-style primitives — TerminalPanel, TerminalHeader, TerminalDivider, PriceCell, ChangeCell, VolumeCell, QuoteRow, TapeRow, MarketHeatCell.
5. Created `components/ui/pixel-avatar.tsx`: 8-bit SVG pixel football avatars, position-specific stances (QB/RB/WR/TE), team-color uniforms, deterministic per playerId, no NFL IP.
6. Rewrote `components/ui/exchange-feed.tsx`: financial tape format (TIME · BUY/SELL · YES/NO · PLAYER · PRICE).
7. Created `app/markets/board/page.tsx`: Wall Street market board — 7 sort modes, position/threshold/status filters, live row flash, countdown strip, mobile-responsive.
8. Rewrote `app/page.tsx`: financial exchange dashboard — terminal status bar, most-active board, gainers/losers, locking-soon, live tape, leaderboard, account panel.
9. Updated `components/site-nav.tsx`: added Board nav link (Activity icon).
10. Updated `tests/nfl-data-engine.test.ts`: corrected team/player/game/slate counts for expanded universe.
11. Created `tests/opening-price-model.test.ts`: 15 tests — bounds, monotonicity, elite players, status penalties, pool derivation.
12. All checks: tsc clean · lint clean · 245/245 tests · build clean.

## Completed - FX-016 Live Exchange

1. Created `app/api/sse/route.ts`: SSE endpoint streaming `slate | feed | leaderboard | status | heartbeat` every 10s.
2. Created `app/api/exchange-feed/route.ts`: REST trade activity feed (actorName, action, side, player, threshold, price, time).
3. Created `app/api/exchange-status/route.ts`: exchange status (open/locked/settled market counts, total volume, active traders).
4. Created `lib/live-types.ts`: `FeedEvent`, `ExchangeStatus`, `LiveExchangeState` shared types.
5. Created `hooks/use-live-exchange.ts`: SSE hook with polling fallback; returns live markets/players/feed/leaderboard/status/isConnected.
6. Created `components/ui/countdown.tsx`: self-adjusting countdown timer (2h 18m → 4m 22s → LOCKED), crimson pulse when urgent.
7. Created `components/ui/price-flash.tsx`: green/red CSS flash animation on price value change.
8. Created `components/ui/live-badge.tsx`: pulsing LIVE / OFFLINE dot badge.
9. Created `components/ui/exchange-feed.tsx`: live trade activity feed with slide-in animation on new entries.
10. Created `components/ui/exchange-status.tsx`: header status bar (desktop) with live indicator, market counts, volume.
11. Updated `app/globals.css`: `animate-flash-up`, `animate-flash-down`, `animate-fade-in`, `animate-climb` keyframes.
12. Updated `app/layout.tsx`: `ExchangeStatusBar` in header.
13. Updated `app/markets/page.tsx`: live via `useLiveExchange` hook, `LiveBadge`.
14. Updated `app/markets/[marketId]/page.tsx`: `PriceFlash` on prices, `Countdown` on kickoff, `ExchangeFeed` recent trades, auto-refresh 12s.
15. Updated `app/page.tsx`: full live dashboard — `PriceFlash` on all cards, `ExchangeFeed` section, `Countdown` on locking-soon.
16. Updated `app/leaderboard/page.tsx`: live via hook, rank-climb detection + `animate-climb`, `LiveBadge`.
17. All checks: tsc clean · lint clean · 230/230 tests · build clean.

## Completed - FX-015 Exchange Experience

1. Design System V2: `panel3`, `steel`, `violet` colors; `glow-sm/lg/crimson/charge/depth/card` shadows; `fire/charge/depth/exchange-gradient` backgrounds; `ticker/ticker-fast/fade-up/fade-in/glow-pulse/float/scale-in/slide-up` animations.
2. New CSS utilities: `scrollbar-hide`, `text-gradient-neon/fire/charge`, `glow-neon/neon-sm/crimson/gold/ring`, `card-depth`, `animate-pop`, `badge-shine`, `market-card-hover`, `@keyframes ticker/glowBorder`.
3. Created `components/ui/exchange-ticker.tsx`: live scrolling price ticker with doubled-array seamless loop, pause-on-hover, aria region.
4. Updated `app/layout.tsx`: sticky ticker below header, `viewport` export for `themeColor` (Next.js 15 fix).
5. Rewrote `components/trade-panel.tsx`: dark theme, quick-amount buttons (25/50/100/250/500/MAX), animated success overlay, YES/NO glow toggles, metrics grid, sell shares mode.
6. Rewrote `app/players/[playerId]/page.tsx`: Bloomberg terminal feel — position color strip, projected pts callout, market rows with inline trade panel, intelligence/sentiment panels, historical table.
7. Rewrote `app/account/page.tsx`: profile hero with team-color avatar, balance/P&L tiles, achievements (6 computed badges with gold shimmer), stats grid, quick links.
8. Rewrote `app/page.tsx`: live exchange dashboard — hero, portfolio snapshot, trending markets grid, market movers, most traded, locking soon, top traders, how it works, guest CTA.
9. All checks: tsc clean · lint clean · 230/230 tests · build clean.

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
