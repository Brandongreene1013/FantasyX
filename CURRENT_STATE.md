# FantasyX Current State

## Current Sprint

FX024.5 - Beta Launch Hardening (durable rate limiting, verify script, E2E smoke test).

## Product State

FantasyX is a free-play NFL prediction market with real user accounts, mock credits, protected sessions, trading, portfolio, leaderboard, admin market operations, settlement, live exchange updates, PWA installation, a Live Sunday command center, terminal-style market board, and now a Fantasy Intelligence layer.

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

## Production Readiness

The application remains architected for Vercel and PostgreSQL through Prisma. FX020 added beta referrals. FX021 added conversion/share surfaces. FX022 added a first-party beta event table and admin dashboard. FX023 updated seed/player/pricing logic. FX024.5 added durable rate limiting (set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel before launch), a verify pipeline, and an E2E smoke test; it does not change AMM math, settlement logic, or ledger semantics.

## Guardrails

FantasyX remains entirely free-play:

- No deposits
- No withdrawals
- No custody
- No crypto settlement
- No real-money wagering
- No production Solana execution

## Next Recommended Sprint

FX024 should focus on provider-ready projection ingestion:

- Projection source abstraction
- Projection metadata/source/date tracking
- Admin projection import preview before market generation
- ADP fallback only when projections are unavailable
- Remaining hardening afterward: structured observability/metrics, production load testing, CI pipeline
