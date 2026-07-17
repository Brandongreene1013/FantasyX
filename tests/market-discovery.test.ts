import { describe, expect, it } from "vitest";
import {
  marketDiscoveryQuerySchema,
  paginateDiscoveryMarkets,
  serializeDiscoveryMarket,
  sortDiscoveryMarkets,
  type DiscoveryMarketSource
} from "@/lib/market-discovery";

describe("market discovery", () => {
  it("validates query params and caps unsafe limits", () => {
    expect(marketDiscoveryQuerySchema.parse({ position: "QB", sort: "popular", limit: "50" })).toMatchObject({
      weekId: "nfl_2026_w1",
      position: "QB",
      sort: "popular",
      limit: 50,
      page: 1,
      watchlistOnly: false
    });

    expect(() => marketDiscoveryQuerySchema.parse({ position: "K" })).toThrow();
    expect(() => marketDiscoveryQuerySchema.parse({ sort: "random" })).toThrow();
    expect(() => marketDiscoveryQuerySchema.parse({ limit: "5000" })).toThrow();
  });

  it("serializes a market into the UI discovery shape", () => {
    const serialized = serializeDiscoveryMarket(sourceMarket({ id: "m1", name: "Ja'Marr Chase", team: "CIN", position: "WR", yesPrice: 0.62, openingPrice: 0.5 }));

    expect(serialized).toMatchObject({
      id: "m1",
      title: "Ja'Marr Chase Top 5 WR",
      marketType: "TOP_5",
      marketTypeLabel: "Top 5",
      status: "OPEN",
      price: 0.62,
      priceLabel: "$0.62",
      change: 0.12,
      isWatchlisted: false,
      player: {
        name: "Ja'Marr Chase",
        team: "CIN",
        position: "WR"
      }
    });
    expect(serialized.changePercent).toBeCloseTo(0.24);
    expect(serialized.liquidity).toBe(1000);
  });

  it("sorts by price, movement, popularity, and alphabetically", () => {
    const markets = [
      serializeDiscoveryMarket(sourceMarket({ id: "cheap", name: "B Player", yesPrice: 0.25, openingPrice: 0.3, volume: 10 })),
      serializeDiscoveryMarket(sourceMarket({ id: "expensive", name: "C Player", yesPrice: 0.8, openingPrice: 0.7, volume: 50 })),
      serializeDiscoveryMarket(sourceMarket({ id: "active", name: "A Player", yesPrice: 0.5, openingPrice: 0.25, volume: 1000 }))
    ];

    expect(sortDiscoveryMarkets(markets, "price-desc")[0].id).toBe("expensive");
    expect(sortDiscoveryMarkets(markets, "price-asc")[0].id).toBe("cheap");
    expect(sortDiscoveryMarkets(markets, "gainers")[0].id).toBe("active");
    expect(sortDiscoveryMarkets(markets, "losers")[0].id).toBe("cheap");
    expect(sortDiscoveryMarkets(markets, "popular")[0].id).toBe("active");
    expect(sortDiscoveryMarkets(markets, "alpha")[0].id).toBe("active");
  });

  it("paginates results with stable metadata", () => {
    const markets = ["one", "two", "three"].map((id) => serializeDiscoveryMarket(sourceMarket({ id })));
    const page = paginateDiscoveryMarkets(markets, { page: 1, limit: 2 });

    expect(page.markets.map((market) => market.id)).toEqual(["one", "two"]);
    expect(page.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      nextPage: 2
    });
  });

  it("marks markets as watchlisted when a user watch row is included", () => {
    const market = serializeDiscoveryMarket(sourceMarket({ watchedBy: [{ userId: "u1" }] }));

    expect(market.isWatchlisted).toBe(true);
    expect(market.watchCount).toBe(1);
  });
});

function sourceMarket(overrides: Partial<{
  id: string;
  name: string;
  team: string;
  position: "QB" | "RB" | "WR" | "TE";
  yesPrice: number;
  openingPrice: number;
  volume: number;
  watchedBy: Array<{ userId: string }>;
}> = {}): DiscoveryMarketSource {
  const position = overrides.position ?? "QB";
  const id = overrides.id ?? "m1";
  const yesPrice = overrides.yesPrice ?? 0.5;

  return {
    id,
    weekId: "nfl_2026_w1",
    playerId: `p_${id}`,
    position,
    thresholdType: "TOP_5",
    yesPrice,
    noPrice: 1 - yesPrice,
    openingPrice: overrides.openingPrice ?? yesPrice,
    yesPool: 500,
    noPool: 500,
    volume: overrides.volume ?? 0,
    openInterest: 10,
    status: "OPEN",
    result: null,
    kickoffTime: new Date("2026-09-10T17:00:00.000Z"),
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
    player: {
      id: `p_${id}`,
      name: overrides.name ?? "Test Player",
      team: overrides.team ?? "BUF",
      position
    },
    _count: {
      trades: 0,
      watchedBy: overrides.watchedBy?.length ?? 0
    },
    watchedBy: overrides.watchedBy ?? []
  };
}
