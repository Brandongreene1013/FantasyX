export interface RawStats {
  passYards: number;
  passTDs: number;
  interceptions: number;
  rushYards: number;
  rushTDs: number;
  receptions: number;
  recYards: number;
  recTDs: number;
  fumbles: number;
  twoPointConv: number;
}

export interface ScoredPlayer {
  playerId: string;
  position: string;
  fantasyPoints: number;
  positionalRank: number;
  overallRank: number;
  stats: RawStats;
}

export function calculateHalfPpr(stats: RawStats): number {
  const pts =
    stats.passYards / 25 +
    stats.passTDs * 4 +
    stats.interceptions * -2 +
    stats.rushYards / 10 +
    stats.rushTDs * 6 +
    stats.receptions * 0.5 +
    stats.recYards / 10 +
    stats.recTDs * 6 +
    stats.fumbles * -2 +
    stats.twoPointConv * 2;

  return Math.round(pts * 100) / 100;
}

export interface PlayerInput {
  playerId: string;
  position: string;
  stats: RawStats;
}

export function rankPlayers(players: PlayerInput[]): ScoredPlayer[] {
  const scored = players.map((p) => ({
    playerId: p.playerId,
    position: p.position,
    fantasyPoints: calculateHalfPpr(p.stats),
    stats: p.stats
  }));

  const byPosition = new Map<string, typeof scored>();
  for (const s of scored) {
    if (!byPosition.has(s.position)) byPosition.set(s.position, []);
    byPosition.get(s.position)!.push(s);
  }

  // Dense rank within each position (ties share rank, next rank skips)
  const positionalRanks = new Map<string, number>();
  for (const [, group] of byPosition) {
    group.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
    let rank = 1;
    for (let i = 0; i < group.length; i++) {
      if (i > 0 && group[i].fantasyPoints < group[i - 1].fantasyPoints) {
        rank = i + 1;
      }
      positionalRanks.set(group[i].playerId, rank);
    }
  }

  // Overall rank across all positions
  scored.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
  const overallRanks = new Map<string, number>();
  let overallRank = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].fantasyPoints < scored[i - 1].fantasyPoints) {
      overallRank = i + 1;
    }
    overallRanks.set(scored[i].playerId, overallRank);
  }

  return scored.map((s) => ({
    ...s,
    positionalRank: positionalRanks.get(s.playerId) ?? 0,
    overallRank: overallRanks.get(s.playerId) ?? 0
  }));
}
