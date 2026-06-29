import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";

const DEFAULT_WEEK_ID = "nfl_2026_w1";

export type IntelligenceMarketInput = {
  id: string;
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  position: "QB" | "RB" | "WR" | "TE";
  threshold: "TOP_3" | "TOP_5" | "TOP_10";
  status: string;
  playerStatus: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  openInterest: number;
  liquidity: number;
  kickoffTime: string;
  recentTradeCount: number;
  watchCount: number;
};

export type FantasyMarketIntelligence = {
  marketId: string;
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  position: "QB" | "RB" | "WR" | "TE";
  threshold: "TOP_3" | "TOP_5" | "TOP_10";
  status: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  openInterest: number;
  liquidity: number;
  kickoffTime: string;
  priceChange: number;
  priceChangePct: number;
  recentTradeCount: number;
  watchCount: number;
  bullCase: string;
  bearCase: string;
  confidenceScore: number;
  trendScore: number;
  injuryImpact: "LOW" | "MEDIUM" | "HIGH";
  weatherImpact: "LOW" | "MEDIUM" | "HIGH";
  vegasLineMovement: "STEAMING_UP" | "STEAMING_DOWN" | "STABLE";
  matchupRating: number;
  opportunityRating: number;
  riskRating: number;
  sharpMoneyScore: number;
  publicMoneyScore: number;
  historicalSimilarGames: Array<{ label: string; outcome: string; hitRate: number }>;
  signals: string[];
};

export type MarketScannerSection =
  | "trending"
  | "breaking"
  | "mostActive"
  | "highestConviction"
  | "biggestMovers"
  | "sharpMoney"
  | "publicMoney"
  | "watchlistMovers"
  | "lockingSoon";

export type MarketScanner = Record<MarketScannerSection, FantasyMarketIntelligence[]>;

export type FantasyIntelligenceResponse = {
  weekId: string;
  generatedAt: string;
  markets: FantasyMarketIntelligence[];
  scanner: MarketScanner;
};

type MarketWithSignals = Prisma.MarketGetPayload<{
  include: {
    player: true;
    game: true;
    trades: true;
    watchedBy: true;
  };
}>;

export async function getFantasyIntelligence(weekId = DEFAULT_WEEK_ID): Promise<FantasyIntelligenceResponse> {
  const markets = await prisma.market.findMany({
    where: { weekId },
    include: {
      player: true,
      game: true,
      trades: {
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" }
      },
      watchedBy: true
    },
    orderBy: [{ position: "asc" }, { kickoffTime: "asc" }, { player: { name: "asc" } }]
  });

  const intelligence = markets.map((market) => buildMarketIntelligence(toMarketInput(market)));

  return {
    weekId,
    generatedAt: new Date().toISOString(),
    markets: intelligence,
    scanner: buildMarketScanner(intelligence)
  };
}

export async function getMarketIntelligence(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      player: true,
      game: true,
      trades: {
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" }
      },
      watchedBy: true
    }
  });

  return market ? buildMarketIntelligence(toMarketInput(market)) : null;
}

export function buildMarketScanner(markets: FantasyMarketIntelligence[]): MarketScanner {
  const byTrend = [...markets].sort((a, b) => b.trendScore - a.trendScore);
  const byActivity = [...markets].sort((a, b) => b.volume + b.openInterest + b.recentTradeCount * 50 - (a.volume + a.openInterest + a.recentTradeCount * 50));
  const byConviction = [...markets].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const byMove = [...markets].sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
  const bySharp = [...markets].sort((a, b) => b.sharpMoneyScore - a.sharpMoneyScore);
  const byPublic = [...markets].sort((a, b) => b.publicMoneyScore - a.publicMoneyScore);
  const byWatchlist = [...markets].sort((a, b) => b.watchCount + Math.abs(b.priceChange) * 100 - (a.watchCount + Math.abs(a.priceChange) * 100));
  const byKickoff = [...markets]
    .filter((market) => market.status === "OPEN" || market.status === "SCHEDULED")
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

  return {
    trending: byTrend.slice(0, 8),
    breaking: markets.filter(isBreakingSignal).sort((a, b) => b.trendScore - a.trendScore).slice(0, 8),
    mostActive: byActivity.slice(0, 8),
    highestConviction: byConviction.slice(0, 8),
    biggestMovers: byMove.slice(0, 8),
    sharpMoney: bySharp.slice(0, 8),
    publicMoney: byPublic.slice(0, 8),
    watchlistMovers: byWatchlist.slice(0, 8),
    lockingSoon: byKickoff.slice(0, 8)
  };
}

