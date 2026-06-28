import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type MarketStatus } from "@prisma/client";
import { executeDbBuy } from "@/lib/trade.service";
import { settleDbMarket, lockDbMarket, openDbMarket } from "@/lib/settlement.service";
import { voidDbMarket } from "@/lib/void.service";
import { refreshLeaderboardForWeek } from "@/lib/leaderboard.service";
import { DomainError } from "@/lib/domain-errors";
import { apiError } from "@/lib/api-response";
import { toNumber } from "@/lib/db-serialization";

const prisma = new PrismaClient();
const weekId = "test_week_service_layer";
const gameId = "test_game_service_layer";
const playerId = "test_player_service_layer";
const userId = "test_user_service_layer";
const otherUserId = "test_other_service_layer";

describe("FX-003 Service Layer", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  describe("trade.service — executeDbBuy", () => {
    it("buys YES shares and updates balance, position, and market pools", async () => {
      const balanceBefore = await getUserBalance(userId);
      const trade = await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 100 })
      );
      const balanceAfter = await getUserBalance(userId);
      const position = await prisma.position.findUniqueOrThrow({
        where: { userId_marketId: { userId, marketId: marketId("TOP_3") } }
      });

      expect(balanceAfter).toBeCloseTo(balanceBefore - 100);
      expect(toNumber(position.yesShares)).toBeCloseTo(toNumber(trade.shares));
      expect(toNumber(position.noShares)).toBe(0);
    });

    it("buys NO shares and updates position correctly", async () => {
      const trade = await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_5"), side: "NO", spend: 50 })
      );
      const position = await prisma.position.findUniqueOrThrow({
        where: { userId_marketId: { userId, marketId: marketId("TOP_5") } }
      });

      expect(toNumber(position.noShares)).toBeCloseTo(toNumber(trade.shares));
      expect(toNumber(position.yesShares)).toBe(0);
    });

    it("throws DomainError INSUFFICIENT_BALANCE when spend exceeds balance", async () => {
      await expect(
        prisma.$transaction((tx) =>
          executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 9999 })
        )
      ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });

    it("throws DomainError MARKET_NOT_OPEN for locked market", async () => {
      await prisma.market.update({
        where: { id: marketId("TOP_3") },
        data: { status: "LOCKED" }
      });
      await expect(
        prisma.$transaction((tx) =>
          executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 10 })
        )
      ).rejects.toMatchObject({ code: "MARKET_NOT_OPEN" });
    });

    it.each(["SETTLED", "VOID"] as MarketStatus[])(
      "throws DomainError MARKET_NOT_OPEN for %s market",
      async (status) => {
        await prisma.market.update({
          where: { id: marketId("TOP_3") },
          data: { status, result: status === "SETTLED" ? "YES" : null }
        });
        await expect(
          prisma.$transaction((tx) =>
            executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 10 })
          )
        ).rejects.toMatchObject({ code: "MARKET_NOT_OPEN" });
      }
    );
  });

  describe("settlement.service — settleDbMarket", () => {
    it("prevents double payout via idempotency key", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 100 })
      );

      await prisma.$transaction((tx) =>
        settleDbMarket(tx, { marketId: marketId("TOP_3"), result: "YES", positionalRank: 1 })
      );

      const payoutsAfterFirst = await prisma.accountLedgerEntry.findMany({
        where: { userId, marketId: marketId("TOP_3"), type: "SETTLEMENT_PAYOUT" }
      });
      expect(payoutsAfterFirst).toHaveLength(1);

      await expect(
        prisma.$transaction((tx) =>
          settleDbMarket(tx, { marketId: marketId("TOP_3"), result: "YES", positionalRank: 1 })
        )
      ).rejects.toMatchObject({ code: "MARKET_ALREADY_SETTLED" });

      const payoutsAfterSecond = await prisma.accountLedgerEntry.findMany({
        where: { userId, marketId: marketId("TOP_3"), type: "SETTLEMENT_PAYOUT" }
      });
      expect(payoutsAfterSecond).toHaveLength(1);
    });

    it("throws DomainError MARKET_ALREADY_SETTLED on double settle attempt", async () => {
      await prisma.$transaction((tx) =>
        settleDbMarket(tx, { marketId: marketId("TOP_10"), result: "NO", positionalRank: 8 })
      );
      await expect(
        prisma.$transaction((tx) =>
          settleDbMarket(tx, { marketId: marketId("TOP_10"), result: "NO", positionalRank: 8 })
        )
      ).rejects.toMatchObject({ code: "MARKET_ALREADY_SETTLED" });
    });
  });

  describe("void.service — voidDbMarket", () => {
    it("refunds cost basis and prevents double refund", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_5"), side: "NO", spend: 75 })
      );

      await prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_5")));

      const refunds = await prisma.accountLedgerEntry.findMany({
        where: { userId, marketId: marketId("TOP_5"), type: "VOID_REFUND" }
      });
      expect(refunds).toHaveLength(1);
      expect(toNumber(refunds[0].amount)).toBeCloseTo(75);

      await expect(
        prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_5")))
      ).rejects.toMatchObject({ code: "MARKET_ALREADY_VOID" });

      const refundsAfterSecond = await prisma.accountLedgerEntry.findMany({
        where: { userId, marketId: marketId("TOP_5"), type: "VOID_REFUND" }
      });
      expect(refundsAfterSecond).toHaveLength(1);
    });

    it("throws DomainError MARKET_ALREADY_VOID on double void", async () => {
      await prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_3")));
      await expect(
        prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_3")))
      ).rejects.toMatchObject({ code: "MARKET_ALREADY_VOID" });
    });
  });

  describe("leaderboard.service — refreshLeaderboardForWeek", () => {
    it("only creates leaderboard entries for users with positions in the week", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 50 })
      );

      await prisma.$transaction((tx) => refreshLeaderboardForWeek(tx, weekId));

      const userEntry = await prisma.leaderboardEntry.findUnique({
        where: { userId_weekId: { userId, weekId } }
      });
      const otherEntry = await prisma.leaderboardEntry.findUnique({
        where: { userId_weekId: { userId: otherUserId, weekId } }
      });

      expect(userEntry).not.toBeNull();
      expect(otherEntry).toBeNull();
    });

    it("assigns rank 1 to the user with the highest PnL", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 100 })
      );
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId: otherUserId, marketId: marketId("TOP_3"), side: "YES", spend: 20 })
      );

      await prisma.$transaction((tx) =>
        settleDbMarket(tx, { marketId: marketId("TOP_3"), result: "YES", positionalRank: 1 })
      );

      const entry = await prisma.leaderboardEntry.findUnique({
        where: { userId_weekId: { userId, weekId } }
      });
      expect(entry?.rank).toBe(1);
    });
  });

  describe("domain error mapping via apiError", () => {
    it("maps DomainError to correct HTTP status code", () => {
      const notFound = apiError(new DomainError("NOT_FOUND", "Market not found", 404));
      expect(notFound.status).toBe(404);
    });

    it("maps MARKET_ALREADY_SETTLED to 409", () => {
      const conflict = apiError(new DomainError("MARKET_ALREADY_SETTLED", "Market is already settled", 409));
      expect(conflict.status).toBe(409);
    });

    it("maps MARKET_ALREADY_VOID to 409", () => {
      const conflict = apiError(new DomainError("MARKET_ALREADY_VOID", "Market is already void", 409));
      expect(conflict.status).toBe(409);
    });

    it("maps MARKET_NOT_OPEN to 400", () => {
      const badRequest = apiError(new DomainError("MARKET_NOT_OPEN", "Market is not open", 400));
      expect(badRequest.status).toBe(400);
    });

    it("maps INSUFFICIENT_BALANCE to 400", () => {
      const badRequest = apiError(new DomainError("INSUFFICIENT_BALANCE", "Insufficient mock credit balance", 400));
      expect(badRequest.status).toBe(400);
    });

    it("maps INVALID_MARKET_TRANSITION to 409", () => {
      const conflict = apiError(new DomainError("INVALID_MARKET_TRANSITION", "Finalized market cannot be locked", 409));
      expect(conflict.status).toBe(409);
    });
  });

  describe("lock and unlock via settlement.service", () => {
    it("locks and unlocks a market, emitting events", async () => {
      await prisma.$transaction((tx) => lockDbMarket(tx, marketId("TOP_10"), userId, "Pre-kickoff"));
      await prisma.$transaction((tx) => openDbMarket(tx, marketId("TOP_10"), userId, "Delayed kickoff"));

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_10") },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      expect(events.map((e) => e.type)).toEqual(["LOCK", "UNLOCK"]);
    });

    it("throws INVALID_MARKET_TRANSITION when trying to open a non-locked market", async () => {
      await expect(
        prisma.$transaction((tx) => openDbMarket(tx, marketId("TOP_3"), userId))
      ).rejects.toMatchObject({ code: "INVALID_MARKET_TRANSITION" });
    });
  });
});

