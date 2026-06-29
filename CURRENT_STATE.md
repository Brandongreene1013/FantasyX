# FantasyX Current State

## Current Sprint

FX019 - Fantasy Intelligence Terminal.

## Product State

FantasyX is a free-play NFL prediction market with real user accounts, mock credits, protected sessions, trading, portfolio, leaderboard, admin market operations, settlement, live exchange updates, PWA installation, a Live Sunday command center, terminal-style market board, and now a Fantasy Intelligence layer.

## Latest Additions

- Fantasy Intelligence Engine.
- Week-level Market Scanner.
- Market-level bull/bear cases.
- Confidence, trend, matchup, opportunity, risk, sharp money, and public money scores.
- Injury, weather, and Vegas line movement proxy impacts.
- Historical similar-game readouts.
- Intelligence surfaces on `/live`, `/markets/board`, and `/markets/[marketId]`.

## Production Readiness

The application remains architected for Vercel and PostgreSQL through Prisma. The FX019 changes are read-only additions to the market intelligence surface and do not require a schema migration.

## Guardrails

FantasyX remains entirely free-play:

- No deposits
- No withdrawals
- No custody
- No crypto settlement
- No real-money wagering
- No production Solana execution

## Next Recommended Sprint

FX020 should focus on provider-backed live intelligence:

- Real weather provider
- Real injury feed
- Real Vegas line movement provider
- Real historical fantasy comp dataset
- E2E Sunday smoke tests for live command center, scanner, board, trade, and portfolio flows
