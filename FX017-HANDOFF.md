# FX017 Handoff - FantasyX OS

## Summary

FX017 turns FantasyX into an installable, mobile-first Live Sunday experience while keeping the product completely free-play. No Solana, crypto, deposits, withdrawals, custody, or real-money wagering were added.

## Completed

- Added PWA manifest at `public/manifest.json`.
- Added service worker at `public/sw.js`.
- Added cached offline shell at `public/offline.html`.
- Added app icon, maskable icon, and favicon SVG assets.
- Added `PwaShell` for service-worker registration, install prompt, offline banner, and browser notification permission prompt.
- Added `/live` Live Sunday command center.
- Added live games, market board, trading tape, portfolio, top gainers, top losers, leaderboard, player tracker, and Watchlist 2.0 sections.
- Reused existing SSE plus polling fallback via `useLiveExchange`.
- Added `/live` to desktop and mobile navigation.
- Protected `/live` through middleware.
- Added notification preferences to Settings using local browser preferences.
- Expanded the persistent exchange status bar with games-live estimate, volume today, and online-user placeholder.
- Added PWA/mobile polish for safe areas, standalone display mode, scroll behavior, and offline connection banner.

## PWA Architecture

- Manifest launch target is `/live`.
- Display mode is `standalone`.
- Theme color is FantasyX neon green.
- Service worker caches core app shell routes, icons, manifest, and offline HTML.
- Navigation requests fall back to cached pages or `offline.html`.
- API GET requests use network-first with cached fallback.
- Mutating requests are not cached.

## Live Sunday Mode

- `/live` is the command center during NFL games.
- It consumes the existing live exchange hook, which prefers SSE and falls back to polling.
- The page is intentionally dense and terminal-like for repeated scanning on mobile and desktop.
- Live game state is currently derived from market slate data until a real live game provider is connected.

## Notification Architecture

- Browser notification permission is requested from the PWA shell or Settings.
- User alert preferences are stored locally under `fantasyx:alert-preferences`.
- Current alerts are in-app/browser-permission scaffolding.
- Future push notifications should add a server-side subscription table and Web Push delivery service.

## Future Native Wrapper Strategy

- Keep the web app as the source of truth.
- Use PWA installability first.
- If native packaging is needed, wrap the same `/live`, `/markets`, `/portfolio`, and `/leaderboard` surfaces with Capacitor or a similar shell.
- Preserve mock-credit-only constraints in any wrapper.

## Verification

- `npm install` - passed; npm audit still reports 2 moderate findings
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm test` - passed, 253 tests across 16 files
- `npm run build` - passed; build output includes `/live`

## Remaining Work

- Real live NFL game-state provider for quarter, clock, possession, and score.
- True push notification subscriptions and server delivery.
- Persistent server-side notification preferences.
- Offline mutation queue is intentionally not implemented.
