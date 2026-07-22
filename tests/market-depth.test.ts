import { describe, expect, it } from "vitest";
import { buildMarketDepth } from "@/lib/market-depth";
import type { Market } from "@/lib/types";

describe("AMM market depth", () => {
  it("builds ordered executable bids and asks around the midpoint", () => {
    const depth = buildMarketDepth(market(), "YES");

    expect(depth.asks).toHaveLength(5);
    expect(depth.bids).toHaveLength(5);
    expect(depth.bids[0].price).toBeLessThan(depth.midpoint);
    expect(depth.asks[0].price).toBeGreaterThan(depth.midpoint);
    expect(depth.spread).toBeGreaterThan(0);
    expect([...depth.asks, ...depth.bids].every((level) => level.price >= 0.01 && level.price <= 0.99)).toBe(true);
    expect(depth.asks.map((level) => level.price)).toEqual([...depth.asks.map((level) => level.price)].sort((a, b) => a - b));
    expect(depth.bids.map((level) => level.price)).toEqual([...depth.bids.map((level) => level.price)].sort((a, b) => b - a));
  });

  it("supports NO depth and clamps the requested number of levels", () => {
    const depth = buildMarketDepth(market(), "NO", 20);

    expect(depth.side).toBe("NO");
    expect(depth.midpoint).toBeCloseTo(0.4);
    expect(depth.asks).toHaveLength(8);
    expect(depth.asks.every((level) => level.shares > 0 && level.notional > 0)).toBe(true);
    expect(depth.bids.every((level) => level.shares > 0 && level.notional > 0)).toBe(true);
  });
});

function market(): Market {
  return {
    id: "market-depth",
    playerId: "player-depth",
    week: 1,
    position: "QB",
    threshold: "TOP_5",
    yesPool: 200,
    noPool: 300,
    liquidity: 500,
    status: "OPEN",
    result: null
  };
}
