# FantasyX Current State

## Current Sprint

FX027 - Unified Markets, Complete Trading, and Live Scoreboard.

## Product State

FantasyX is a free-play NFL prediction market with real user accounts, mock credits, protected sessions, trading, portfolio, leaderboard, admin market operations, settlement, live exchange updates, PWA installation, a unified Markets experience, an honest game scoreboard, and a Fantasy Intelligence layer.

## Latest Additions

- Durable Upstash-backed route-level rate limiting with in-memory local fallback.
- Rate limits on trades (30/min per user), login/signup (10/min per IP), and beta events (60/min per user) returning 429 with `x-ratelimit-*` headers.
- Single `npm run verify` pipeline (lint, typecheck, tests, build) with an actionable Postgres preflight.
- E2E golden-path smoke test (`npm run test:e2e`): signup, onboarding, first trade, admin settlement payout.
- Referral-code growth loop for beta launch.
- `/signup?ref=CODE` attribution.
- Copyable invite links on `/account`.
- Account API referral count and inviter metadata.
- First-trade guide after onboarding.
- Shareable market links on market cards and market detail pages.
- First-party beta event tracking.
- `/admin/beta` activation dashboard.
- Server-side tracking for signup, referral signup, onboarding completion, and first trade.
- Client-side tracking for invite copies and market shares.
- Updated published 2026 Week 1 seed schedule.
- Expanded seed player universe from 105 to 119 players.
- Added ADP/rank and matchup context to opening price calculation.
- Added pricing research note.
- Deterministic demo referral codes in seed data.
- Fantasy Intelligence Engine from FX019 remains active across `/live`, `/markets/board`, and `/markets/[marketId]`.
- `/players/[playerId]?threshold=TOP_5` is now the canonical individual player market page with URL-synced Top 3, Top 5, and Top 10 submarkets.
- Player-market payloads now include account balance, authenticated positions, watch state, persisted price history, and market activity in one API response.
- Successful trades now persist material `MarketPriceHistory` snapshots inside the existing serializable trade transaction.
- `/markets` uses the shared dark trade ticket launcher instead of the older buy-only modal.
- `/markets` now owns both dense Board and visual Market modes over one live dataset, filter set, watchlist, and trade engine.
- `/markets/board` is a compatibility redirect to `/markets?view=board`.
- Buy and Sell tickets are available from Markets, Live, Portfolio, player pages, and market details.
- Trade requests include expected-price bounds and reject stale quotes before changing balances or positions.
- Live groups linked games into LIVE, UPCOMING, and FINAL and never invents scores, clocks, or possession.
- Primary navigation is Markets, Live, Portfolio, and Leaderboard, with public browsing preserved for guests.

## Production Readiness

The application remains architected for Vercel and PostgreSQL through Prisma. FX020 added beta referrals. FX021 added conversion/share surfaces. FX022 added a first-party beta event table and admin dashboard. FX023 updated seed/player/pricing logic. FX024.5 added durable rate limiting (set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel before launch), a verify pipeline, and an E2E smoke test. FX026 added selected-player market UX and durable price-history writes. FX027 unifies market presentation and live game discovery while retaining the existing transaction, ledger, pricing, settlement, and authentication architecture.

## Guardrails

FantasyX remains entirely free-play:

- No deposits
- No withdrawals
- No custody
- No crypto settlement
- No real-money wagering
- No production Solana execution

## Next Recommended Sprint

Finish the remaining FX027 integration verification with a running local database and a real score provider:

- Browser-verified buy, partial sell, MAX sell, refresh, and mobile checks.
- Playwright coverage for player-market threshold persistence and trading.
- Retire legacy `TradeModal` after all remaining surfaces are confirmed on the shared ticket.
- Map official team logo assets and provider-backed score, clock, period, possession, delayed, and overtime fields into `LiveGameSummary`.
