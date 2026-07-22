# FantasyX Protocol Sprint 2 Design

## 1. Current Architecture Summary

FantasyX is a single-root Next.js application with npm workspaces for the new Solana packages. The deployed web app uses Vercel and Neon PostgreSQL. The application already has authenticated sessions, CSRF protection, Prisma transactions, append-only mock-credit ledger rows, market/trade/position/settlement services, and devnet-only wallet verification.

The current git worktree is dirty from the previous Solana foundation sprint. Those changes have been deployed to production, but they are not committed locally.

## 2. Current On-Chain Program Summary

`programs/fantasyx_market` is an Anchor scaffold only. It has:

- Program id placeholder: `Fx11111111111111111111111111111111111111111`
- `initialize_market`
- `mark_escrow_ready`
- One `FantasyXMarket` account
- No SPL token escrow
- No protocol config PDA
- No quote authorization
- No replay protection
- No claims, refunds, settlement, fee accounting, or invariant tests

No IDL is present. No localnet or devnet deployment script is present.

## 3. Current Off-Chain Financial-System Summary

The current financial system is intentionally off-chain and mock-credit only. `User.mockBalance` is changed by `applyLedgerBalanceChange`, which appends immutable `AccountLedgerEntry` records. Trades are executed by `executeDbBuy` and `executeDbSell` inside serializable Prisma transactions. Settlement pays mock-credit winnings from existing `Position` rows.

This sprint must not replace or mutate that ledger with devnet token activity.

## 4. Existing Authority Model

Application authority is role based: `User.role === ADMIN` or `isAdmin`. Cron endpoints require `CRON_SECRET`. Wallet verification requires an authenticated session and CSRF token. On-chain authority currently only checks the market authority for `mark_escrow_ready`.

## 5. Existing Market Lifecycle

Off-chain markets move through `DRAFT`, `SCHEDULED`, `OPEN`, `LOCKED`, `SETTLED`, and `VOID`. Locking can be performed by admin routes or by the protected kickoff-lock cron. Settlement is admin-controlled and pays mock-credit ledger entries.

## 6. Existing Wallet and Transaction Flow

Users connect an injected Solana wallet, request a five-minute challenge, sign it, and submit the signature. The backend verifies the signature and stores `BlockchainWallet`. A devnet memo can be sent and recorded in `BlockchainTransaction`. No on-chain program interaction exists yet.

## 7. Proposed Economic Model

Conservative devnet assumption: one collateral token unit pays one winning share unit. A designated development liquidity provider deposits collateral into the market escrow before trading. Buyers pay a quote-authorized cost into escrow and receive YES or NO shares. Sellers burn/reduce shares and receive quote-authorized proceeds from escrow.

Pricing is off-chain for this sprint, but every quote is enforced on-chain by a required quote-authority signer, quote expiration, quote replay PDA, user wallet, market id, side, action, and slippage fields.

## 8. Proposed Collateral and Solvency Model

The program tracks YES and NO liabilities separately. Since the market is binary and mutually exclusive, required backing is:

```text
required_backing = max(yes_liability, no_liability) + accrued_fees
```

Every collateral-affecting instruction must enforce:

```text
escrow_amount >= required_backing
```

Buy cost increases escrow. Buy shares increase one side's liability. Sell proceeds reduce escrow and reduce liability. Claim payout reduces escrow and the winning side's liability. Refund payout reduces escrow and both user liabilities according to cancelled position shares.

## 9. Proposed Account Model

- `ProtocolConfig` PDA: protocol authority, quote authority, settlement authority, collateral mint, fee bps, paused flag.
- `MarketAccount` PDA: market id, creator, LP, collateral mint, escrow token account, lock timestamp, status, liabilities, fees, result.
- `PositionAccount` PDA: owner, market, YES shares, NO shares, claimed flag.
- `UsedQuote` PDA: market, user, quote id, action, created timestamp.
- Escrow token account: SPL token account owned by the market PDA.

## 10. Proposed Instruction Set

- `initialize_protocol`
- `set_pause`
- `register_market`
- `collateralize_market`
- `buy_position`
- `sell_position`
- `lock_market`
- `propose_result`
- `finalize_result`
- `cancel_market`
- `claim_winnings`
- `claim_refund`

## 11. Proposed State Machines

Market states:

