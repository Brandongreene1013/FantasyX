import type { Threshold } from "@/lib/types";

type MarketForSentiment = {
  threshold: Threshold;
  yesPrice: number;
  volume: number;
  openInterest: number;
};

export type PlayerSentiment = {
  avgYesPrice: number;
  totalVolume: number;
  totalOpenInterest: number;
  highestConfidenceMarket: { threshold: Threshold; yesPrice: number };
  lowestConfidenceMarket: { threshold: Threshold; yesPrice: number };
};

export type HistoricalFinish = {
  week: number;
  finish: number;
  points: number;
};

export type PlayerIntelligence = {
  projectedPoints: number;
  projectedRank: string;
  confidenceScore: number;
  injuryStatus: "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT";
  matchupNotes: string;
  historicalFinishes: HistoricalFinish[];
};

const PLAYER_DATA: Record<string, { projection: number; matchupRating: "Easy" | "Moderate" | "Tough" }> = {
  p_josh_allen: { projection: 24.2, matchupRating: "Moderate" },
  p_patrick_mahomes: { projection: 22.8, matchupRating: "Tough" },
  p_lamar_jackson: { projection: 23.5, matchupRating: "Easy" },
  p_saquon_barkley: { projection: 18.9, matchupRating: "Moderate" },
  p_bijan_robinson: { projection: 18.6, matchupRating: "Easy" },
  p_christian_mccaffrey: { projection: 19.4, matchupRating: "Moderate" },
  p_jamarr_chase: { projection: 18.2, matchupRating: "Tough" },
  p_justin_jefferson: { projection: 17.8, matchupRating: "Moderate" },
  p_cee_dee_lamb: { projection: 17.4, matchupRating: "Tough" },
  p_amon_ra_st_brown: { projection: 16.9, matchupRating: "Easy" },
  p_travis_kelce: { projection: 12.5, matchupRating: "Moderate" },
  p_sam_laporta: { projection: 11.9, matchupRating: "Easy" },
  p_trey_mcbride: { projection: 12.2, matchupRating: "Moderate" }
};

export function calcSentiment(markets: MarketForSentiment[]): PlayerSentiment | null {
  if (markets.length === 0) return null;

  const avgYesPrice = markets.reduce((s, m) => s + m.yesPrice, 0) / markets.length;
  const totalVolume = markets.reduce((s, m) => s + m.volume, 0);
  const totalOpenInterest = markets.reduce((s, m) => s + m.openInterest, 0);
  const sorted = [...markets].sort((a, b) => b.yesPrice - a.yesPrice);

  return {
    avgYesPrice,
    totalVolume,
    totalOpenInterest,
    highestConfidenceMarket: { threshold: sorted[0].threshold, yesPrice: sorted[0].yesPrice },
    lowestConfidenceMarket: { threshold: sorted[sorted.length - 1].threshold, yesPrice: sorted[sorted.length - 1].yesPrice }
  };
}

export function getPlaceholderHistory(playerId: string, projection: number): HistoricalFinish[] {
  const seed = playerId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return Array.from({ length: 5 }, (_, i) => {
    const swing = ((seed * (i + 3)) % 9) - 4;
    const finish = Math.max(1, Math.round(3 - swing / 3));
    const points = Math.max(4, Math.round((projection + swing * 1.2) * 10) / 10);
    return { week: 5 - i, finish, points };
  });
}

export function getIntelligence(
  playerId: string,
  position: string,
  opponent: string,
  markets: MarketForSentiment[]
): PlayerIntelligence {
  const data = PLAYER_DATA[playerId] ?? { projection: 15.0, matchupRating: "Moderate" as const };
  const projection = data.projection;
  const avgYes = markets.length > 0
    ? markets.reduce((s, m) => s + m.yesPrice, 0) / markets.length
    : 0.4;
  const confidenceScore = Math.min(99, Math.round(avgYes * 100));

  return {
    projectedPoints: projection,
    projectedRank: projectedRankLabel(projection, position),
    confidenceScore,
    injuryStatus: "ACTIVE",
    matchupNotes: `Facing ${opponent} — ${data.matchupRating.toLowerCase()} matchup for ${position}. Placeholder: real matchup data requires NFL stats integration.`,
    historicalFinishes: getPlaceholderHistory(playerId, projection)
  };
}

function projectedRankLabel(projection: number, position: string): string {
  if (position === "QB") {
    if (projection >= 23) return "Top 3 likely";
    if (projection >= 21) return "Top 5 likely";
    if (projection >= 18) return "Top 10 likely";
    return "Outside Top 10";
  }
  if (position === "TE") {
    if (projection >= 12) return "Top 3 likely";
    if (projection >= 10) return "Top 5 likely";
    return "Top 10 likely";
  }
  if (projection >= 19) return "Top 3 likely";
  if (projection >= 17) return "Top 5 likely";
  if (projection >= 14) return "Top 10 likely";
  return "Outside Top 10";
}
