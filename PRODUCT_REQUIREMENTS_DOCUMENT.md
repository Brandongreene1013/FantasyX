# FantasyX Product Requirements Document

## Vision

FantasyX is a free-play fantasy football performance market where users trade mock-credit YES/NO shares on weekly player ranking outcomes.

The core product question is simple:

Will this player finish Top 3, Top 5, or Top 10 at his position this NFL week?

FantasyX is not a real-money wagering product in its current phase. It does not support deposits, withdrawals, custody, mainnet crypto settlement, or production gambling functionality.

## Core Product

Users create a free-play account, browse weekly NFL player markets, and buy YES or NO shares using mock credits.

Supported MVP markets:

- QB Top 3 / Top 5 / Top 10
- RB Top 3 / Top 5 / Top 10
- WR Top 3 / Top 5 / Top 10
- TE Top 3 / Top 5 / Top 10

Scoring format:

- Half-PPR fantasy scoring.

Primary user goals:

- Discover weekly player ranking markets.
- Buy YES/NO shares with mock credits.
- Track open positions and P&L.
- Compete on a weekly leaderboard.

Primary admin goals:

- Lock/open/void markets.
- Enter final positional ranks.
- Settle markets.
- Credit winning shares.
- Maintain auditability.

## Market Lifecycle

Market states:

- `OPEN`
- `LOCKED`
- `SETTLED`
- `VOID`

Lifecycle:

1. Market is created for a player, week, position, and threshold.
2. Market opens for mock-credit trading.
3. Market locks at kickoff or by admin action.
4. Market settles after final fantasy ranks are available.
5. Market result becomes YES or NO.
6. Winning shares are paid.
7. If a game is canceled/postponed or data is invalid, admin may void eligible markets.

Rules:

- Only `OPEN` markets can be traded.
- `LOCKED`, `SETTLED`, and `VOID` markets cannot be traded.
- `SETTLED` markets cannot be voided in the standard flow.
- `VOID` markets refund eligible cost basis once.
- Settlement must not double-pay.
- Void must not double-refund.

## Trading Lifecycle

1. User logs in through mock account selection.
2. User browses `/markets`.
3. User filters by position and threshold.
4. User opens trade modal by selecting Buy YES or Buy NO.
5. User enters mock-credit spend.
6. UI shows estimated shares, average price, price impact/slippage, and balance after trade.
7. User confirms.
8. API derives user from session cookie.
9. API validates:
   - authenticated session
   - positive spend
   - market exists
   - market is open
   - user has sufficient mock balance
10. AMM updates market pools and prices.
11. Trade, position, balance, and ledger records update atomically.
12. UI refreshes markets, account bar, and portfolio.

Rules:

- Client-submitted `userId` must never be trusted.
- Trade spend must be positive.
- User cannot spend more than available mock balance.
- Server is source of truth for price and execution.
- Future version should include server-validated slippage tolerance.

## Settlement Lifecycle

Settlement by player:

1. Admin selects NFL week.
2. Admin views all markets grouped by player.
3. Admin enters final half-PPR positional rank.
4. System settles all player markets:
   - Top 3 settles YES when rank <= 3.
   - Top 5 settles YES when rank <= 5.
   - Top 10 settles YES when rank <= 10.
   - Otherwise result is NO.
5. Winning shares are credited to users.
6. Leaderboard updates.
7. Audit event is recorded.

Settlement by market:

1. Admin selects a market.
2. Admin sets YES or NO.
3. System pays winning shares once.
4. Settlement record and audit event are created.

Void flow:

1. Admin selects eligible market.
2. Admin marks market VOID.
3. System refunds cost basis once.
4. Leaderboard updates.
5. Audit event is recorded.

Rules:

- Only admin/settlement operators can settle.
- Settlement must be idempotent.
- Void must be idempotent.
- Admin actions must be auditable.

## Portfolio Lifecycle

Portfolio shows the authenticated user's financial state in mock credits.

Portfolio data:

- Mock cash balance.
- Open positions.
- Entry price.
- Current price.
- Shares.
- Unrealized P&L.
- Realized payouts/refunds.
- Trade history.
- Future: ledger activity.

Lifecycle:

1. User buys shares.
2. Position is created or updated.
3. Open value changes as market prices move.
4. Portfolio marks open positions to current prices.
5. Settlement or void converts position value into realized payout/refund.
6. Activity history explains balance changes.

Rules:

- Portfolio must use authenticated session user.
- Users cannot view or trade as another user by changing request payload.
- Future history should reconcile directly with ledger entries.

## User Roles

### Guest

Capabilities:

- View home page.
- Create an account or log in.

Restrictions:

- Cannot trade.
- Cannot view protected portfolio.
- Cannot access admin tools.

