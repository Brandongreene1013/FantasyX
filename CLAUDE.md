# Claude Code Handoff

Before coding, read:

- `HANDOFF.md`
- `ROADMAP.md`
- `TODO.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEVELOPMENT_STANDARDS.md`
- `ARCHITECTURE_REVIEW.md`

Continue the existing FantasyX codebase. Do not restart the project.

Current state:

- FX-001 Append-Only Ledger Foundation is complete.
- FX-002 Market Event Engine is complete.
- Ledger entries are now the source of truth for mock-credit accounting.
- Market events are emitted through `lib/market-event.service.ts`.
- The server is the source of truth.
- API routes should stay thin.
- Business logic belongs in services.
- Every balance-changing operation must remain transaction-safe and ledgered.

Next ticket:

- FX-003 Service Layer Split.

Hard constraints:

- No real-money wagering.
- No deposits.
- No withdrawals.
- No custody.
- No mainnet Solana.
- No production smart contracts.
