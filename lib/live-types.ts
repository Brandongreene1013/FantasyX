import type { SlateResponse, LeaderboardResponse } from "@/lib/client-api";

export type FeedEvent = {
  id: string;
  actorName: string;
  action: "BUY" | "SELL";
  side: "YES" | "NO";
  spend: number;
  playerName: string;
  position: "QB" | "RB" | "WR" | "TE";
  threshold: "TOP_3" | "TOP_5" | "TOP_10";
  marketId: string;
  priceAfter: number;
  createdAt: string;
};

export type ExchangeStatus = {
  weekId: string;
  weekLabel: string;
  isLive: boolean;
  openMarkets: number;
  lockedMarkets: number;
  settledMarkets: number;
  awaitingSettlement: number;
  totalVolume: number;
  activeTraders: number;
};

export type LiveExchangeState = {
  markets: SlateResponse["markets"];
  players: SlateResponse["players"];
  games: SlateResponse["games"];
  feed: FeedEvent[];
  leaderboard: LeaderboardResponse["entries"];
  status: ExchangeStatus | null;
  isConnected: boolean;
};
