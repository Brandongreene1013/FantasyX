import type { Market, Player, Side } from "@/lib/types";

export const defaultWeekId = "nfl_2026_w1";

export type SessionResponse = {
  user: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    displayName: string;
    email: string | null;
    role: "TRADER" | "ADMIN";
    isAdmin: boolean;
    mockBalance: number;
    startingBalance: number;
  } | null;
  csrfToken?: string | null;
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
    firstName: string;
    lastName: string;
    displayName: string;
    email: string | null;
    role: "TRADER" | "ADMIN";
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
    action: "BUY" | "SELL";
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
    action: "BUY" | "SELL";
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
  intelligence: FantasyMarketIntelligence | null;
  events: MarketEventsResponse["events"];
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

export type MarketScannerResponse = {
  weekId: string;
  generatedAt: string;
  markets: FantasyMarketIntelligence[];
  scanner: Record<
    "trending" | "breaking" | "mostActive" | "highestConviction" | "biggestMovers" | "sharpMoney" | "publicMoney" | "watchlistMovers" | "lockingSoon",
    FantasyMarketIntelligence[]
  >;
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

export type AdminMarketsResponse = {
  markets: Array<{
    id: string;
    weekId: string;
    season: number;
    week: number;
    playerId: string;
    playerName: string;
    playerTeam: string;
    playerStatus: string;
    position: "QB" | "RB" | "WR" | "TE";
    thresholdType: "TOP_3" | "TOP_5" | "TOP_10";
    status: string;
    result: "YES" | "NO" | null;
    yesPrice: number;
    noPrice: number;
    openingPrice: number;
    volume: number;
    openInterest: number;
    kickoffTime: string;
    tradeCount: number;
    positionCount: number;
    game: { homeTeam: string; awayTeam: string; kickoffTime: string } | null;
  }>;
};

export type AdminWeeksResponse = {
  weeks: Array<{
    id: string;
    season: number;
    week: number;
    startsAt: Date;
    endsAt: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    marketCount: number;
    playerCount: number;
    openMarkets: number;
    lockedMarkets: number;
    settledMarkets: number;
    draftMarkets: number;
  }>;
};

export type GenerateMarketsResponse = {
  result: {
    playersProcessed: number;
    marketsCreated: number;
    marketsSkipped: number;
    errors: Array<{ playerId: string; playerName: string; error: string }>;
  };
};

export type BulkActionResponse = {
  result: {
    affected: number;
    skipped: number;
    action: "OPEN" | "LOCK" | "VOID" | "ARCHIVE";
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
  const csrfToken = await getCsrfTokenForMutation(url);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const parsed = await parseResponse<T>(response);
  if (url === "/api/auth/login" || url === "/api/auth/signup" || url === "/api/auth/logout") {
    csrfTokenCache = null;
  }
  return parsed;
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const csrfToken = await getCsrfTokenForMutation(url);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

let csrfTokenCache: string | null = null;

async function getCsrfTokenForMutation(url: string) {
  if (url === "/api/auth/login" || url === "/api/auth/signup") {
    return null;
  }
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  const session = await apiGet<SessionResponse>("/api/session");
  csrfTokenCache = session.csrfToken ?? null;
  return csrfTokenCache;
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
