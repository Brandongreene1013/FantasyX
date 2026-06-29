# Changelog

## FX019 - Fantasy Intelligence Terminal

Added:

- Fantasy Intelligence Engine for bull case, bear case, confidence, trend, matchup, opportunity, risk, sharp money, public money, injury, weather, Vegas movement, and historical similar-game signals.
- Protected `/api/intelligence` scanner endpoint.
- Market scanner sections: Trending, Breaking, Most Active, Highest Conviction, Biggest Movers, Sharp Money, Public Money, Watchlist Movers, and Locking Soon.
- Fantasy Intelligence panel on market detail pages.
- Market scanner panels on `/live` and `/markets/board`.
- Scanner row motion with reduced-motion support.
- `tests/fantasy-intelligence.test.ts` coverage for scoring, scanner ranking, auth, and API response.

Changed:

- `GET /api/markets/[marketId]` now includes an `intelligence` object in its response.
- `tests/market-board-routing.test.ts` now uses an isolated fixture season to avoid local database unique-key collisions.

Unchanged:

- No real-money, crypto, Solana, custody, deposit, withdrawal, settlement, ledger, trade execution, AMM, or NFL sync mechanics were changed.
