# FX-015 Exchange Experience — Handoff

## Sprint Goal
Make every screen feel alive. The user should constantly feel: "I need to make a trade."

## Status: COMPLETE ✅

All checks green: typecheck · lint · 230/230 tests · production build.

---

## What Was Built

### Wave 1 — Design System V2
**`tailwind.config.ts`** — Extended token set:
- New colors: `panel3` (#243447), `steel` (#94A3B8), `violet` (#8B5CF6)
- New shadows: `glow-sm`, `glow-lg`, `glow-crimson`, `glow-charge`, `depth`, `card`
- New backgrounds: `fire-gradient`, `charge-gradient`, `depth-gradient`, `exchange-gradient`
- New animations: `ticker` (40s), `ticker-fast` (20s), `fade-up`, `fade-in`, `glow-pulse`, `float`, `scale-in`, `slide-up`

**`app/globals.css`** — New utility classes:
- `scrollbar-hide` for horizontal scroll areas
- `text-gradient-fire`, `text-gradient-charge`, `text-gradient-neon` — gradient text
- `glow-neon`, `glow-neon-sm`, `glow-crimson`, `glow-gold`, `glow-ring` — box-shadow utilities
- `card-depth` — layered shadow for panel depth
- `animate-pop` — bouncy scale keyframe
- `badge-shine` — achievement badge shimmer sweep
- `market-card-hover` — subtle lift + glow on market card hover
- `@keyframes ticker` — translateX 0 → -50% seamless loop
- `@keyframes glowBorder` — breathing border-color animation
- `.animate-ticker:hover { animation-play-state: paused }` — pause on hover

### Wave 2 — Exchange Ticker
**`components/ui/exchange-ticker.tsx`** — NEW
- Fetches open markets from `/api/slate`
- Doubles the array for seamless CSS infinite scroll
- Shows: player name · threshold label · YES price · 24h move %
- Pauses on hover via CSS `animation-play-state`
- `role="region" aria-label="Live market price ticker"` for accessibility

### Wave 3 — Layout Update
**`app/layout.tsx`** — UPDATED
- Fixed `themeColor` → moved to `viewport` export (Next.js 15 requirement)
- Sticky wrapper contains `<header>` + `<ExchangeTicker />` — ticker always visible as user scrolls

### Wave 4 — Trade Panel Redesign
**`components/trade-panel.tsx`** — FULL REWRITE (dark)
- **Quick-amount buttons**: 25 / 50 / 100 / 250 / 500 / MAX — tap to set, MAX uses floor(balance)
- **BUY/SELL toggle**: neon (BUY) / crimson (SELL) with `aria-pressed`
- **YES/NO toggle**: large tiles with live price, glow on active selection
- **Metrics grid**: Price · Est. shares · Avg entry · Balance after — all real-time from AMM
- **Position hint**: shows current YES/NO shares if position exists
- **Sell mode**: shares input with "All" quick button
- **Animated success state**: `animate-scale-in` + `animate-pop` CheckCircle with green glow
- **Input validation**: inline error banner with `role="alert"`
- **ARIA**: `aria-live`, `aria-pressed`, `aria-invalid`, screen-reader submit status
- Fully dark: `bg-panel`, `bg-panel2`, `bg-surface` — zero light tokens

### Wave 5 — Player Page Redesign
**`app/players/[playerId]/page.tsx`** — FULL REWRITE (dark)
- **Hero card**: position color strip, PlayerAvatar xl, injury status badge with icon, projected points callout
- **Quick stat strip**: Confidence · Projected Rank · Total Volume
- **Market rows**: YES/NO price badges, inline Trade toggle, link to market detail, pool/vol/OI footer
- **Inline trade panel**: expands below market rows with `animate-slide-up`
- **Intelligence panel**: dark `bg-panel2` rows for each metric, matchup notes block
- **Sentiment panel**: 2×2 stat grid + highest/lowest confidence market highlights
- **Historical performance table**: dark dividers, avg/best/worst summary row
- Fully dark: zero `bg-white` / `text-ink` / `bg-chalk` tokens

### Wave 6 — Account Page Redesign
**`app/account/page.tsx`** — FULL REWRITE (dark)
- **Profile hero**: gradient banner, initials avatar styled with favorite team colors, role badge, member since · trades · positions strip
- **Balance + P&L tiles**: 2-col grid, P&L tile glows neon (positive) or crimson (negative) with return %
- **Stats grid**: Win Rate · Open Positions · Total Trades · Role — each with icon and accent color
- **Achievement badges**: 6 computed achievements (First Trade / On Fire / In the Money / Sharp / Veteran / Whale) — earned badges get gold glow + `badge-shine` shimmer, unearned are dimmed
- **Quick links**: Portfolio · Leaderboard · Settings with chevron rows

### Wave 7 — Home Page Redesign
**`app/page.tsx`** — FULL REWRITE (live exchange dashboard)
- **Hero**: exchange-gradient background, live "Week 1 · No deposits" pill, headline with `text-gradient-neon`, dual CTA (Start Free / Browse Markets for guests, Trade Now for logged-in)
- **Portfolio Snapshot**: balance, open value, all-time P&L, open positions (logged-in only)
- **Trending Markets**: top 6 by volume, dark TradingCard grid with YES/NO prices + 24h move %
- **Market Movers**: Biggest Gainers (↑ neon) / Biggest Losers (↓ crimson) side-by-side
- **Most Traded**: ranked list #1–#4 with volume callout
- **Locking Soon**: markets within 6h of kickoff with amber border + countdown in minutes
- **Top Traders**: top 3 from leaderboard with medal emoji + all-time P&L (gold border for #1)
- **How It Works**: 3-step explainer with icon + colored border
- **CTA strip**: shown only to guests — "Create Free Account" with neon CTA

---

## Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | Extended Design System V2 tokens |
| `app/globals.css` | New utility classes + keyframes |
| `components/ui/exchange-ticker.tsx` | NEW — scrolling price ticker |
| `app/layout.tsx` | Sticky ticker, viewport fix |
| `components/trade-panel.tsx` | Full dark rewrite + quick-amount buttons |
| `app/players/[playerId]/page.tsx` | Full dark rewrite — Bloomberg terminal feel |
| `app/account/page.tsx` | Full dark rewrite — achievements + team colors |
| `app/page.tsx` | Full dark rewrite — live exchange dashboard |

---

## Hard Constraints Preserved
- No Solana. No crypto. No real money. No wagering.
- FantasyX remains completely free-play.
- No official NFL logos, team marks, or licensed player likenesses.
- `PlayerAvatar` uses initials/colors only; `headshotUrl` prop ready for licensed images later.

---

## Known Limitations
- `openingPrice` on Market type must be present for 24h move % calculations on home/ticker. If AMM seeding doesn't set it, move will always show 0%.
- Account `winRate` field is optional (`a.winRate ?? 0`) — the `/api/account` route may not return it yet; achievements depending on win rate will silently show as unearned.
- Home page "Locking Soon" uses `m.kickoffTime` from the slate; if the market type doesn't include `kickoffTime`, the section won't render (graceful — just hidden).
- Achievement system is client-side computed only — no DB persistence. A future sprint can add a `UserAchievement` table.

---

## Next Suggested Sprint: FX-016 Live Data & Concurrency Safety
- FX-008 Concurrency Safety (optimistic locking / idempotency hardening)
- WebSocket or SSE for live price updates on the exchange ticker
- `/api/account` extended to return `winRate`
- `openingPrice` verified to be set on all seeded markets
- Real NFL data integration (live scoring feeds)
