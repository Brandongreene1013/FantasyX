import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { calcSentiment, getPlaceholderHistory, getIntelligence } from "@/lib/player-intelligence";
import { DomainError } from "@/lib/domain-errors";

const prisma = new PrismaClient();
const weekId = "test_week_player_intel";
const gameId = "test_game_player_intel";
const playerId = "test_player_player_intel";
const userId = "test_user_player_intel";

const testMarkets = [
  { threshold: "TOP_3" as const, yesPrice: 0.28, volume: 120, openInterest: 15 },
  { threshold: "TOP_5" as const, yesPrice: 0.45, volume: 200, openInterest: 22 },
  { threshold: "TOP_10" as const, yesPrice: 0.62, volume: 80, openInterest: 8 }
];

describe("FX-005 Player Intelligence", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  describe("calcSentiment", () => {
    it("computes average YES price across markets", () => {
      const result = calcSentiment(testMarkets);
      const expected = (0.28 + 0.45 + 0.62) / 3;
      expect(result!.avgYesPrice).toBeCloseTo(expected);
    });

    it("sums total volume", () => {
      const result = calcSentiment(testMarkets);
      expect(result!.totalVolume).toBeCloseTo(400);
    });

    it("sums total open interest", () => {
      const result = calcSentiment(testMarkets);
      expect(result!.totalOpenInterest).toBeCloseTo(45);
    });

    it("identifies highest-confidence market by YES price", () => {
      const result = calcSentiment(testMarkets);
      expect(result!.highestConfidenceMarket.threshold).toBe("TOP_10");
      expect(result!.highestConfidenceMarket.yesPrice).toBeCloseTo(0.62);
    });

    it("identifies lowest-confidence market by YES price", () => {
      const result = calcSentiment(testMarkets);
      expect(result!.lowestConfidenceMarket.threshold).toBe("TOP_3");
      expect(result!.lowestConfidenceMarket.yesPrice).toBeCloseTo(0.28);
    });

    it("returns null for empty market list", () => {
      expect(calcSentiment([])).toBeNull();
    });

    it("handles single market", () => {
      const single = [{ threshold: "TOP_5" as const, yesPrice: 0.5, volume: 10, openInterest: 2 }];
      const result = calcSentiment(single);
      expect(result!.avgYesPrice).toBeCloseTo(0.5);
      expect(result!.highestConfidenceMarket.threshold).toBe("TOP_5");
      expect(result!.lowestConfidenceMarket.threshold).toBe("TOP_5");
    });
  });

  describe("getPlaceholderHistory", () => {
    it("returns exactly 5 entries", () => {
      const history = getPlaceholderHistory("p_josh_allen", 24.2);
      expect(history).toHaveLength(5);
    });

    it("returns consistent deterministic results for same player", () => {
      const a = getPlaceholderHistory("p_josh_allen", 24.2);
      const b = getPlaceholderHistory("p_josh_allen", 24.2);
      expect(a).toEqual(b);
    });

    it("returns different results for different players", () => {
      const a = getPlaceholderHistory("p_josh_allen", 22.0);
      const b = getPlaceholderHistory("p_travis_kelce", 22.0);
      expect(a).not.toEqual(b);
    });

    it("all finishes are positive integers", () => {
      const history = getPlaceholderHistory("p_saquon_barkley", 18.9);
      for (const row of history) {
        expect(row.finish).toBeGreaterThanOrEqual(1);
        expect(Number.isFinite(row.finish)).toBe(true);
      }
    });

    it("all points values are positive numbers", () => {
      const history = getPlaceholderHistory("p_christian_mccaffrey", 19.4);
      for (const row of history) {
        expect(row.points).toBeGreaterThan(0);
      }
    });
  });

  describe("getIntelligence", () => {
    it("returns projectedPoints from static data", () => {
      const result = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(result.projectedPoints).toBe(24.2);
    });

    it("derives projectedRank from projection and position", () => {
      const qb = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(qb.projectedRank).toBe("Top 3 likely");

      const te = getIntelligence("p_travis_kelce", "TE", "LAC", testMarkets);
      expect(te.projectedRank).toBe("Top 3 likely");
    });

    it("confidence score is 0-99 and based on avg YES price", () => {
      const result = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(99);
    });

    it("injuryStatus is ACTIVE placeholder", () => {
      const result = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(result.injuryStatus).toBe("ACTIVE");
    });

    it("matchupNotes includes opponent", () => {
      const result = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(result.matchupNotes).toContain("NYJ");
    });

    it("historicalFinishes has 5 entries", () => {
      const result = getIntelligence("p_josh_allen", "QB", "NYJ", testMarkets);
      expect(result.historicalFinishes).toHaveLength(5);
    });

    it("falls back gracefully for unknown player", () => {
      const result = getIntelligence("unknown_player_xyz", "WR", "OPP", testMarkets);
      expect(result.projectedPoints).toBe(15.0);
      expect(result.injuryStatus).toBe("ACTIVE");
    });
  });

  describe("DomainError NOT_FOUND for player", () => {
    it("has code NOT_FOUND and status 404", () => {
      const error = new DomainError("NOT_FOUND", "Player not found", 404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.status).toBe(404);
    });
  });

  describe("player DB retrieval", () => {
    it("retrieves a player by ID", async () => {
      const player = await prisma.player.findUnique({ where: { id: playerId } });
      expect(player).not.toBeNull();
      expect(player!.name).toBe("Intel Test QB");
      expect(player!.position).toBe("QB");
    });

    it("returns null for non-existent player", async () => {
      const player = await prisma.player.findUnique({ where: { id: "does_not_exist_xyz" } });
      expect(player).toBeNull();
    });

    it("retrieves all markets for a player in a given week", async () => {
      const markets = await prisma.market.findMany({
        where: { playerId, weekId },
        orderBy: { thresholdType: "asc" }
      });
      expect(markets).toHaveLength(3);
      const thresholds = markets.map((m) => m.thresholdType);
      expect(thresholds).toContain("TOP_3");
      expect(thresholds).toContain("TOP_5");
      expect(thresholds).toContain("TOP_10");
    });
  });
});

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2076,
      week: 1,
      startsAt: new Date("2076-09-08T00:00:00.000Z"),
      endsAt: new Date("2076-09-15T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "INT",
      awayTeam: "OPP",
      kickoffTime: new Date("2076-09-10T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: { id: playerId, name: "Intel Test QB", team: "INT", position: "QB" }
  });

  await prisma.user.create({
    data: { id: userId, name: "Intel Test User", mockBalance: 1000, startingBalance: 1000, isAdmin: false }
  });

  const marketBase = { playerId, weekId, gameId, position: "QB" as const, status: "OPEN" as const, kickoffTime: new Date("2076-09-10T17:00:00.000Z") };
  await prisma.market.createMany({
    data: [
      { id: `${playerId}_top_3`, ...marketBase, thresholdType: "TOP_3", yesPrice: 0.28, noPrice: 0.72, openingPrice: 0.28, yesPool: 360, noPool: 140, volume: 0, openInterest: 0 },
      { id: `${playerId}_top_5`, ...marketBase, thresholdType: "TOP_5", yesPrice: 0.45, noPrice: 0.55, openingPrice: 0.45, yesPool: 275, noPool: 225, volume: 0, openInterest: 0 },
      { id: `${playerId}_top_10`, ...marketBase, thresholdType: "TOP_10", yesPrice: 0.62, noPrice: 0.38, openingPrice: 0.62, yesPool: 190, noPool: 310, volume: 0, openInterest: 0 }
    ]
  });
}

async function resetTestData() {
  await prisma.marketEvent.deleteMany({ where: { marketId: { startsWith: playerId } } });
  await prisma.adminAuditLog.deleteMany({ where: { marketId: { startsWith: playerId } } });
  await prisma.settlement.deleteMany({ where: { marketId: { startsWith: playerId } } });
  await prisma.trade.deleteMany({ where: { marketId: { startsWith: playerId } } });
  await prisma.position.deleteMany({ where: { marketId: { startsWith: playerId } } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { userId } });
  });
  await prisma.market.deleteMany({ where: { id: { startsWith: playerId } } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}
