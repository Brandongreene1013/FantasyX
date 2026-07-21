# Changelog

## FX029 - API-Sports Beta Scoring

Added:

- API-Sports NFL adapter for teams, offensive rosters, schedules, live game state, and player game statistics.
- Provider-neutral player-stat normalization and automatic half-PPR calculation.
- Dedicated provisional `live_player_scores` storage with final-transition reconciliation.
- Beta fantasy-point updates in slate JSON, SSE, polling, and Live game market cards.

Guardrails:

- Provider keys remain server-side and API-Sports media fields are ignored.
- Beta scores remain provisional and do not directly settle markets or write account ledgers.
- Missing credentials fall back to demo mode instead of breaking public browsing.

## FX028 - Licensed Live Score Pipeline

Added:

- SportsDataIO live score, period, clock, possession, and game-state normalization.
- Persisted provider game state with source and last-successful-sync timestamps.
- Protected lightweight `/api/cron/sync-live` endpoint and manual admin live-score sync.
- Halftime, overtime-final, delayed, postponed, canceled, unknown, and stale-feed handling.
- Deep-health and admin visibility for live provider configuration and sync status.
- `LIVE_DATA.md` provider activation, operations, and legal-asset policy.

Changed:

- Live game summaries now prefer licensed provider state over kickoff-time inference.
- The scoreboard displays provider data when present and marks live updates delayed after 90 seconds.
- Full NFL sync persists live game fields without changing market settlement authority.

Guardrails:

- Live scores remain display-only and cannot settle markets or write account ledgers.
- No NFL, league, team, helmet, or uniform logos are ingested or displayed.
- Missing or unlicensed data remains unavailable rather than being fabricated.

## FX027 - Unified Markets, Complete Trading, and Live Scoreboard

Added:

- Board and Market presentation modes on the canonical `/markets` route, with URL override and saved local preference.
- Dense player comparison rows with Top 3, Top 5, and Top 10 quotes plus Buy, Sell, and watchlist actions.
- Game summaries in the slate and SSE payloads for honest LIVE, UPCOMING, and FINAL grouping.
- Stale-quote protection using bounded expected-price checks before trade execution.
- Direct Buy and Sell tickets from Portfolio and Live game markets.

Changed:

- Primary navigation is now Markets, Live, Portfolio, and Leaderboard; account and administrative actions remain utilities.
- `/markets/board` redirects to `/markets?view=board` to preserve old links without maintaining a duplicate page.
- Live now progressively reveals markets for a selected game and leaves unavailable score data blank instead of fabricating it.
- Successful trades trigger immediate shared-data refreshes for markets and portfolio overlays.
- Logged-out visitors can browse public exchange surfaces and are returned to their exact context after authentication.

Unchanged:

- Trade execution still uses the existing serializable transaction, AMM pricing, append-only ledger, idempotency, settlement, and authorization systems.
- FantasyX remains free-play with mock credits only.

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
