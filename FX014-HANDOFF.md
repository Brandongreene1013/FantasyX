# FX-014 Handoff — Public Beta Mobile UX & Visual Identity

## Summary

FantasyX received a full dark-sports-trading visual design system and mobile-first app shell. Every major user-facing page was redesigned with thumb-friendly spacing, bottom tab navigation, and a Robinhood/Kalshi/Polymarket aesthetic. A WatchMarket backend, onboarding flow, and PlayerAvatar component architecture (ready for licensed headshots) were added.

---

## What was shipped

### Design system
- **`tailwind.config.ts`** — dark theme tokens: `surface`, `panel`, `panel2`, `rim`, `frost`, `muted`, `neon`, `charge`, `amber`, `crimson`, `qb/rb/wr/te` position colors; box shadow glows; hero/card/neon gradient presets; `pulse-slow` and `slide-up` animations
- **`app/globals.css`** — color-scheme dark, body background/text defaults, `.animate-shimmer`, `.market-card-hover`, `.text-gradient-neon/gold`, `.pb-safe`, dark scrollbar

### Utilities
- **`lib/team-colors.ts`** — `getTeamColors(team)` for all 32 NFL teams + FA; `getPositionColor(position)`; `ALL_TEAMS` export

### UI components (new)
- **`components/ui/player-avatar.tsx`** — `PlayerAvatar`: team-color gradient + initials + position badge; `headshotUrl` prop for future licensed images; sizes xs/sm/md/lg/xl
- **`components/ui/stat-pill.tsx`** — `StatPill` with tone variants
- **`components/ui/price-badge.tsx`** — YES (neon) / NO (crimson) with optional click handler
- **`components/ui/trend-badge.tsx`** — TrendingUp/Down icon + value
- **`components/ui/loading-skeleton.tsx`** — `Skeleton`, `MarketCardSkeleton`, `LoadingFeed`
- **`components/ui/empty-state.tsx`** — `EmptyState` + `ErrorState`

### Navigation shell
- **`components/bottom-nav.tsx`** — 5-tab mobile bottom nav (Home, Markets, Portfolio, Leaders, Account); neon active dot; safe-area padding
- **`components/site-nav.tsx`** — Full rewrite: desktop sidebar links + admin link; mobile defers to `<BottomNav>`
- **`components/account-bar.tsx`** — Redesigned: compact wallet + balance, P&L, admin badge
- **`app/layout.tsx`** — `dark` class on html, `themeColor #0D1117`, header glassmorphism, `pb-24 sm:pb-8` for bottom nav clearance

### Page redesigns
- **`app/page.tsx`** — Hero gradient, neon headline, How It Works cards, Trending/Movers/Locking-Soon sections
- **`app/markets/page.tsx`** — Search with clear button, position pill tabs, expandable filter panel, threshold tabs, watchlist star toggle with optimistic UI
- **`app/markets/[marketId]/page.tsx`** — Player hero card with team colors, large YES/NO price tiles with trend arrow, sentiment bars, mobile-first layout
- **`app/portfolio/page.tsx`** — Hero stats panel, analytics 4-card grid, equity curve chart, Open/Closed tabs, `PlayerAvatar` position cards
- **`app/leaderboard/page.tsx`** — Top-3 podium with visual bars, full table with rank icons, current user highlight
- **`app/login/page.tsx`** — Dark form: neon FX badge, glass card, neon CTA
- **`app/signup/page.tsx`** — Dark form: 2-col grid, redirects to `/onboarding` on success

### Watchlist backend
- **`prisma/schema.prisma`** — `WatchMarket` model; `favoriteTeam` + `onboardingDone` columns on `User`
- **`prisma/migrations/20260628270000_fx014_watchlist_onboarding/migration.sql`** — deployed ✅
- **`app/api/watchlist/route.ts`** — GET: returns `{ marketIds }` for current user
- **`app/api/watchlist/[marketId]/route.ts`** — POST: add/remove with `requireSessionUser` + `requireCsrf`

### Onboarding flow
- **`app/onboarding/page.tsx`** — 5-step flow: welcome → how it works → credits → team picker → done; progress bar; skip button; saves `favoriteTeam` + `onboardingDone`
- **`app/api/auth/onboarding/route.ts`** — POST: saves `favoriteTeam` + `onboardingDone` to user record

### Shared component updates
- **`components/market-card.tsx`** — Full rewrite: position strip, PlayerAvatar, team/opponent badges, hot/locking indicators, watchlist star, YES/NO price buttons, volume/pool/kickoff footer
- **`components/page-heading.tsx`** — Updated to use dark tokens (`neon` kicker, `frost` title)

---

## Design decisions

### No licensed player images (by design)
`headshotUrl?: string | null` is threaded through `PlayerAvatar`. When null, the component renders a team-color gradient with initials and a position badge. When a licensed source provides a URL (Sleeper Pro, SportsData.io, AWS CDN), pass it in and `<img>` renders automatically. No architecture change needed.

### Official marks policy
Zero official NFL logos, official team marks, or exact player likenesses. All visual identity uses:
- Team abbreviations (3 letters) in styled text
- Position colors as design language
- Custom gradients and initials

### Dark theme strategy
Existing admin pages and the old trade-panel/timeline components use `ink`/`chalk`/`field` tokens — those still work on a dark body because admin pages use explicit `bg-white` containers. New pages use `surface`/`panel`/`frost`/`neon` tokens exclusively.

### Free-play constraints
No Solana. No crypto. No real-money wagering. No deposits or withdrawals. FantasyX remains completely free-play.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings / errors |
| `npm test` | ✅ 230/230 pass |
| `npm run build` | ✅ builds clean |
| Migration deployed | ✅ `20260628270000_fx014_watchlist_onboarding` applied |

---

## Next ticket

**FX-015** — suggested: Account/Settings page dark redesign + favoriteTeam display; trade-panel mobile polish; notification/alert preferences.
