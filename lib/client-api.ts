import type { Market, Player, Side } from "@/lib/types";

export const defaultWeekId = "nfl_2026_w1";

export type SessionResponse = {
  user: {
    id: string;
    name: string;
    isAdmin: boolean;
    mockBalance: number;
    startingBalance: number;
  } | null;
};

export type SlateResponse = {
  weekId: string;
  players: Player[];
  markets: Array<Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number }>;
};

export type PortfolioResponse = {
  user: {
    id: string;
    name: string;
    mockBalance: number;
    startingBalance: number;
    isAdmin: boolean;
    equity: number;
    pnl: number;
  };
  positions: Array<{
    id: string;
    marketId: string;
    playerId: string;
    playerName: string;
    team: string;
    position: "QB" | "RB" | "WR" | "TE";
    thresholdType: "TOP_3" | "TOP_5" | "TOP_10";
    status: "OPEN" | "LOCKED" | "SETTLED" | "VOID";
    result: "YES" | "NO" | null;
    yesShares: number;
    noShares: number;
    costBasis: number;
    realizedPayout: number;
    averageEntry: number;
    entryPrice: number;
    currentPrice: number;
    currentValue: number;
    value: number;
    pnl: number;
    returnPct: number;
  }>;
  analytics: {
    currentPortfolioValue: number;
    weeklyPnl: number;
    allTimePnl: number;
    unrealizedGainLoss: number;
    realizedGainLoss: number;
    winRate: number;
    averageEntry: number;
    largestPosition: { playerName: string; thresholdType: string; costBasis: number } | null;
    bestTrade: { id: string; marketId: string; playerName: string; efficiency: number } | null;
    worstTrade: { id: string; marketId: string; playerName: string; efficiency: number } | null;
  };
  equityCurve: Array<{
    id: string;
    createdAt: string;
    balance: number;
    amount: number;
    type: string;
  }>;
  trades: Array<{
    id: string;
    marketId: string;
    playerName: string;
    side: Side;
    spend: number;
    shares: number;
    priceBefore: number;
    priceAfter: number;
    createdAt: string;
  }>;
};

export type TradeHistoryResponse = {
  trades: Array<{
    id: string;
    marketId: string;
    playerId: string;
    playerName: string;
    weekId: string;
    week: number;
    position: "QB" | "RB" | "WR" | "TE";
    thresholdType: "TOP_3" | "TOP_5" | "TOP_10";
    status: "OPEN" | "LOCKED" | "SETTLED" | "VOID";
    side: Side;
    executionPrice: number;
    marketPriceAfter: number;
    shares: number;
    cost: number;
    timestamp: string;
  }>;
};

export type MarketEventsResponse = {
  events: Array<{
    id: string;
    marketId: string;
    playerName: string;
    position: "QB" | "RB" | "WR" | "TE";
    thresholdType: "TOP_3" | "TOP_5" | "TOP_10";
    type: "TRADE" | "PRICE_CHANGE" | "LOCK" | "UNLOCK" | "SETTLE" | "VOID" | "ADMIN_NOTE";
    actorName: string | null;
    tradeId: string | null;
    settlementId: string | null;
    priceBefore: number | null;
    priceAfter: number | null;
    liquidity: number | null;
    volume: number | null;
    openInterest: number | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type PlayerDetailResponse = {
  player: {
    id: string;
    name: string;
    team: string;
    position: "QB" | "RB" | "WR" | "TE";
    opponent: string;
    kickoff: string;
  };
  markets: SlateResponse["markets"];
  sentiment: {
    avgYesPrice: number;
    totalVolume: number;
    totalOpenInterest: number;
    highestConfidenceMarket: { threshold: string; yesPrice: number };
    lowestConfidenceMarket: { threshold: string; yesPrice: number };
  } | null;
  intelligence: {
    projectedPoints: number;
    projectedRank: string;
    confidenceScore: number;
    injuryStatus: "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT";
    matchupNotes: string;
    historicalFinishes: Array<{ week: number; finish: number; points: number }>;
  };
};

export type MarketDetailResponse = {
  market: Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number };
  player: Player | null;
  history: MarketHistoryPoint[];
  sentiment: MarketSentimentResponse;
  events: MarketEventsResponse["events"];
};

export type MarketHistoryPoint = {
  id: string;
  createdAt: string;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
  volume: number;
  openInterest: number;
};

export type MarketSentimentResponse = {
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

export type DashboardAnalyticsResponse = {
  weekId: string;
  trendingMarkets: AnalyticsMarketCard[];
  biggestMovers: {
    yesIncrease: AnalyticsMarketCard[];
    yesDecrease: AnalyticsMarketCard[];
    volumeIncrease: AnalyticsMarketCard[];
    liquidityIncrease: AnalyticsMarketCard[];
  };
  recentlySettled: Array<AnalyticsMarketCard & { result: "YES" | "NO" | null }>;
  highestVolume: AnalyticsMarketCard[];
  highestOpenInterest: AnalyticsMarketCard[];
  mostActivePlayers: Array<{ playerId: string; playerName: string; team: string; volume: number; openInterest: number; markets: number }>;
};

export type NflSyncResponse = {
  result: {
    provider: string;
    season: number;
    week: number;
    weeks:   { created: number; updated: number };
    teams:   { total: number };
    players: { created: number; updated: number };
    games:   { created: number; updated: number };
    markets: { created: number; skipped: number };
  };
};

export type NflStatsResponse = {
  stats: {
    weeks: number;
    players: number;
    games: number;
    markets: number;
    playersByStatus: Record<string, number>;
    marketsByStatus: Record<string, number>;
  };
};

export type LeaderboardResponse = {
  weekId: string;
  entries: Array<{
    id: string;
    userId: string;
    name: string;
    weeklyPnl: number;
    totalPnl: number;
    balance: number;
    rank: number | null;
  }>;
};

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  return parseResponse<T>(response);
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(isErrorPayload(payload) ? payload.error : "Request failed");
  }
  return payload as T;
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string");
}
