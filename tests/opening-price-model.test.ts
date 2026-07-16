import { describe, it, expect } from "vitest";
import { calcOpeningYesPrice, calcInitialPools } from "@/lib/opening-price-model";

describe("Opening Price Model", () => {

  describe("calcOpeningYesPrice — range bounds", () => {
    it("always returns a value in [0.05, 0.95]", () => {
      const positions = ["QB", "RB", "WR", "TE"] as const;
      const thresholds = ["TOP_3", "TOP_5", "TOP_10"] as const;
      const projections = [0, 5, 10, 15, 20, 25, 30];
      for (const pos of positions) {
        for (const thr of thresholds) {
          for (const proj of projections) {
            const p = calcOpeningYesPrice(proj, pos, thr);
            expect(p).toBeGreaterThanOrEqual(0.05);
            expect(p).toBeLessThanOrEqual(0.95);
          }
        }
      }
    });
  });

  describe("calcOpeningYesPrice — monotonicity", () => {
    it("higher QB projection → higher Top 3 YES price", () => {
      const low  = calcOpeningYesPrice(14, "QB", "TOP_3");
      const high = calcOpeningYesPrice(27, "QB", "TOP_3");
      expect(high).toBeGreaterThan(low);
    });

    it("higher RB projection → higher Top 5 YES price", () => {
      const low  = calcOpeningYesPrice(8, "RB", "TOP_5");
      const high = calcOpeningYesPrice(22, "RB", "TOP_5");
      expect(high).toBeGreaterThan(low);
    });

    it("Top 10 YES price > Top 5 YES price for same WR projection", () => {
      // Projection 22 puts WR around rank 7–9, comfortably inside Top 10 but not Top 5
      const top5  = calcOpeningYesPrice(22, "WR", "TOP_5");
      const top10 = calcOpeningYesPrice(22, "WR", "TOP_10");
      expect(top10).toBeGreaterThan(top5);
    });

    it("Top 5 YES price > Top 3 YES price for same player", () => {
      const top3 = calcOpeningYesPrice(20, "QB", "TOP_3");
      const top5 = calcOpeningYesPrice(20, "QB", "TOP_5");
      expect(top5).toBeGreaterThan(top3);
    });
  });

  describe("calcOpeningYesPrice — elite players", () => {
    it("Josh Allen (proj 27.4) QB Top 3 prices above 0.50", () => {
      const p = calcOpeningYesPrice(27.4, "QB", "TOP_3");
      expect(p).toBeGreaterThan(0.50);
    });

    it("Travis Kelce (proj 15.2) TE Top 3 prices above 0.35 (competitive for TE3)", () => {
      // At rank ~4, Kelce has ~43% chance of top 3
      const p = calcOpeningYesPrice(15.2, "TE", "TOP_3");
      expect(p).toBeGreaterThan(0.35);
    });

    it("borderline WR (proj 9.5) WR Top 5 prices below 0.25", () => {
      const p = calcOpeningYesPrice(9.5, "WR", "TOP_5");
      expect(p).toBeLessThan(0.25);
    });
  });

  describe("calcOpeningYesPrice — status penalties", () => {
    // Use projection that yields a mid-range price (not clamped) so multipliers show effect
    // QB proj=24 → rank ~2 → Top 3 prob ~70%
    const baseActive = calcOpeningYesPrice(24, "QB", "TOP_3", "ACTIVE");

    it("QUESTIONABLE reduces price vs ACTIVE", () => {
      const q = calcOpeningYesPrice(24, "QB", "TOP_3", "QUESTIONABLE");
      expect(q).toBeLessThan(baseActive);
    });

    it("DOUBTFUL reduces price significantly vs ACTIVE", () => {
      const d = calcOpeningYesPrice(24, "QB", "TOP_3", "DOUBTFUL");
      expect(d).toBeLessThan(baseActive * 0.7);
    });

    it("OUT prices near floor", () => {
      const out = calcOpeningYesPrice(27, "QB", "TOP_3", "OUT");
      expect(out).toBeLessThanOrEqual(0.10);
    });
  });

  describe("calcOpeningYesPrice — researched context", () => {
    it("elite ADP improves confidence versus same projection with no ADP", () => {
      const base = calcOpeningYesPrice(18, "RB", "TOP_5");
      const researched = calcOpeningYesPrice(18, "RB", "TOP_5", "ACTIVE", { adpRank: 3 });
      expect(researched).toBeGreaterThan(base);
    });

    it("poor matchup adjustment lowers the opening price", () => {
      const neutral = calcOpeningYesPrice(18, "WR", "TOP_10", "ACTIVE", { adpRank: 40 });
      const tough = calcOpeningYesPrice(18, "WR", "TOP_10", "ACTIVE", { adpRank: 40, matchupAdjustment: -2 });
      expect(tough).toBeLessThan(neutral);
    });
  });

  describe("calcInitialPools — pool consistency", () => {
    it("yesPrice + noPrice = 1", () => {
      const { yesPrice, noPrice } = calcInitialPools(0.65);
      expect(yesPrice + noPrice).toBeCloseTo(1, 5);
    });

    it("returns correct yesPrice", () => {
      const { yesPrice } = calcInitialPools(0.72);
      expect(yesPrice).toBe(0.72);
    });

    it("noPool is fraction of liquidity matching yesPrice", () => {
      const { noPool } = calcInitialPools(0.60, 500);
      expect(noPool).toBeCloseTo(300, 0);
    });

    it("yesPool + noPool approximates totalLiquidity", () => {
      const { yesPool, noPool } = calcInitialPools(0.55, 1000);
      expect(yesPool + noPool).toBeCloseTo(1000, 0);
    });
  });

});
