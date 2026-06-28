import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";

const MATERIAL_PRICE_DELTA = 0.005;
const DEFAULT_WEEK_ID = "nfl_2026_w1";

export type MarketHistoryPoint = {
  id: string;
  createdAt: string;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
  volume: number;
  openInterest: number;
};

export type MarketSentimentScore = {
  bullishScore: number;
  bearishScore: number;
  confidenceScore: number;
  recentPriceChange: number;
  label: "Bullish" | "Bearish" | "Neutral";
};

export type AnalyticsMarketCard = {
  marketId: string;
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  threshold: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  liquidity: number;
  priceChange: number;
  recentTradeCount: number;
  score: number;
};

export type BiggestMovers = {
  yesIncrease: AnalyticsMarketCard[];
  yesDecrease: AnalyticsMarketCard[];
  volumeIncrease: AnalyticsMarketCard[];
  liquidityIncrease: AnalyticsMarketCard[];
};

type MarketSnapshotInput = {
  marketId: string;
  yesPrice: number;
  noPrice?: number;
  yesPool: number;
  noPool: number;
  volume: number;
  openInterest: number;
  source?: string;
};

export async function recordMarketPriceSnapshot(
  tx: Prisma.TransactionClient,
  input: MarketSnapshotInput
) {
  const latest = await tx.marketPriceHistory.findFirst({
    where: { marketId: input.marketId },
    orderBy: { createdAt: "desc" }
  });

  const yesPrice = round6(input.yesPrice);
  const shouldCreate =
    !latest ||
    Math.abs(toNumber(latest.yesPrice) - yesPrice) >= MATERIAL_PRICE_DELTA;

  if (!shouldCreate) {
    return null;
  }

  return tx.marketPriceHistory.create({
    data: {
      marketId: input.marketId,
      yesPrice,
      noPrice: round6(input.noPrice ?? 1 - yesPrice),
      liquidity: round6(input.yesPool + input.noPool),
      volume: round2(input.volume),
      openInterest: round6(input.openInterest),
      source: input.source ?? "MARKET_EVENT"
    }
  });
}

export async function getMarketAnalytics(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      priceHistory: { orderBy: { createdAt: "asc" } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }
    }
  });

  if (!market) {
    return { history: [], sentiment: calculateMarketSentiment({ yesPrice: 0, noPrice: 1, volume: 0, openInterest: 0, recentPriceChange: 0 }) };
  }

  const history = buildMarketHistoryPoints({
    openingPrice: toNumber(market.openingPrice),
    currentYesPrice: toNumber(market.yesPrice),
    currentNoPrice: toNumber(market.noPrice),
    currentLiquidity: toNumber(market.yesPool) + toNumber(market.noPool),
    currentVolume: toNumber(market.volume),
    currentOpenInterest: toNumber(market.openInterest),
    createdAt: market.createdAt.toISOString(),
    updatedAt: market.updatedAt.toISOString(),
    snapshots: market.priceHistory.map((point) => ({
      id: point.id,
      createdAt: point.createdAt.toISOString(),
      yesPrice: toNumber(point.yesPrice),
      noPrice: toNumber(point.noPrice),
      liquidity: toNumber(point.liquidity),
      volume: toNumber(point.volume),
      openInterest: toNumber(point.openInterest)
    })),
    events: market.events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      priceAfter: event.priceAfter === null ? null : toNumber(event.priceAfter),
      liquidity: event.liquidity === null ? null : toNumber(event.liquidity),
      volume: event.volume === null ? null : toNumber(event.volume),
      openInterest: event.openInterest === null ? null : toNumber(event.openInterest)
    }))
  });

  const priceChange = history.length >= 2 ? history[history.length - 1].yesPrice - history[0].yesPrice : 0;
  return {
    history,
    sentiment: calculateMarketSentiment({
      yesPrice: toNumber(market.yesPrice),
      noPrice: toNumber(market.noPrice),
      volume: toNumber(market.volume),
      openInterest: toNumber(market.openInterest),
      recentPriceChange: priceChange
    })
  };
}