function makeDbMarket(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  const yesPrice = thresholdType === "TOP_3" ? 0.3 : thresholdType === "TOP_5" ? 0.45 : 0.6;
  return {
    id: marketId(thresholdType),
    playerId,
    weekId,
    gameId,
    position: "QB" as const,
    thresholdType,
    yesPrice,
    noPrice: 1 - yesPrice,
    openingPrice: yesPrice,
    yesPool: 500 * (1 - yesPrice),
    noPool: 500 * yesPrice,
    volume: 0,
    openInterest: 0,
    status: "OPEN" as const,
    kickoffTime: new Date("2099-09-03T17:00:00.000Z")
  };
}

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2099,
      week: 3,
      startsAt: new Date("2099-09-15T00:00:00.000Z"),
      endsAt: new Date("2099-09-22T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "SVC",
      awayTeam: "TST",
      kickoffTime: new Date("2099-09-17T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: { id: playerId, name: "Service Layer QB", team: "SVC", position: "QB" }
  });

  await prisma.user.create({
    data: { id: userId, name: "Service User", mockBalance: 1000, startingBalance: 1000, isAdmin: true }
  });

  await prisma.user.create({
    data: { id: otherUserId, name: "Other Service User", mockBalance: 1000, startingBalance: 1000 }
  });

  await prisma.accountLedgerEntry.createMany({
    data: [
      {
        userId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${userId}`,
        reason: "Test seed grant",
        metadata: { test: true }
      },
      {
        userId: otherUserId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${otherUserId}`,
        reason: "Test seed grant",
        metadata: { test: true }
      }
    ]
  });

  await prisma.market.createMany({
    data: [makeDbMarket("TOP_3"), makeDbMarket("TOP_5"), makeDbMarket("TOP_10")]
  });
}

