import { z } from "zod";
import { money, thresholdLabel } from "@/lib/format";
import { toNumber } from "@/lib/db-serialization";

export const discoveryPositions = ["QB", "RB", "WR", "TE"] as const;
export const discoveryMarketTypes = ["TOP_3", "TOP_5", "TOP_10"] as const;
export const discoveryStatuses = ["DRAFT", "SCHEDULED", "OPEN", "LOCKED", "SETTLED", "VOID"] as const;
export const discoverySorts = [
  "popular",
  "price-desc",
  "price-asc",
  "gainers",
  "losers",
  "updated",
  "alpha"
] as const;

export type DiscoveryPosition = typeof discoveryPositions[number];
export type DiscoveryMarketType = typeof discoveryMarketTypes[number];
export type DiscoveryStatus = typeof discoveryStatuses[number];
export type DiscoverySort = typeof discoverySorts[number];

export const marketDiscoveryQuerySchema = z.object({
  weekId: z.string().min(1).default("nfl_2026_w1"),
  q: z.string().trim().max(80).default(""),
  position: z.enum(discoveryPositions).optional(),
  team: z.string().trim().max(8).optional(),
  marketType: z.enum(discoveryMarketTypes).optional(),
  status: z.enum(discoveryStatuses).optional(),
  sort: z.enum(discoverySorts).default("popular"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).max(100).default(1),
  watchlistOnly: z.coerce.boolean().default(false)
});

export type MarketDiscoveryQuery = z.infer<typeof marketDiscoveryQuerySchema>;

export type DiscoveryMarketSource = {
  id: string;
  weekId: string;
  playerId: string;
  position: DiscoveryPosition;
  thresholdType: DiscoveryMarketType;
  yesPrice: unknown;
  noPrice: unknown;
  openingPrice: unknown;
  yesPool: unknown;
  noPool: unknown;
  volume: unknown;
  openInterest: unknown;
  status: DiscoveryStatus;
  result: "YES" | "NO" | null;
  kickoffTime: Date;
  updatedAt: Date;
  player: {
    id: string;
    name: string;
    team: string;
    position: DiscoveryPosition;
  };
  _count?: {
    trades?: number;
    watchedBy?: number;
  };
  watchedBy?: Array<{ userId: string }>;
};

export type DiscoveryMarket = {
  id: string;
  title: string;
  weekId: string;
  playerId: string;
  marketType: DiscoveryMarketType;
  marketTypeLabel: string;
  status: DiscoveryStatus;
  result: "YES" | "NO" | null;
  price: number;
  priceLabel: string;
  noPrice: number;
  noPriceLabel: string;
  openingPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  liquidity: number;
  openInterest: number;
  tradeCount: number;
  watchCount: number;
  popularityScore: number;
  updatedAt: string;
  kickoffTime: string;
  isWatchlisted: boolean;
  player: {
    id: string;
    name: string;
    team: string;
    position: DiscoveryPosition;
  };
};

export function serializeDiscoveryMarket(market: DiscoveryMarketSource): DiscoveryMarket {
  const price = toNumber(market.yesPrice);
  const noPrice = toNumber(market.noPrice);
  const openingPrice = toNumber(market.openingPrice ?? market.yesPrice);
  const volume = toNumber(market.volume ?? 0);
  const liquidity = toNumber(market.yesPool) + toNumber(market.noPool);
  const openInterest = toNumber(market.openInterest ?? 0);
  const tradeCount = market._count?.trades ?? 0;
  const watchCount = market._count?.watchedBy ?? 0;
  const change = price - openingPrice;

  return {
    id: market.id,
    title: `${market.player.name} ${thresholdLabel(market.thresholdType)} ${market.player.position}`,
    weekId: market.weekId,
    playerId: market.playerId,
    marketType: market.thresholdType,
    marketTypeLabel: thresholdLabel(market.thresholdType),
    status: market.status,
    result: market.result,
    price,
    priceLabel: money(price),
    noPrice,
    noPriceLabel: money(noPrice),
    openingPrice,
    change,
    changePercent: openingPrice > 0 ? change / openingPrice : 0,
    volume,
    liquidity,
    openInterest,
    tradeCount,
    watchCount,
    popularityScore: volume + openInterest * 10 + tradeCount * 50 + watchCount * 25 + liquidity * 0.01,
    updatedAt: market.updatedAt.toISOString(),
    kickoffTime: market.kickoffTime.toISOString(),
    isWatchlisted: Boolean(market.watchedBy?.length),
    player: {
      id: market.player.id,
      name: market.player.name,
      team: market.player.team,
      position: market.player.position
    }
  };
}

export function sortDiscoveryMarkets(markets: DiscoveryMarket[], sort: DiscoverySort) {
  const sorted = [...markets];

  sorted.sort((a, b) => {
    switch (sort) {
      case "price-desc":
        return b.price - a.price || byPlayer(a, b);
      case "price-asc":
        return a.price - b.price || byPlayer(a, b);
      case "gainers":
        return b.changePercent - a.changePercent || b.change - a.change || byPlayer(a, b);
      case "losers":
        return a.changePercent - b.changePercent || a.change - b.change || byPlayer(a, b);
      case "updated":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || byPlayer(a, b);
      case "alpha":
        return byPlayer(a, b);
      case "popular":
      default:
        return b.popularityScore - a.popularityScore || b.price - a.price || byPlayer(a, b);
    }
  });

  return sorted;
}

export function paginateDiscoveryMarkets(markets: DiscoveryMarket[], query: Pick<MarketDiscoveryQuery, "limit" | "page">) {
  const start = (query.page - 1) * query.limit;
  const end = start + query.limit;
  return {
    markets: markets.slice(start, end),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: markets.length,
      nextPage: end < markets.length ? query.page + 1 : null
    }
  };
}

function byPlayer(a: DiscoveryMarket, b: DiscoveryMarket) {
  return a.player.name.localeCompare(b.player.name) || a.marketType.localeCompare(b.marketType);
}
