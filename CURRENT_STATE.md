# FantasyX Current State

## Current Sprint

FX023 - Week 1 Player Universe and Research-Based Opening Prices.

## Product State

FantasyX is a free-play NFL prediction market with real user accounts, mock credits, protected sessions, trading, portfolio, leaderboard, admin market operations, settlement, live exchange updates, PWA installation, a Live Sunday command center, terminal-style market board, and now a Fantasy Intelligence layer.

## Latest Additions

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

The application remains architected for Vercel and PostgreSQL through Prisma. FX020 added beta referrals. FX021 added conversion/share surfaces. FX022 added a first-party beta event table and admin dashboard. FX023 updates seed/player/pricing logic only and does not change trading, settlement, balances, or market state behavior.

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
- Continue beta launch hardening afterward: durable rate limiting, observability, verify script, and E2E smoke tests
