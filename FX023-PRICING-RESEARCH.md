# FX023 Pricing Research - 2026 Week 1

Last updated: 2026-07-08

## Goal

Make FantasyX Week 1 opening prices feel grounded in current 2026 fantasy sentiment while keeping the product free-play and demo-seeded.

## Sources Used

- FantasyPros 2026 NFL schedule pages for Week 1 slate context.
- FantasyPros 2026 schedule-release fantasy takeaways for the unusual Week 1 opener structure.
- ESPN / Mike Clay 2026 fantasy rankings signal for quarterback hierarchy.
- RotoBaller 2026 PPR rankings for overall player tiering.
- DIRECTV Insider 2026 overall ADP list for current top-of-board market sentiment.
- FFToday 2026 ADP value notes for player/team context on Ashton Jeanty.

## Pricing Method

Opening YES prices remain projection-based, but FX023 adds two researched context inputs:

1. `adpRank`
   - Represents market-wide season-long fantasy confidence.
   - Helps prevent high-ADP players from opening too cheaply when their single-week projection is close to a lower-tier player.
   - Effect is intentionally capped so ADP nudges price but does not overwhelm weekly projection.

2. `matchupAdjustment`
   - Small point adjustment to the weekly projection before rank-to-probability conversion.
   - Used for obvious Week 1 matchup context, tough defensive spots, or favorable game environments.
   - Kept small because July matchup data is not precise enough for aggressive pricing.

The pricing flow is:

```text
weekly projection + matchup adjustment
-> estimated positional rank
-> threshold probability for Top 3 / Top 5 / Top 10
-> capped ADP confidence adjustment
-> status multiplier
-> opening YES price
```

## Week 1 Schedule Context

The seed now uses the current published 2026 Week 1 structure:

- Patriots at Seahawks
- 49ers at Rams
- Bears at Panthers
- Buccaneers at Bengals
- Saints at Lions
- Bills at Texans
- Ravens at Colts
- Browns at Jaguars
- Falcons at Steelers
- Jets at Titans
- Cardinals at Chargers
- Dolphins at Raiders
- Packers at Vikings
- Commanders at Eagles
- Cowboys at Giants
- Broncos at Chiefs

## Seed Expansion

FX023 expands the demo market universe from 105 players to 119 players.

Added researched depth:

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

## Pricing Notes

- Top ADP players receive small positive confidence nudges: Jahmyr Gibbs, Bijan Robinson, Puka Nacua, Jaxon Smith-Njigba, Ja'Marr Chase, Christian McCaffrey, Amon-Ra St. Brown, Jonathan Taylor, CeeDee Lamb, Ashton Jeanty, Justin Jefferson, and James Cook.
- Tough Week 1 spots apply small negative adjustments only, such as Colts skill players versus Baltimore and Rams/49ers players in a potentially difficult opener.
- Team/context corrections were made for several stale seed entries, including A.J. Brown, Derrick Henry, Kenneth Walker, and George Pickens.

## Guardrails

- These are not betting odds.
- These are free-play opening prices for a mock-credit fantasy prediction market.
- Real provider projections should replace seed projections later.
- ADP is season-long sentiment, not a direct single-week probability.
- Injury/news updates closer to kickoff should override this seed research.
