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
- FX-003 Service Layer Split is complete.
- FX-004 Market Experience is complete.
- FX-005 Player Intelligence is complete.
- FX-006 NFL Data Engine is complete.
- FX-007 Market Intelligence & Analytics is complete.
- Ledger entries are now the source of truth for mock-credit accounting.
- Market events are emitted through `lib/market-event.service.ts`.
- NFL data is synced through `lib/nfl-sync.service.ts` using the INflDataProvider adapter pattern.
- The server is the source of truth.
- API routes should stay thin.
- Business logic belongs in services.
- Every balance-changing operation must remain transaction-safe and ledgered.

Next ticket:

- FX-008 Concurrency Safety.

Hard constraints:

- No real-money wagering.
- No deposits.
- No withdrawals.
- No custody.
- No mainnet Solana.
- No production smart contracts.
