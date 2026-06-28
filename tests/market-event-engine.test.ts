import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { executeDbBuy, lockDbMarket, openDbMarket, settleDbMarket, settleDbPlayerMarkets, voidDbMarket } from "@/lib/db-amm";
import { toNumber } from "@/lib/db-serialization";
import { sessionCookieName } from "@/lib/session";
import { emitAdminNoteEvent, snapshotFromMarket } from "@/lib/market-event.service";
import { POST as postAdjustment } from "@/app/api/admin/adjustments/route";
import { POST as postNote } from "@/app/api/admin/notes/route";
import { GET as getAuditHistory } from "@/app/api/admin/audit-history/route";
import { POST as postTrade } from "@/app/api/trades/route";
import { POST as postSettlement } from "@/app/api/settlements/route";

const prisma = new PrismaClient();
const weekId = "test_week_event_engine";
const gameId = "test_game_event_engine";
const playerId = "test_player_event_engine";
const adminUserId = "test_admin_event_engine";
const traderUserId = "test_trader_event_engine";

describe("FX-002 Market Event Engine", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  describe("event service consistency", () => {
    it("emits TRADE and PRICE_CHANGE events with consistent snapshots", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_3"),
          side: "YES",
          spend: 50,
        })
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_3") },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("TRADE");
      expect(events[1].type).toBe("PRICE_CHANGE");

      expect(events[0].userId).toBe(traderUserId);
      expect(events[1].userId).toBe(traderUserId);
      expect(events[0].tradeId).toBeTruthy();
      expect(events[1].tradeId).toBe(events[0].tradeId);

      expect(toNumber(events[0].volume)).toBe(toNumber(events[1].volume));
      expect(toNumber(events[0].liquidity)).toBe(toNumber(events[1].liquidity));
      expect(toNumber(events[0].openInterest)).toBe(toNumber(events[1].openInterest));

      expect(toNumber(events[0].priceBefore)).toBeLessThan(toNumber(events[0].priceAfter));
    });

    it("emits SETTLE event with market snapshot at settlement time", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_5"),
          side: "YES",
          spend: 30,
        })
      );

      const marketBefore = await prisma.market.findUniqueOrThrow({
        where: { id: marketId("TOP_5") },
      });

      await prisma.$transaction((tx) =>
        settleDbMarket(tx, {
          marketId: marketId("TOP_5"),
          result: "YES",
          settledById: adminUserId,
          positionalRank: 2,
          reason: "Settled by test",
        })
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_5"), type: "SETTLE" },
      });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(adminUserId);
      expect(events[0].settlementId).toBeTruthy();
      expect(toNumber(events[0].priceAfter)).toBeCloseTo(toNumber(marketBefore.yesPrice));
      expect(events[0].note).toBe("Settled by test");
    });

    it("emits LOCK and UNLOCK events with consistent snapshots", async () => {
      await prisma.$transaction((tx) =>
        lockDbMarket(tx, marketId("TOP_10"), adminUserId, "Pre-kickoff lock")
      );
      await prisma.$transaction((tx) =>
        openDbMarket(tx, marketId("TOP_10"), adminUserId, "Reopened for trading")
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_10") },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("LOCK");
      expect(events[0].note).toBe("Pre-kickoff lock");
      expect(events[1].type).toBe("UNLOCK");
      expect(events[1].note).toBe("Reopened for trading");

      expect(toNumber(events[0].liquidity)).toBeGreaterThan(0);
      expect(toNumber(events[1].liquidity)).toBeGreaterThan(0);
    });

    it("emits VOID event with market snapshot", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_3"),
          side: "NO",
          spend: 20,
        })
      );

      await prisma.$transaction((tx) =>
        voidDbMarket(tx, marketId("TOP_3"), adminUserId, "Cancelled game")
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_3"), type: "VOID" },
      });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(adminUserId);
      expect(events[0].note).toBe("Cancelled game");
      expect(toNumber(events[0].volume)).toBeGreaterThan(0);
    });

    it("emits ADMIN_NOTE event through service", async () => {
      const market = await prisma.market.findUniqueOrThrow({
        where: { id: marketId("TOP_5") },
      });

      await prisma.$transaction((tx) =>
        emitAdminNoteEvent(tx, {
          marketId: marketId("TOP_5"),
          userId: adminUserId,
          note: "Monitoring injury report",
          snapshot: snapshotFromMarket(market),
        })
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_5"), type: "ADMIN_NOTE" },
      });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(adminUserId);
      expect(events[0].note).toBe("Monitoring injury report");
    });
  });

  describe("event ordering across lifecycle", () => {
    it("records events in correct chronological order through full market lifecycle", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_3"),
          side: "YES",
          spend: 100,
        })
      );

      await prisma.$transaction((tx) =>
        lockDbMarket(tx, marketId("TOP_3"), adminUserId, "Kickoff")
      );

      await prisma.$transaction((tx) =>
        openDbMarket(tx, marketId("TOP_3"), adminUserId, "Delayed kickoff")
      );

      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_3"),
          side: "NO",
          spend: 50,
        })
      );

      await prisma.$transaction((tx) =>
        settleDbMarket(tx, {
          marketId: marketId("TOP_3"),
          result: "YES",
          settledById: adminUserId,
          positionalRank: 1,
        })
      );

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_3") },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      const types = events.map((e) => e.type);
      expect(types).toEqual([
        "TRADE",
        "PRICE_CHANGE",
        "LOCK",
        "UNLOCK",
        "TRADE",
        "PRICE_CHANGE",
        "SETTLE",
      ]);
    });

    it("settleDbPlayerMarkets creates events for each market", async () => {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_3"),
          side: "YES",
          spend: 30,
        })
      );
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId: traderUserId,
          marketId: marketId("TOP_5"),
          side: "YES",
          spend: 30,
        })
      );

      await prisma.$transaction((tx) =>
        settleDbPlayerMarkets(tx, {
          playerId,
          weekId,
          rank: 4,
          settledById: adminUserId,
        })
      );

      const top3Events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_3"), type: "SETTLE" },
      });
      const top5Events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_5"), type: "SETTLE" },
      });

      expect(top3Events).toHaveLength(1);
      expect(top5Events).toHaveLength(1);
    });
  });

  describe("admin adjustment workflow", () => {
    it("creates ADMIN_ADJUSTMENT ledger entry and audit record", async () => {
      const response = await postAdjustment(
        adminRequest("http://localhost/api/admin/adjustments", {
          userId: traderUserId,
          amount: 250,
          reason: "Bonus for testing",
        })
      );

      expect(response.status).toBe(200);

      const traderBalance = await getUserBalance(traderUserId);
      expect(traderBalance).toBeCloseTo(1250);

      const ledgerEntries = await prisma.accountLedgerEntry.findMany({
        where: { userId: traderUserId, type: "ADMIN_ADJUSTMENT" },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(toNumber(ledgerEntries[0].amount)).toBeCloseTo(250);
      expect(ledgerEntries[0].adminId).toBe(adminUserId);
      expect(ledgerEntries[0].reason).toBe("Bonus for testing");

      const audits = await prisma.adminAuditLog.findMany({
        where: { actorId: adminUserId },
        orderBy: { createdAt: "desc" },
      });
      expect(audits.length).toBeGreaterThanOrEqual(1);
    });

    it("allows negative admin adjustments", async () => {
      const response = await postAdjustment(
        adminRequest("http://localhost/api/admin/adjustments", {
          userId: traderUserId,
          amount: -100,
          reason: "Penalty for rule violation",
        })
      );

      expect(response.status).toBe(200);
      expect(await getUserBalance(traderUserId)).toBeCloseTo(900);
    });

    it("rejects admin adjustment with zero amount", async () => {
      const response = await postAdjustment(
        adminRequest("http://localhost/api/admin/adjustments", {
          userId: traderUserId,
          amount: 0,
          reason: "Should fail",
        })
      );

      expect(response.status).toBe(422);
    });

    it("rejects admin adjustment for non-existent user", async () => {
      const response = await postAdjustment(
        adminRequest("http://localhost/api/admin/adjustments", {
          userId: "non_existent_user_id",
          amount: 50,
          reason: "Should fail",
        })
      );

      expect(response.status).toBe(400);
    });

    it("rejects admin adjustment without reason", async () => {
      const response = await postAdjustment(
        adminRequest("http://localhost/api/admin/adjustments", {
          userId: traderUserId,
          amount: 50,
        })
      );

      expect(response.status).toBe(422);
    });
  });

  describe("admin note workflow", () => {
    it("creates ADMIN_NOTE market event through API", async () => {
      const response = await postNote(
        adminRequest("http://localhost/api/admin/notes", {
          marketId: marketId("TOP_5"),
          note: "Player questionable for Sunday",
        })
      );

      expect(response.status).toBe(200);

      const events = await prisma.marketEvent.findMany({
        where: { marketId: marketId("TOP_5"), type: "ADMIN_NOTE" },
      });
      expect(events).toHaveLength(1);
      expect(events[0].note).toBe("Player questionable for Sunday");
      expect(events[0].userId).toBe(adminUserId);
    });

    it("rejects admin note for non-existent market", async () => {
      const response = await postNote(
        adminRequest("http://localhost/api/admin/notes", {
          marketId: "non_existent_market",
          note: "Should fail",
        })
      );

      expect(response.status).toBe(400);
    });
  });

  describe("admin authorization boundaries", () => {
    it("rejects non-admin from posting adjustments", async () => {
      const response = await postAdjustment(
        traderRequest("http://localhost/api/admin/adjustments", {
          userId: traderUserId,
          amount: 9999,
          reason: "Unauthorized",
        })
      );

      expect(response.status).toBe(403);
      expect(await getUserBalance(traderUserId)).toBeCloseTo(1000);
    });

    it("rejects non-admin from posting notes", async () => {
      const response = await postNote(
        traderRequest("http://localhost/api/admin/notes", {
          marketId: marketId("TOP_3"),
          note: "Unauthorized note",
        })
      );

      expect(response.status).toBe(403);
    });

    it("rejects non-admin from viewing audit history", async () => {
      const response = await getAuditHistory(
        new Request("http://localhost/api/admin/audit-history", {
          headers: { cookie: `${sessionCookieName}=${traderUserId}` },
        })
      );

      expect(response.status).toBe(403);
    });

    it("rejects non-admin from settling markets", async () => {
      const response = await postSettlement(
        traderRequest("http://localhost/api/settlements", {
          action: "LOCK_MARKET",
          marketId: marketId("TOP_3"),
          reason: "Unauthorized lock",
        })
      );

      expect(response.status).toBe(403);
    });

    it("rejects unauthenticated requests to admin endpoints", async () => {
      const response = await postAdjustment(
        new Request("http://localhost/api/admin/adjustments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: traderUserId,
            amount: 500,
            reason: "No auth",
          }),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe("audit history API", () => {
    it("returns audit logs for admin users", async () => {
      await prisma.$transaction((tx) =>
        lockDbMarket(tx, marketId("TOP_3"), adminUserId, "Test lock for audit")
      );
      await prisma.$transaction((tx) =>
        openDbMarket(tx, marketId("TOP_3"), adminUserId, "Test unlock for audit")
      );

      const response = await getAuditHistory(
        new Request("http://localhost/api/admin/audit-history", {
          headers: { cookie: `${sessionCookieName}=${adminUserId}` },
        })
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        logs: Array<{
          actorName: string;
          action: string;
          reason: string;
          previousState: string;
          nextState: string;
        }>;
      };

      expect(payload.logs.length).toBeGreaterThanOrEqual(2);
      const actions = payload.logs.map((l) => l.action);
      expect(actions).toContain("LOCK");
      expect(actions).toContain("UNLOCK");
    });

    it("filters audit logs by marketId", async () => {
      await prisma.$transaction((tx) =>
        lockDbMarket(tx, marketId("TOP_3"), adminUserId, "Lock TOP_3")
      );
      await prisma.$transaction((tx) =>
        lockDbMarket(tx, marketId("TOP_5"), adminUserId, "Lock TOP_5")
      );

      const response = await getAuditHistory(
        new Request(
          `http://localhost/api/admin/audit-history?marketId=${marketId("TOP_3")}`,
          { headers: { cookie: `${sessionCookieName}=${adminUserId}` } }
        )
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        logs: Array<{ marketId: string }>;
      };
      expect(payload.logs.every((l) => l.marketId === marketId("TOP_3"))).toBe(
        true
      );
    });
  });
});

function makeDbMarket(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  const yesPrice =
    thresholdType === "TOP_3" ? 0.3 : thresholdType === "TOP_5" ? 0.45 : 0.6;
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
    kickoffTime: new Date("2099-09-03T17:00:00.000Z"),
  };
}

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2099,
      week: 2,
      startsAt: new Date("2099-09-08T00:00:00.000Z"),
      endsAt: new Date("2099-09-15T00:00:00.000Z"),
      status: "OPEN",
    },
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "EVT",
      awayTeam: "TST",
      kickoffTime: new Date("2099-09-10T17:00:00.000Z"),
    },
  });

  await prisma.player.create({
    data: {
      id: playerId,
      name: "Event Engine QB",
      team: "EVT",
      position: "QB",
    },
  });

  await prisma.user.create({
    data: {
      id: adminUserId,
      name: "Admin Tester",
      mockBalance: 1000,
      startingBalance: 1000,
      isAdmin: true,
    },
  });

  await prisma.user.create({
    data: {
      id: traderUserId,
      name: "Trader Tester",
      mockBalance: 1000,
      startingBalance: 1000,
      isAdmin: false,
    },
  });

  await prisma.accountLedgerEntry.createMany({
    data: [
      {
        userId: adminUserId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${adminUserId}`,
        reason: "Test seed grant",
        metadata: { test: true },
      },
      {
        userId: traderUserId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${traderUserId}`,
        reason: "Test seed grant",
        metadata: { test: true },
      },
    ],
  });

  await prisma.market.createMany({
    data: [makeDbMarket("TOP_3"), makeDbMarket("TOP_5"), makeDbMarket("TOP_10")],
  });
}

