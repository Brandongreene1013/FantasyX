# FX023 Handoff - Week 1 Player Universe and Research-Based Opening Prices

## Status

FX023 is implemented and build-verified.

## Sprint Direction

Expand the Week 1 market universe and make opening prices more believable by adding current 2026 fantasy ADP/ranking context plus published Week 1 schedule context.

## What Changed

- Updated the seed Week 1 schedule to the current published 2026 Week 1 slate.
- Expanded the seed player universe from 105 players to 119 players.
- Added researched depth players across RB, WR, and TE.
- Corrected stale team/game context for several players.
- Added `PricingContext` to `calcOpeningYesPrice`.
- Added optional `adpRank` and `matchupAdjustment` pricing inputs.
- Updated seed pricing to pass ADP/matchup context into opening prices.
- Added pricing model tests for researched context.
- Added `FX023-PRICING-RESEARCH.md`.

## Added Players

- Ashton Jeanty
- Omarion Hampton
- Jeremiyah Love
- TreVeyon Henderson
- Bucky Irving
- Bhayshul Tuten
- Tetairoa McMillan
- Luther Burden III
- Ladd McConkey
- Emeka Egbuka
- Jameson Williams
- Colston Loveland
- Tyler Warren
- Brenton Strange

## Pricing Method

Opening prices now use:

```text
weekly projection + matchup adjustment
-> positional rank estimate
-> Top 3 / Top 5 / Top 10 probability
-> capped ADP confidence adjustment
-> status multiplier
-> YES opening price
```

ADP is deliberately capped so it nudges prices without overpowering weekly projection. Matchup adjustments are small because July Week 1 context is still early.

## Verification

Passed:

```powershell
npm run typecheck
npm run test -- tests/opening-price-model.test.ts
npm run lint
npm run build
```

Seed sanity check found no missing game references across 119 players.

## Research Sources

- FantasyPros 2026 NFL schedule pages.
- FantasyPros 2026 schedule-release fantasy takeaways.
- ESPN/Mike Clay 2026 fantasy rankings signal.
- RotoBaller 2026 PPR rankings.
- DIRECTV Insider 2026 overall ADP list.
- FFToday 2026 ADP value notes.

## Next Recommended Sprint

FX024 should focus on provider-ready projection ingestion:

- Add a projection source abstraction separate from NFL roster/schedule providers.
- Store projection metadata/source/date in a seedable or database-backed read model.
- Add admin projection import preview before market generation.
- Keep ADP as a fallback only.
- Preserve the free-play guardrail and avoid real-money/odds language.