async function resetTestData() {
  await prisma.leaderboardEntry.deleteMany({
    where: { OR: [{ weekId }, { userId }, { userId: otherUserId }] }
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({
      where: { marketId: { startsWith: "test_market_service_layer" } }
    });
    await tx.accountLedgerEntry.deleteMany({
      where: { OR: [{ userId }, { userId: otherUserId }] }
    });
  });
  await prisma.marketEvent.deleteMany({
    where: { marketId: { startsWith: "test_market_service_layer" } }
  });
  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { marketId: { startsWith: "test_market_service_layer" } },
        { actorId: userId }
      ]
    }
  });
  await prisma.settlement.deleteMany({
    where: { marketId: { startsWith: "test_market_service_layer" } }
  });
  await prisma.trade.deleteMany({
    where: { marketId: { startsWith: "test_market_service_layer" } }
  });
  await prisma.position.deleteMany({
    where: { marketId: { startsWith: "test_market_service_layer" } }
  });
  await prisma.market.deleteMany({ where: { id: { startsWith: "test_market_service_layer" } } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.deleteMany({ where: { id: otherUserId } });
}

async function getUserBalance(targetUserId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  return toNumber(user.mockBalance);
}

function marketId(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  return `test_market_service_layer_${thresholdType.toLowerCase()}`;
}
