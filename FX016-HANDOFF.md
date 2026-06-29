# FX-016 Live Exchange — Handoff

## Sprint Goal
Make FantasyX feel like a living exchange. Users leave the app open and watch prices move, countdowns tick, trades appear, and leaderboards update — without ever refreshing.

## Status: COMPLETE ✅

tsc clean · lint clean · 230/230 tests · production build clean

---

## Architecture: SSE + Polling Fallback

### Real-time Strategy
**Primary**: Server-Sent Events (SSE) via `/api/sse`
**Fallback**: REST polling every 12 seconds (when SSE errors or unsupported)

```
Browser                          Server (Node.js)
  |                                    |
  |-- GET /api/sse?weekId=... -------->|
  |                                    | opens ReadableStream
  |<-- event: slate (initial) ---------|  immediately queries DB
  |<-- event: feed  (initial) ---------|
  |<-- event: leaderboard -------------|
  |<-- event: status ------------------|
  |<-- event: heartbeat (every 25s) ---|
  |                                    | setInterval 10s
  |<-- event: slate (updated) ---------|  re-queries DB
  |<-- event: feed  (updated) ---------|
  |     ... continues until abort ...  |
```

### Hook: `hooks/use-live-exchange.ts`
- Connects to SSE on mount
- Parses `slate | feed | leaderboard | status | heartbeat` events
- Falls back to 12s polling on SSE error
- Cleans up on unmount (no leaks)
- Returns `LiveExchangeState`:
  ```typescript
  { markets, players, feed, leaderboard, status, isConnected }
  ```

---

## What Was Built

### New API Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/sse` | GET | None | SSE stream — pushes all live data |
| `/api/exchange-feed` | GET | None | REST exchange activity feed |
| `/api/exchange-status` | GET | None | Exchange status (open/locked counts, volume, traders) |

### New Libraries

**`lib/live-types.ts`** — Shared TypeScript types:
- `FeedEvent` — actor, action (BUY/SELL), side (YES/NO), player, threshold, price
- `ExchangeStatus` — isLive, openMarkets, lockedMarkets, totalVolume, activeTraders
- `LiveExchangeState` — full hook return shape

**`hooks/use-live-exchange.ts`** — SSE client hook (see above)

### New UI Components

**`components/ui/countdown.tsx`**
- Live countdown timer that self-updates via `setTimeout` (no interval polling)
- Fast mode (1s ticks) when < 5 minutes to kickoff
- Shows: `2h 18m` / `18m` / `4m 22s` / `LOCKING` / `LOCKED`
- Urgent state (crimson + pulse animation) when < 5 minutes remain
- Used in: market cards, home "Locking Soon", market detail stats

**`components/ui/price-flash.tsx`**
- Wraps any price display with `animate-flash-up` (green) or `animate-flash-down` (red) CSS animation when value changes
- 800ms flash, then returns to transparent
- Used in: trending market cards, most-traded list, mover rows, market detail YES/NO tiles

**`components/ui/live-badge.tsx`**
- Pulsing green `LIVE` dot badge for connected state
- Grey `OFFLINE` when disconnected
- Used in: header, markets page, market detail, leaderboard

**`components/ui/exchange-feed.tsx`**
- Live trade activity feed
- Shows: actor initials avatar (position-colored) + actor name + action + side + player + threshold + price + time ago
- New entries animate in with `animate-fade-in` (slide down from above)
- Clickable to market detail
- Used in: home page "Exchange Feed" section, market detail "Recent Trades"

**`components/ui/exchange-status.tsx`**
- Header status strip (desktop only, hidden on mobile to save space)
- Shows: LIVE badge · open market count · locking count · total volume · week label
- Auto-refreshes every 30 seconds

### Updated CSS (`app/globals.css`)

```css
/* Price flash animations */
@keyframes flashUp   { 0% { background-color: rgba(0, 212, 106, 0.35); } 100% { transparent } }
@keyframes flashDown { 0% { background-color: rgba(220, 38, 38, 0.35); } 100% { transparent } }
.animate-flash-up   { animation: flashUp   0.8s ease-out; }
.animate-flash-down { animation: flashDown 0.8s ease-out; }

/* Feed entry slide-in */
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fadeSlideIn 0.35s ease-out both; }

/* Leaderboard rank climb */
@keyframes climbIn { 0% { opacity: 0; transform: translateX(-8px); } 100% { ... } }
.animate-climb { animation: climbIn 0.4s ease-out both; }
```

