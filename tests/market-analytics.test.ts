import { describe, expect, it } from "vitest";
import {
  buildMarketHistoryPoints,
  calculateMarketSentiment,
  calculatePortfolioAnalytics,
  getBiggestMovers,
  rankTrendingMarkets
} from "@/lib/market-analytics.service";

describe("FX-007 Market Intelligence & Analytics", () => {
  it("builds chart-ready market history from persisted snapshots", () => {
    const points = buildMarketHistoryPoints({
      openingPrice: 0.35,
      currentYesPrice: 0.48,
      currentNoPrice: 0.52,
      currentLiquidity: 1000,
      currentVolume: 220,
      currentOpenInterest: 14,
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
      snapshots: [
        {
          id: "snap_1",
          createdAt: "2026-09-01T18:00:00.000Z",
          yesPrice: 0.42,
          noPrice: 0.58,
          liquidity: 980,
          volume: 120,
          openInterest: 8
        }
      ],
      events: []
    });

    expect(points).toHaveLength(3);
    expect(points[0].yesPrice).toBe(0.35);
    expect(points[1].yesPrice).toBe(0.42);
    expect(points[2].volume).toBe(220);
  });

  it("falls back to market events when no snapshots exist", () => {
    const points = buildMarketHistoryPoints({
      openingPrice: 0.3,
      currentYesPrice: 0.5,
      currentNoPrice: 0.5,
      currentLiquidity: 900,
      currentVolume: 80,
      currentOpenInterest: 6,
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
      snapshots: [],
      events: [
        {
          id: "event_1",
          createdAt: "2026-09-01T13:00:00.000Z",
          priceAfter: 0.44,
          liquidity: 930,
          volume: 30,
          openInterest: 2
        }
      ]
    });

    expect(points.map((point) => point.id)).toEqual(["opening", "event_1", "current"]);
    expect(points[1].openInterest).toBe(2);
  });

  it("calculates bullish, bearish, and confidence scores", () => {
    const sentiment = calculateMarketSentiment({
      yesPrice: 0.68,
      noPrice: 0.32,
      volume: 500,
      openInterest: 45,
      recentPriceChange: 0.09
    });

    expect(sentiment.label).toBe("Bullish");
    expect(sentiment.bullishScore).toBeGreaterThan(sentiment.bearishScore);
    expect(sentiment.confidenceScore).toBeGreaterThan(20);
  });

  it("ranks trending markets by activity, movement, and trade count", () => {
    const ranked = rankTrendingMarkets([
      market("quiet", 0.01, 10, 2, 0),
      market("active", 0.12, 400, 20, 5),
      market("oi", 0.03, 50, 100, 1)
    ]);

    expect(ranked[0].marketId).toBe("active");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("groups biggest movers by price, volume, and liquidity", () => {
    const movers = getBiggestMovers([
      market("up", 0.2, 20, 5, 1, 900),
      market("down", -0.18, 40, 4, 2, 800),
      market("vol", 0.01, 700, 3, 3, 1000)
    ]);

    expect(movers.yesIncrease[0].marketId).toBe("up");
    expect(movers.yesDecrease[0].marketId).toBe("down");
    expect(movers.volumeIncrease[0].marketId).toBe("vol");
    expect(movers.liquidityIncrease[0].marketId).toBe("vol");
  });

  it("calculates portfolio analytics summary metrics", () => {
    const analytics = calculatePortfolioAnalytics({
      startingBalance: 1000,
      mockBalance: 740,
      openValue: 360,
      positions: [
        { playerName: "A", thresholdType: "TOP_5", status: "OPEN", costBasis: 300, currentValue: 360, realizedPayout: 0, pnl: 60, averageEntry: 0.4 },
        { playerName: "B", thresholdType: "TOP_10", status: "SETTLED", costBasis: 100, currentValue: 0, realizedPayout: 160, pnl: 60, averageEntry: 0.5 },
        { playerName: "C", thresholdType: "TOP_3", status: "SETTLED", costBasis: 50, currentValue: 0, realizedPayout: 0, pnl: -50, averageEntry: 0.6 }
      ],
      trades: [
        { id: "t1", marketId: "m1", playerName: "A", spend: 300, shares: 700, priceAfter: 0.42, createdAt: "2026-09-01T00:00:00.000Z" },
        { id: "t2", marketId: "m2", playerName: "B", spend: 100, shares: 120, priceAfter: 0.6, createdAt: "2026-09-02T00:00:00.000Z" }
      ]
    });

    expect(analytics.currentPortfolioValue).toBe(1100);
    expect(analytics.weeklyPnl).toBe(100);
    expect(analytics.unrealizedGainLoss).toBe(60);
    expect(analytics.realizedGainLoss).toBe(10);
    expect(analytics.winRate).toBe(0.5);
    expect(analytics.largestPosition?.playerName).toBe("A");
  });
});

function market(
  marketId: string,
  priceChange: number,
  volume: number,
  openInterest: number,
  recentTradeCount: number,
  liquidity = 500
) {
  return {
    marketId,
    playerId: `p_${marketId}`,
    playerName: marketId,
    team: "BUF",
    position: "QB",
    threshold: "TOP_5",
    yesPrice: 0.5 + priceChange,
    noPrice: 0.5 - priceChange,
    volume,
    openInterest,
    liquidity,
    priceChange,
    recentTradeCount,
    score: 0
  };
}