### Demo Trader

Capabilities:

- View markets.
- Trade with mock credits.
- View own portfolio.
- View leaderboard.
- Logout.

Restrictions:

- Cannot settle, lock, open, or void markets.

### Admin

Capabilities:

- All trader capabilities.
- Access admin settlement page.
- Lock/open/void markets.
- Settle markets.
- Enter final ranks.

Restrictions:

- Admin actions must be audited.

### Future Roles

- Settlement Operator
- Auditor
- Support
- Analyst
- Super Admin

## Admin Workflows

### Manual Settlement

Admin enters final rank for a player and settles all associated threshold markets.

Requirements:

- Show player, team, position, thresholds, current market status, and current result.
- Validate rank is positive integer.
- Disable actions while mutation is pending.
- Prevent finalized markets from invalid actions.

### Lock/Open

Admin can lock markets before kickoff or reopen locked markets if appropriate.

Requirements:

- Cannot lock settled or void markets.
- Can only reopen locked markets.
- Must audit actions.

### Void

Admin can void canceled/postponed/invalid markets.

Requirements:

- Cannot void settled markets in standard flow.
- Cannot double-refund.
- Must audit action and optional reason.

### Future Rank Import

Admin imports fantasy scores/ranks and previews settlement before committing.

Requirements:

- Validate player mappings.
- Show settlement preview.
- Allow correction before commit.
- Audit import and settlement.

## Future Solana Integration

Solana support is future-only and must not introduce real-money behavior until separately approved.

Initial Solana goals:

- Wallet linking as identity only.
- Testnet-only prototypes.
- Optional wallet verification/signature challenge.
- No deposits.
- No withdrawals.
- No custody.
- No mainnet SOL.
- No production wagering.

Future architecture questions:

- What state belongs on-chain?
- What remains off-chain?
- How are market outcomes attested?
- How is settlement proven?
- How are mock credits represented, if at all?

Solana work must be gated by:

- Legal/compliance review.
- Security review.
- Product decision.
- Testnet architecture proposal.

## Accessibility Requirements

Target:

- WCAG 2.2 AA.

Requirements:

- Semantic landmarks: header, nav, main, footer.
- Skip-to-content link.
- Keyboard-accessible navigation and trading.
- Visible focus states.
- Accessible names for all interactive elements.
- Dialogs use `role="dialog"` and `aria-modal="true"`.
- Dialogs trap focus, close with Escape, and restore focus.
- Form labels and `aria-describedby` for helper/error text.
- Live regions for trade/admin success and errors.
- Color contrast meets WCAG AA.
- Axe tests cover major pages and trade modal.

Manual QA:

- Keyboard-only login, trade, portfolio, and admin flows.
- Screen reader smoke test for modal and forms.
- Mobile viewport checks.

## Performance Goals

MVP goals:

- Local page loads feel instant with seed data.
- API responses for seeded local data under 500ms.
- Production build passes.
- No blocking client-side localStorage state for core data.

Near-term goals:

- Paginate growing lists.
- Avoid full leaderboard recalculation for every settlement.
- Add query caching or structured client data fetching.
- Add background jobs for scheduled work.

Long-term goals:

- Handle many users trading the same market concurrently.
- Market prices update predictably across clients.
- Portfolio and leaderboard reads scale through read models or incremental aggregation.

## Security Goals

Current phase:

- Mock auth only.
- No secrets in repo.
- No real-money functionality.
- API derives user from session.
- Admin APIs require admin permission.

Near-term:

- Signed/server-side sessions.
- CSRF protection.
- Durable rate limiting.
- Admin audit trail.
- Typed safe error responses.
- Security headers.

Long-term:

- Wallet-linking security model.
- Key management policy.
- Compliance review before any real-money or mainnet work.

## Launch Requirements

Private/local MVP launch:

- Docker setup works.
- Seed data works.
- Login works.
- Markets load.
- Trades execute.
- Portfolio updates.
- Admin settlement works.
- Leaderboard updates.
- Tests pass.
- Accessibility checks pass.
- Handoff docs are current.

Internal beta launch:

- Prisma migrations.
- Ledger accounting.
- Signed sessions.
- CSRF protection.
- Admin audit log.
- E2E smoke tests.
- Concurrency safeguards.
- Kickoff locking.
- Multi-week support.

Public beta launch:

- Security review.
- Accessibility manual QA.
- Performance review.
- Data backup/recovery plan.
- Durable rate limiting.
- Observability.
- Terms and disclaimers.
- Legal/compliance review.

Solana/testnet launch:

- Separate approved Solana architecture.
- Wallet linking only.
- No deposits/withdrawals/mainnet.
- Security review of wallet flow.
