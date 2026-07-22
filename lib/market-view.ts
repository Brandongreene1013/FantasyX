import type { Market, Player, Threshold } from "@/lib/types";

export type TradeAction = "BUY" | "SELL";
export type MarketSortKey =
  | "popular"
  | "gainers"
  | "losers"
  | "kickoff"
  | "yes-asc"
  | "yes-desc"
  | "liquidity"
  | "volume"
  | "team"
  | "alpha";
export type ExtendedMarket = Market & {
  weekId: string;
  kickoffTime: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  openInterest: number;
};
export type PlayerMarketRow = { player: Player; markets: ExtendedMarket[]; selectedMarket: ExtendedMarket };

export const THRESHOLD_ORDER: Threshold[] = ["TOP_3", "TOP_5", "TOP_10"];