export function buildMarketIntelligence(input: IntelligenceMarketInput): FantasyMarketIntelligence {
  const priceChange = round6(input.yesPrice - input.openingPrice);
  const priceChangePct = input.openingPrice > 0 ? round6(priceChange / input.openingPrice) : 0;
  const activityScore = clamp(Math.log10(input.volume + input.openInterest + input.recentTradeCount * 25 + 1) * 18, 0, 45);
  const confidenceScore = Math.round(clamp(Math.abs(input.yesPrice - 0.5) * 105 + activityScore + Math.abs(priceChange) * 95, 0, 100));
  const trendScore = Math.round(clamp(activityScore + Math.abs(priceChange) * 180 + input.recentTradeCount * 6 + input.watchCount * 3, 0, 100));
  const injuryImpact = getInjuryImpact(input.playerStatus);
  const weatherImpact = getWeatherImpact(input);
  const matchupRating = stableRating(`${input.playerId}:matchup`, 42, 91);
  const opportunityRating = Math.round(clamp(input.yesPrice * 55 + activityScore + positionOpportunityBonus(input.position), 0, 100));
  const riskRating = Math.round(clamp((1 - confidenceScore / 100) * 48 + injuryRisk(injuryImpact) + weatherRisk(weatherImpact) + Math.abs(priceChangePct) * 18, 0, 100));
  const sharpMoneyScore = Math.round(clamp(confidenceScore * 0.48 + trendScore * 0.32 + Math.max(0, priceChange) * 80 - input.watchCount * 1.5, 0, 100));
  const publicMoneyScore = Math.round(clamp(Math.log10(input.volume + 1) * 22 + input.watchCount * 6 + input.yesPrice * 28, 0, 100));
  const vegasLineMovement = priceChange > 0.035 ? "STEAMING_UP" : priceChange < -0.035 ? "STEAMING_DOWN" : "STABLE";

  return {
    marketId: input.id,
    playerId: input.playerId,
    playerName: input.playerName,
    team: input.team,
    opponent: input.opponent,
    position: input.position,
    threshold: input.threshold,
    status: input.status,
    yesPrice: round6(input.yesPrice),
    noPrice: round6(input.noPrice),
    openingPrice: round6(input.openingPrice),
    volume: round2(input.volume),
    openInterest: round6(input.openInterest),
    liquidity: round6(input.liquidity),
    kickoffTime: input.kickoffTime,
    priceChange,
    priceChangePct,
    recentTradeCount: input.recentTradeCount,
    watchCount: input.watchCount,
    bullCase: buildBullCase(input, matchupRating, opportunityRating),
    bearCase: buildBearCase(input, injuryImpact, riskRating),
    confidenceScore,
    trendScore,
    injuryImpact,
    weatherImpact,
    vegasLineMovement,
    matchupRating,
    opportunityRating,
    riskRating,
    sharpMoneyScore,
    publicMoneyScore,
    historicalSimilarGames: buildHistoricalSimilarGames(input, matchupRating),
    signals: buildSignals(input, priceChange, trendScore, confidenceScore, injuryImpact, weatherImpact)
  };
}

function toMarketInput(market: MarketWithSignals): IntelligenceMarketInput {
  const serialized = serializeMarket(market);
  const player = serializePlayerFromMarket(market);

  return {
    id: market.id,
    playerId: market.playerId,
    playerName: market.player.name,
    team: market.player.team,
    opponent: player?.opponent ?? "TBD",
    position: market.position,
    threshold: market.thresholdType,
    status: market.status,
    playerStatus: market.player.status,
    yesPrice: serialized.yesPrice,
    noPrice: serialized.noPrice,
    openingPrice: serialized.openingPrice,
    volume: toNumber(market.volume),
    openInterest: toNumber(market.openInterest),
    liquidity: serialized.liquidity,
    kickoffTime: market.kickoffTime.toISOString(),
    recentTradeCount: market.trades.length,
    watchCount: market.watchedBy.length
  };
}

function isBreakingSignal(market: FantasyMarketIntelligence) {
  const kickoffMs = new Date(market.kickoffTime).getTime() - Date.now();
  const lockingSoon = kickoffMs > 0 && kickoffMs < 90 * 60 * 1000;
  return lockingSoon || Math.abs(market.priceChange) >= 0.06 || market.injuryImpact === "HIGH" || market.recentTradeCount >= 4;
}