export function buildMarketHistoryPoints(input: {
  openingPrice: number;
  currentYesPrice: number;
  currentNoPrice: number;
  currentLiquidity: number;
  currentVolume: number;
  currentOpenInterest: number;
  createdAt: string;
  updatedAt: string;
  snapshots: MarketHistoryPoint[];
  events: Array<{
    id: string;
    createdAt: string;
    priceAfter: number | null;
    liquidity: number | null;
    volume: number | null;
    openInterest: number | null;
  }>;
}): MarketHistoryPoint[] {
  const points = new Map<string, MarketHistoryPoint>();
  const firstPoint: MarketHistoryPoint = {
    id: "opening",
    createdAt: input.createdAt,
    yesPrice: round6(input.openingPrice),
    noPrice: round6(1 - input.openingPrice),
    liquidity: round6(input.currentLiquidity),
    volume: 0,
    openInterest: 0
  };
  points.set(firstPoint.id, firstPoint);

  for (const snapshot of input.snapshots) {
    points.set(snapshot.id, snapshot);
  }

  if (input.snapshots.length === 0) {
    for (const event of input.events) {
      if (event.priceAfter === null) continue;
      points.set(event.id, {
        id: event.id,
        createdAt: event.createdAt,
        yesPrice: round6(event.priceAfter),
        noPrice: round6(1 - event.priceAfter),
        liquidity: round6(event.liquidity ?? input.currentLiquidity),
        volume: round2(event.volume ?? input.currentVolume),
        openInterest: round6(event.openInterest ?? input.currentOpenInterest)
      });
    }
  }

  points.set("current", {
    id: "current",
    createdAt: input.updatedAt,
    yesPrice: round6(input.currentYesPrice),
    noPrice: round6(input.currentNoPrice),
    liquidity: round6(input.currentLiquidity),
    volume: round2(input.currentVolume),
    openInterest: round6(input.currentOpenInterest)
  });

  return Array.from(points.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function calculateMarketSentiment(input: {
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  recentPriceChange: number;
}): MarketSentimentScore {
  const priceComponent = clamp(input.yesPrice * 70, 0, 70);
  const movementComponent = clamp(input.recentPriceChange * 250, -20, 20);
  const activityComponent = clamp(Math.log10(input.volume + input.openInterest + 1) * 8, 0, 18);
  const bullishScore = Math.round(clamp(priceComponent + movementComponent + activityComponent, 0, 100));
  const bearishScore = Math.round(clamp((input.noPrice * 70) - movementComponent + activityComponent, 0, 100));
  const confidenceScore = Math.round(clamp(Math.abs(input.yesPrice - 0.5) * 120 + activityComponent + Math.abs(input.recentPriceChange) * 100, 0, 100));
  const label = bullishScore > bearishScore + 8 ? "Bullish" : bearishScore > bullishScore + 8 ? "Bearish" : "Neutral";

  return {
    bullishScore,
    bearishScore,
    confidenceScore,
    recentPriceChange: round6(input.recentPriceChange),
    label
  };
}

export function rankTrendingMarkets(markets: AnalyticsMarketCard[]) {
  return [...markets]
    .map((market) => ({
      ...market,
      score: round2(
        Math.log10(market.volume + 1) * 20 +
        Math.abs(market.priceChange) * 150 +
        Math.log10(market.openInterest + 1) * 12 +
        market.recentTradeCount * 8
      )
    }))
    .sort((a, b) => b.score - a.score);
}

export function getBiggestMovers(markets: AnalyticsMarketCard[]): BiggestMovers {
  return {
    yesIncrease: [...markets].sort((a, b) => b.priceChange - a.priceChange).slice(0, 5),
    yesDecrease: [...markets].sort((a, b) => a.priceChange - b.priceChange).slice(0, 5),
    volumeIncrease: [...markets].sort((a, b) => b.volume - a.volume).slice(0, 5),
    liquidityIncrease: [...markets].sort((a, b) => b.liquidity - a.liquidity).slice(0, 5)
  };
}

export function calculatePortfolioAnalytics(input: {
  startingBalance: number;
  mockBalance: number;
  openValue: number;
  positions: Array<{ costBasis: number; currentValue: number; realizedPayout: number; pnl: number; status: string; averageEntry: number; playerName: string; thresholdType: string }>;
  trades: Array<{ id: string; marketId: string; playerName: string; spend: number; shares: number; priceAfter: number; createdAt: string }>;
}) {
  const equity = input.mockBalance + input.openValue;
  const openPositions = input.positions.filter((position) => position.status === "OPEN" || position.status === "LOCKED");
  const closedPositions = input.positions.filter((position) => position.status === "SETTLED" || position.status === "VOID");
  const unrealizedGainLoss = openPositions.reduce((total, position) => total + position.pnl, 0);
  const realizedGainLoss = closedPositions.reduce((total, position) => total + position.pnl, 0);
  const wins = closedPositions.filter((position) => position.pnl > 0).length;
  const largestPosition = [...input.positions].sort((a, b) => b.costBasis - a.costBasis)[0] ?? null;
  const bestTrade = [...input.trades].sort((a, b) => b.shares / Math.max(b.spend, 1) - a.shares / Math.max(a.spend, 1))[0] ?? null;
  const worstTrade = [...input.trades].sort((a, b) => a.shares / Math.max(a.spend, 1) - b.shares / Math.max(b.spend, 1))[0] ?? null;
  const totalCostBasis = input.positions.reduce((total, position) => total + position.costBasis, 0);
  const totalShares = input.trades.reduce((total, trade) => total + trade.shares, 0);

  return {
    currentPortfolioValue: round2(equity),
    weeklyPnl: round2(equity - input.startingBalance),
    allTimePnl: round2(equity - input.startingBalance),
    unrealizedGainLoss: round2(unrealizedGainLoss),
    realizedGainLoss: round2(realizedGainLoss),
    winRate: closedPositions.length > 0 ? round2(wins / closedPositions.length) : 0,
    averageEntry: totalShares > 0 ? round6(totalCostBasis / totalShares) : 0,
    largestPosition: largestPosition
      ? { playerName: largestPosition.playerName, thresholdType: largestPosition.thresholdType, costBasis: round2(largestPosition.costBasis) }
      : null,
    bestTrade: bestTrade
      ? { id: bestTrade.id, marketId: bestTrade.marketId, playerName: bestTrade.playerName, efficiency: round6(bestTrade.shares / Math.max(bestTrade.spend, 1)) }
      : null,
    worstTrade: worstTrade
      ? { id: worstTrade.id, marketId: worstTrade.marketId, playerName: worstTrade.playerName, efficiency: round6(worstTrade.shares / Math.max(worstTrade.spend, 1)) }
      : null
  };
}

export async function getDashboardAnalytics(weekId = DEFAULT_WEEK_ID) {
  const markets = await prisma.market.findMany({
    where: { weekId },
    include: {
      player: true,
      game: true,
      priceHistory: { orderBy: { createdAt: "asc" } },
      trades: {
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      },
      settlement: true
    }
  });

  const cards: AnalyticsMarketCard[] = markets.map((market) => {
    const player = serializePlayerFromMarket(market);
    const firstPoint = market.priceHistory[0];
    const priceChange = firstPoint ? toNumber(market.yesPrice) - toNumber(firstPoint.yesPrice) : toNumber(market.yesPrice) - toNumber(market.openingPrice);
    return {
      marketId: market.id,
      playerId: market.playerId,
      playerName: player?.name ?? market.player.name,
      team: market.player.team,
      position: market.position,
      threshold: market.thresholdType,
      yesPrice: toNumber(market.yesPrice),
      noPrice: toNumber(market.noPrice),
      volume: toNumber(market.volume),
      openInterest: toNumber(market.openInterest),
      liquidity: toNumber(market.yesPool) + toNumber(market.noPool),
      priceChange: round6(priceChange),
      recentTradeCount: market.trades.length,
      score: 0
    };
  });

  const trendingMarkets = rankTrendingMarkets(cards).slice(0, 6);
  const biggestMovers = getBiggestMovers(cards);
  const recentlySettled = markets
    .filter((market) => market.status === "SETTLED" && market.settlement)
    .sort((a, b) => (b.settlement?.settledAt.getTime() ?? 0) - (a.settlement?.settledAt.getTime() ?? 0))
    .slice(0, 5)
    .map((market) => ({ ...cards.find((card) => card.marketId === market.id)!, result: market.result }));
  const highestVolume = [...cards].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const highestOpenInterest = [...cards].sort((a, b) => b.openInterest - a.openInterest).slice(0, 5);
  const playerActivity = new Map<string, { playerId: string; playerName: string; team: string; volume: number; openInterest: number; markets: number }>();

  for (const card of cards) {
    const current = playerActivity.get(card.playerId) ?? { playerId: card.playerId, playerName: card.playerName, team: card.team, volume: 0, openInterest: 0, markets: 0 };
    current.volume += card.volume;
    current.openInterest += card.openInterest;
    current.markets += 1;
    playerActivity.set(card.playerId, current);
  }

  return {
    weekId,
    trendingMarkets,
    biggestMovers,
    recentlySettled,
    highestVolume,
    highestOpenInterest,
    mostActivePlayers: Array.from(playerActivity.values()).sort((a, b) => b.volume + b.openInterest - (a.volume + a.openInterest)).slice(0, 5)
  };
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
