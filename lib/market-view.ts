import type { Market, Player, Threshold } from "@/lib/types";

export type MarketView = "board" | "market";
export type TradeAction = "BUY" | "SELL";
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

export const MARKET_VIEW_STORAGE_KEY = "fantasyx:markets-view";
export const THRESHOLD_ORDER: Threshold[] = ["TOP_3", "TOP_5", "TOP_10"];

export function parseMarketView(value: string | null | undefined): MarketView | null {
  return value === "board" || value === "market" ? value : null;
}

export function resolveMarketView(queryValue: string | null | undefined, savedValue: string | null | undefined): MarketView {
  return parseMarketView(queryValue) ?? parseMarketView(savedValue) ?? "market";
}

export function marketsViewUrl(view: MarketView, currentSearch: string) {
  const params = new URLSearchParams(currentSearch);
  params.set("view", view);
  return `/markets?${params.toString()}`;
}