function buildBullCase(input: IntelligenceMarketInput, matchupRating: number, opportunityRating: number) {
  if (input.yesPrice >= 0.62) {
    return `Market is pricing ${input.playerName} as a favorite with ${opportunityRating}/100 opportunity and a ${matchupRating}/100 matchup grade.`;
  }
  if (input.yesPrice >= input.openingPrice) {
    return `YES has firmed from the open, suggesting demand is building around ${input.playerName}'s ${input.threshold.replace("_", " ").toLowerCase()} path.`;
  }
  return `A lower entry price leaves room for a rebound if volume returns before kickoff.`;
}

function buildBearCase(input: IntelligenceMarketInput, injuryImpact: FantasyMarketIntelligence["injuryImpact"], riskRating: number) {
  if (injuryImpact !== "LOW") {
    return `${input.playerName}'s ${input.playerStatus.toLowerCase()} tag adds execution risk and keeps the risk rating at ${riskRating}/100.`;
  }
  if (input.yesPrice < input.openingPrice) {
    return `YES has faded from the open, so the market is demanding better evidence before chasing this threshold.`;
  }
  return `The main risk is crowding: strong YES pricing leaves less margin for a merely average Sunday.`;
}

function buildSignals(
  input: IntelligenceMarketInput,
  priceChange: number,
  trendScore: number,
  confidenceScore: number,
  injuryImpact: FantasyMarketIntelligence["injuryImpact"],
  weatherImpact: FantasyMarketIntelligence["weatherImpact"]
) {
  const signals: string[] = [];
  if (trendScore >= 70) signals.push("High velocity");
  if (confidenceScore >= 70) signals.push("High conviction");
  if (priceChange >= 0.04) signals.push("YES bid strengthening");
  if (priceChange <= -0.04) signals.push("YES pressure");
  if (input.recentTradeCount >= 4) signals.push("Tape active");
  if (input.watchCount >= 3) signals.push("Watchlist crowding");
  if (injuryImpact !== "LOW") signals.push(`${input.playerStatus} risk`);
  if (weatherImpact !== "LOW") signals.push(`${weatherImpact.toLowerCase()} weather`);
  return signals.length > 0 ? signals : ["Stable market"];
}

function buildHistoricalSimilarGames(input: IntelligenceMarketInput, matchupRating: number) {
  const base = stableRating(`${input.playerId}:history`, 38, 76);
  return [
    { label: `Similar ${input.position} usage spot`, outcome: input.threshold.replace("_", " "), hitRate: clamp(base + matchupRating * 0.08, 0, 100) },
    { label: `${input.team} vs comparable opponent`, outcome: "Median finish", hitRate: clamp(base - 5 + input.yesPrice * 12, 0, 100) },
    { label: "High-volume market analog", outcome: "Volatile finish", hitRate: clamp(base - 10 + Math.log10(input.volume + 1) * 4, 0, 100) }
  ].map((game) => ({ ...game, hitRate: Math.round(game.hitRate) }));
}

function getInjuryImpact(status: string): FantasyMarketIntelligence["injuryImpact"] {
  const normalized = status.toUpperCase();
  if (normalized === "OUT" || normalized === "DOUBTFUL") return "HIGH";
  if (normalized === "QUESTIONABLE") return "MEDIUM";
  return "LOW";
}

function getWeatherImpact(input: IntelligenceMarketInput): FantasyMarketIntelligence["weatherImpact"] {
  const seed = stableRating(`${input.team}:${input.opponent}:${input.kickoffTime}:weather`, 0, 99);
  if (input.position === "QB" || input.position === "WR") {
    if (seed > 82) return "HIGH";
    if (seed > 66) return "MEDIUM";
  }
  if (seed > 90) return "MEDIUM";
  return "LOW";
}

function positionOpportunityBonus(position: IntelligenceMarketInput["position"]) {
  return position === "RB" ? 10 : position === "WR" ? 8 : position === "QB" ? 7 : 5;
}

function injuryRisk(impact: FantasyMarketIntelligence["injuryImpact"]) {
  return impact === "HIGH" ? 38 : impact === "MEDIUM" ? 18 : 0;
}

function weatherRisk(impact: FantasyMarketIntelligence["weatherImpact"]) {
  return impact === "HIGH" ? 16 : impact === "MEDIUM" ? 8 : 0;
}

function stableRating(seed: string, min: number, max: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return Math.round(min + (hash / 100000) * (max - min));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
