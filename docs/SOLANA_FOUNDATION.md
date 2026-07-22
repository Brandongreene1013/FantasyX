# FantasyX Solana Foundation

FantasyX remains a free-play mock-credit product after this sprint. The current Prisma ledger, trade, position, and settlement tables are still the source of truth for balances.

## Boundary

- Off-chain simulated trades mutate `User.mockBalance`, `Trade`, `Position`, and `AccountLedgerEntry`.
- Wallet verification proves that a user controls a Solana public key.
- Devnet memo transactions are test records only.
- No production balance, deposit, withdrawal, market escrow, or settlement flow reads from or writes to Solana in this sprint.
- Solana mainnet is blocked unless a future explicit production control enables it.

## Workspace

- `Anchor.toml` configures localnet/devnet program entries.
- `programs/fantasyx_market` contains the initial Anchor program.
- `packages/solana-config` owns cluster and program configuration.
- `packages/blockchain-domain` owns app-level transaction modes and lifecycle types.
- `packages/solana-client` owns RPC, browser wallet, and signature verification helpers.

## Environment

```bash
SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_FANTASYX_MARKET_PROGRAM_ID=Fx11111111111111111111111111111111111111111
SOLANA_ALLOW_MAINNET_TRANSACTIONS=false
```

## Operational Notes

- Run `npm run solana:local-validator` for a local validator when the Solana CLI is installed.
- Run `npm run solana:build` when Anchor is installed.
- Wallet verification challenges expire after five minutes.
- Blockchain transaction records are intentionally separate from `account_ledger_entries`.
- Reconciliation jobs should compare future on-chain state to FantasyX records before any financial action is released.

## Security Roadmap

1. Replace placeholder program id with the deployed devnet program id.
2. Add PDA derivation tests for market accounts.
3. Add escrow vault accounts and collateral mint allowlists.
4. Add admin multisig or governance-controlled settlement authority.
5. Add withdrawal queues, fraud monitoring, and reconciliation reports.
6. Add mainnet release gates, incident runbooks, and independent program audit.