async function resetTestData() {
  await prisma.leaderboardEntry.deleteMany({
    where: {
      OR: [{ weekId }, { userId: adminUserId }, { userId: traderUserId }],
    },
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SET LOCAL fantasyx.allow_ledger_mutation = 'on'"
    );
    await tx.accountLedgerEntry.deleteMany({
      where: { marketId: { startsWith: "test_market_event_engine" } },
    });
    await tx.accountLedgerEntry.deleteMany({
      where: {
        OR: [{ userId: adminUserId }, { userId: traderUserId }],
      },
    });
  });
  await prisma.marketEvent.deleteMany({
    where: { marketId: { startsWith: "test_market_event_engine" } },
  });
  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { marketId: { startsWith: "test_market_event_engine" } },
        { actorId: adminUserId },
      ],
    },
  });
  await prisma.settlement.deleteMany({
    where: { marketId: { startsWith: "test_market_event_engine" } },
  });
  await prisma.trade.deleteMany({
    where: { marketId: { startsWith: "test_market_event_engine" } },
  });
  await prisma.position.deleteMany({
    where: { marketId: { startsWith: "test_market_event_engine" } },
  });
  await prisma.market.deleteMany({
    where: { id: { startsWith: "test_market_event_engine" } },
  });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: adminUserId } });
  await prisma.user.deleteMany({ where: { id: traderUserId } });
}

async function getUserBalance(targetUserId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
  });
  return toNumber(user.mockBalance);
}

function marketId(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  return `test_market_event_engine_${thresholdType.toLowerCase()}`;
}

function adminRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${sessionCookieName}=${adminUserId}`,
    },
    body: JSON.stringify(body),
  });
}

function traderRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${sessionCookieName}=${traderUserId}`,
    },
    body: JSON.stringify(body),
  });
}
