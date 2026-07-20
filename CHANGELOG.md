# Changelog

## FX026 - Unified Player Markets and Trading Experience

Added:

- Canonical `/players/[playerId]?threshold=TOP_3|TOP_5|TOP_10` player market experience.
- Recharts-based selected-market YES share price chart using persisted market history.
- `components/player-market-chart.tsx`.
- `components/trade-launcher.tsx` for the shared dark trade ticket dialog.
- `tests/player-market-api.test.ts`.
- Trade-service price-history snapshot persistence after successful Buy/Sell transactions.

Changed:

- `GET /api/players/[playerId]` now returns account balance, all player submarkets, user positions, watch state, history, and activity in one payload.
- `components/trade-panel.tsx` now supports initial side, sell percentages, MAX sell, price impact, max loss, settlement value, and consistent submit labels.
- `/markets` now uses the shared trade launcher instead of the legacy buy-only modal.
- Portfolio rows route to canonical player-market pages for trading.
- Player links from market cards and market detail include the selected threshold query param.

Unchanged:

- No deposits, withdrawals, custody, real-money wagering, crypto settlement, Solana execution, AMM math, settlement semantics, ledger semantics, or Prisma schema changes.

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