```text
Registered -> Collateralized -> Trading -> Locked -> ResultProposed -> Resolved
                                             |              |
                                             |              -> Cancelled
                                             -> Cancelled
```

Position states are implicit:

```text
Open -> PartiallySold -> Closed
Open -> Claimed
Open -> Refunded
```

## 12. Proposed Quote Authorization Model

For Sprint 2, the quote authority is a required signer on buy and sell instructions. This is intentionally centralized but reviewable and avoids unsafe in-program Ed25519 instruction parsing. The quote payload includes quote id, action, side, share quantity, max buy cost or minimum sell proceeds, expiration timestamp, and user wallet. A `UsedQuote` PDA prevents replay.

Future hardening can replace signer co-authorization with Ed25519 sysvar verification or durable quote accounts.

## 13. Proposed Settlement Model

The settlement authority proposes a result after lock. Finalization is a separate instruction so indexers, admins, and tests can observe the pending result. During this devnet sprint the same settlement authority may finalize, but the separation is kept for future timelocks, multisig, or challenge windows.

Cancelled markets allow users to claim refunds based on remaining YES and NO shares.

## 14. Proposed Reconciliation Model

Every on-chain transition emits an Anchor event. The app stores indexed events and updates `BlockchainTransaction` records by signature. A reconciliation report compares:

- On-chain market status vs database status
- On-chain liabilities vs indexed position totals
- On-chain escrow amount vs required backing
- Claimed/refunded positions vs app records
- Confirmed signatures vs recorded lifecycle state

No reconciliation result mutates the mock-credit ledger.

## 15. Threat Model

- Quote replay: prevented by `UsedQuote` PDA.
- Stale quote: prevented by `expires_at`.
- Wrong market/user/side/action: enforced by account constraints and quote fields.
- Insolvent market: prevented by liability and escrow invariant checks.
- Unauthorized settlement: settlement authority signer required.
- Unauthorized pause or config changes: protocol authority signer required.
- Double claim/refund: position `claimed` flag and share zeroing.
- Trading after lock: lock timestamp and status checks.
- Wrong collateral mint: config and account mint checks.
- Client/server manipulation: program validates state, signers, accounts, and arithmetic.

## 16. Security Assumptions

- Devnet collateral has no real value.
- Quote authority is trusted for devnet quote calculation.
- Settlement authority is trusted for devnet result proposal/finalization.
- SPL token program is trusted.
- The program is not production-ready until independently audited and deployed with non-placeholder authorities.

## 17. Known Centralization Points

- Development liquidity provider.
- Quote authority.
- Settlement authority.
- Protocol pause authority.
- Off-chain indexer/reconciliation service.

These are acceptable for devnet only and must be revisited before mainnet.

## 18. Files Expected to Change

- `programs/fantasyx_market/src/lib.rs`
- `programs/fantasyx_market/Cargo.toml`
- `Anchor.toml`
- `packages/blockchain-domain/src/index.ts`
- `packages/solana-client/src/*`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `lib/blockchain-*.ts`
- `app/api/blockchain/*`
- `tests/solana/*`
- `docs/*`

## 19. Migrations Expected

Add app-side index tables for on-chain markets, positions, events, quote intents, and reconciliation runs. These records are separate from `Trade`, `Position`, `Settlement`, and `AccountLedgerEntry`.

## 20. Implementation Phases

1. Replace the scaffold Anchor program with protocol config, market, position, quote replay, escrow, settlement, claim, and event logic.
2. Add TypeScript domain types and deterministic invariant tests.
3. Add Prisma index/reconciliation models.
4. Add route/service skeletons for quote intent and reconciliation.
5. Verify with typecheck, lint, Prisma validation, and focused tests.
6. Verify Anchor build/local-validator/devnet lifecycle once Rust, Solana CLI, and Anchor CLI are available.

## 21. Blocking Ambiguities

- The pasted sprint brief truncates immediately after listing YES/NO outcomes, so fees, exact pricing curve, LP risk policy, collateral mint decimals, settlement delay, quote custody flow, and devnet deployment wallet are unspecified.
- Conservative devnet defaults used here: zero fee by default, quote-authority co-signer, one collateral unit per winning share unit, single dev LP, no production funds, no mainnet.
- Local machine blocker: Rust, Cargo, Solana CLI, and Anchor CLI are not installed. Docker is available, but an Anchor image pull/build is large and still requires deployment key material for devnet.
