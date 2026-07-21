export type Position = "QB" | "RB" | "WR" | "TE";
export type Threshold = "TOP_3" | "TOP_5" | "TOP_10";
export type MarketStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "LOCKED" | "SETTLED" | "VOID";
export type SettlementResult = "YES" | "NO" | null;
export type Side = "YES" | "NO";

export type Player = {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: Position;
  kickoff: string;
  projection: number;
};

export type Market = {
  id: string;
  gameId?: string | null;
  playerId: string;
  week: number;
  position: Position;
  threshold: Threshold;
  yesPool: number;
  noPool: number;
  liquidity: number;
  openingPrice?: number;
  volume?: number;
  openInterest?: number;
  status: MarketStatus;
  result: SettlementResult;
};

export type PositionLot = {
  marketId: string;
  yesShares: number;
  noShares: number;
  costBasis: number;
  realizedPayout?: number;
};

export type Account = {
  id: string;
  name: string;
  balance: number;
  startingBalance: number;
};

export type Trade = {
  id: string;
  marketId: string;
  side: Side;
  spend: number;
  shares: number;
  priceBefore: number;
  priceAfter: number;
  createdAt: string;
};

export type LeaderboardRow = {
  id: string;
  name: string;
  pnl: number;
  balance: number;
};