### Updated Pages

**`app/layout.tsx`**
- Added `<ExchangeStatusBar />` in the header between logo and nav (desktop)

**`app/markets/page.tsx`**
- Replaced manual `load()` polling with `useLiveExchange` hook
- Markets auto-update from SSE without any user interaction
- Shows `LiveBadge` in header and "live" subheading
- Portfolio + watchlist still loaded via REST (private data)

**`app/markets/[marketId]/page.tsx`**
- YES/NO price tiles wrapped in `<PriceFlash>` — flash green/red on price change
- Kickoff stat replaced with live `<Countdown>` component
- Live `<ExchangeFeed>` section for recent trades on this market
- `LiveBadge` in page header
- Auto-refreshes market + feed every 12 seconds

**`app/page.tsx`** (Home)
- Uses `useLiveExchange` for all market/feed/leaderboard data
- Trending market cards show `<PriceFlash>` on YES/NO prices
- "Exchange Feed" section shows last 8 trade events live
- "Locking Soon" cards show live `<Countdown>` timers
- "Most Traded" rows show `<PriceFlash>` on YES price
- Mover rows show `<PriceFlash>` on YES price
- `LiveBadge` in hero alongside free-play pill

**`app/leaderboard/page.tsx`**
- Uses `useLiveExchange` leaderboard data (auto-updates)
- Tracks previous ranks, detects climbers, plays `animate-climb` on rank improvement
- Shows `LiveBadge` in header

---

## Live Update Flow

When a trade is executed:
1. Trade writes to DB (`Trade` + `MarketEvent`)
2. Market prices update in DB (`yesPrice`, `noPrice`, `volume`)
3. SSE endpoint polls DB every 10s → detects change → pushes `slate` + `feed` events
4. All connected clients receive update within 10 seconds
5. Market cards flash green/red on price change
6. Exchange feed shows new trade entry (slides in from top)
7. Leaderboard updates on next 20s cycle

---

## Performance Notes

- SSE polling is every 10s per connection — not per user-action
- Vercel Hobby plan: SSE connections have a 30s max duration before being recycled (Vercel timeout for serverless). The client hook re-connects automatically on close.
- `useLiveExchange` only runs on client — no SSR cost
- `PriceFlash` uses CSS animations (no JS frame loop)
- `Countdown` uses `setTimeout` chain (not `setInterval`) to self-adjust tick rate

## Known Limitation
- Vercel Hobby serverless functions time out at 10-60 seconds, so SSE connections are recycled by the platform. The hook falls back to polling automatically on disconnect and reconnects. For persistent SSE, a paid plan or Edge Runtime with Durable Objects would be needed.

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/sse/route.ts` | NEW — SSE stream endpoint |
| `app/api/exchange-feed/route.ts` | NEW — exchange activity feed |
| `app/api/exchange-status/route.ts` | NEW — exchange status |
| `lib/live-types.ts` | NEW — shared live data types |
| `hooks/use-live-exchange.ts` | NEW — SSE hook with polling fallback |
| `components/ui/countdown.tsx` | NEW — live countdown timer |
| `components/ui/price-flash.tsx` | NEW — price change flash animation |
| `components/ui/live-badge.tsx` | NEW — LIVE/OFFLINE indicator |
| `components/ui/exchange-feed.tsx` | NEW — trade activity feed |
| `components/ui/exchange-status.tsx` | NEW — header status bar |
| `app/globals.css` | Added flash/fade-in/climb animations |
| `app/layout.tsx` | ExchangeStatusBar in header |
| `app/markets/page.tsx` | Live via SSE hook |
| `app/markets/[marketId]/page.tsx` | PriceFlash + Countdown + Feed |
| `app/page.tsx` | Full live dashboard via hook |
| `app/leaderboard/page.tsx` | Live leaderboard with climb animation |

---

## Next Sprint: FX-017 Suggestions
- FX-008 Concurrency Safety (optimistic locking audit)
- Extend `/api/account` to return `winRate` (fixes Sharp achievement)
- Verify `openingPrice` seeded correctly (fixes market movers always showing 0%)
- E2E smoke tests (login → trade → portfolio → settlement)
- Edge runtime SSE for persistent connections (avoid Vercel 30s timeout)
