# FX019 Handoff - Fantasy Intelligence Terminal

## Status

FX019 is implemented and ready for verification/deployment after the standard command suite stays green.

## What Changed

- Added a Fantasy Intelligence Engine in `lib/fantasy-intelligence.service.ts`.
- Added protected `GET /api/intelligence` for week-level scanner data.
- Extended `GET /api/markets/[marketId]` with single-market intelligence.
- Added `MarketScanner` for terminal-style scanner sections across live and board views.
- Added `FantasyIntelligencePanel` for market detail bull/bear/risk/opportunity context.
- Added scanner pulse animation with reduced-motion support.

## Intelligence Model

The intelligence layer is a read model. It does not mutate markets, trades, balances, settlement, ledger rows, AMM state, wallet logic, or NFL sync.

Inputs:

- YES/NO price
- Opening price movement
- Volume
- Open interest
- Recent trade count
- Watchlist count
- Player status
- Kickoff time
- Deterministic matchup/weather/context seeds

Outputs:

- Bull Case
- Bear Case
- Confidence Score
- Trend Score
- Historical Similar Games
- Injury Impact
- Weather Impact
- Vegas Line Movement proxy
- Matchup Rating
- Opportunity Rating
- Risk Rating
- Sharp Money Score
- Public Money Score

## Scanner Sections

- Trending
- Breaking
- Most Active
- Highest Conviction
- Biggest Movers
- Sharp Money
- Public Money
- Watchlist Movers
- Locking Soon

## UI Integration

- `/live` now opens with a market scanner and intelligence tape before the existing Live Sunday command center panels.
- `/markets/board` now includes a compact scanner above the full terminal board.
- `/markets/[marketId]` now displays a Fantasy Intelligence panel below market sentiment and before trading.

## Tests Added

- `tests/fantasy-intelligence.test.ts`
  - Pure market intelligence scoring
  - Scanner ranking
  - API authentication requirement
  - Protected API scanner response

## Notes

- No Prisma migration was required.
- No new gameplay, real-money, Solana, crypto, custody, deposit, or withdrawal logic was added.
- Future provider integrations can replace deterministic injury/weather/Vegas/context proxies without changing the UI contract.
