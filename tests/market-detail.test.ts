import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { serializeMarket, serializePlayerFromMarket } from "@/lib/db-serialization";
import { DomainError } from "@/lib/domain-errors";

const prisma = new PrismaClient();
const weekId = "test_week_market_detail";
const gameId = "test_game_market_detail";
const playerId = "test_player_market_detail";
const marketId = "test_market_market_detail_top3";
const userId = "test_user_market_detail";

describe("FX-004 Market Detail", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  describe("serializeMarket", () => {
    it("serializes a market with correct computed fields", async () => {
      const market = await prisma.market.findUniqueOrThrow({
        where: { id: marketId },
        include: { player: true, game: true }
      });

      const serialized = serializeMarket(market);

      expect(serialized.id).toBe(marketId);
      expect(serialized.week).toBe(1);
      expect(serialized.threshold).toBe("TOP_3");
      expect(serialized.position).toBe("QB");
      expect(serialized.status).toBe("OPEN");
      expect(serialized.liquidity).toBeCloseTo(serialized.yesPool + serialized.noPool);
      expect(typeof serialized.kickoffTime).toBe("string");
      expect(serialized.kickoffTime).toContain("T");
    });

    it("derives volume and openInterest as numbers", async () => {
      const market = await prisma.market.findUniqueOrThrow({
        where: { id: marketId },
        include: { player: true, game: true }
      });

      const serialized = serializeMarket(market);

      expect(typeof serialized.volume).toBe("number");
      expect(typeof serialized.openInterest).toBe("number");
    });
  });

  describe("serializePlayerFromMarket", () => {
    it("resolves opponent correctly when player is home team", async () => {
      const market = await prisma.market.findUniqueOrThrow({
        where: { id: marketId },
        include: { player: true, game: true }
      });

      const player = serializePlayerFromMarket(market);

      expect(player).not.toBeNull();
      expect(player!.name).toBe("Detail Test QB");
      expect(player!.team).toBe("DET");
      expect(player!.opponent).toBe("OPP");
    });

    it("returns null when market has no player", async () => {
      const result = serializePlayerFromMarket({
        id: "fake",
        playerId: "none",
        weekId,
        position: "QB",
        thresholdType: "TOP_3",
        yesPrice: 0.3,
        noPrice: 0.7,
        yesPool: 350,
        noPool: 150,
        status: "OPEN",
        result: null,
        kickoffTime: new Date(),
        player: undefined,
        game: null
      } as Parameters<typeof serializePlayerFromMarket>[0]);

      expect(result).toBeNull();
    });
  });

  describe("DomainError NOT_FOUND", () => {
    it("has correct code, status, and message", () => {
      const error = new DomainError("NOT_FOUND", "Market not found", 404);

      expect(error.code).toBe("NOT_FOUND");
      expect(error.status).toBe(404);
      expect(error.message).toBe("Market not found");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("market detail data retrieval", () => {
    it("retrieves a market with player and game data", async () => {
      const market = await prisma.market.findUnique({
        where: { id: marketId },
        include: { player: true, game: true }
      });

      expect(market).not.toBeNull();
      expect(market!.player.name).toBe("Detail Test QB");
      expect(market!.game?.homeTeam).toBe("DET");
    });

    it("returns null for a non-existent market", async () => {
      const market = await prisma.market.findUnique({
        where: { id: "does_not_exist_at_all" }
      });

      expect(market).toBeNull();
    });

    it("fetches market events ordered by createdAt desc", async () => {
      await prisma.marketEvent.createMany({
        data: [
          {
            marketId,
            type: "LOCK",
            userId,
            priceBefore: 0.3,
            priceAfter: 0.3,
            liquidity: 500,
            volume: 0,
            openInterest: 0
          },
          {
            marketId,
            type: "UNLOCK",
            userId,
            priceBefore: 0.3,
            priceAfter: 0.3,
            liquidity: 500,
            volume: 0,
            openInterest: 0
          }
        ]
      });

      const events = await prisma.marketEvent.findMany({
        where: { marketId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });

      expect(events.length).toBeGreaterThanOrEqual(2);
      const types = events.map((e) => e.type);
      expect(types).toContain("LOCK");
      expect(types).toContain("UNLOCK");
    });
  });

  describe("filter logic (client-side derivation)", () => {
    it("correctly identifies open markets", async () => {
      const market = await prisma.market.findUniqueOrThrow({ where: { id: marketId } });
      expect(market.status).toBe("OPEN");
    });

    it("week number is extracted from weekId string", async () => {
      const market = await prisma.market.findUniqueOrThrow({
        where: { id: marketId },
        include: { player: true, game: true }
      });
      const serialized = serializeMarket(market);
      expect(serialized.week).toBe(1);
    });
  });
});

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2077,
      week: 1,
      startsAt: new Date("2077-09-08T00:00:00.000Z"),
      endsAt: new Date("2077-09-15T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "DET",
      awayTeam: "OPP",
      kickoffTime: new Date("2099-09-10T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: { id: playerId, name: "Detail Test QB", team: "DET", position: "QB" }
  });

  await prisma.user.create({
    data: { id: userId, name: "Detail Test User", mockBalance: 1000, startingBalance: 1000, isAdmin: false }
  });

  await prisma.market.create({
    data: {
      id: marketId,
      playerId,
      weekId,
      gameId,
      position: "QB",
      thresholdType: "TOP_3",
      yesPrice: 0.3,
      noPrice: 0.7,
      openingPrice: 0.3,
      yesPool: 350,
      noPool: 150,
      volume: 0,
      openInterest: 0,
      status: "OPEN",
      kickoffTime: new Date("2099-09-10T17:00:00.000Z")
    }
  });
}

async function resetTestData() {
  await prisma.marketEvent.deleteMany({ where: { marketId } });
  await prisma.adminAuditLog.deleteMany({ where: { marketId } });
  await prisma.settlement.deleteMany({ where: { marketId } });
  await prisma.trade.deleteMany({ where: { marketId } });
  await prisma.position.deleteMany({ where: { marketId } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { userId } });
  });
  await prisma.market.deleteMany({ where: { id: marketId } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}
