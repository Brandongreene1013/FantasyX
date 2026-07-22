import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { middleware } from "@/middleware";
import { GET as getMarketDetail } from "@/app/api/markets/[marketId]/route";
import { createSession } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";

const prisma = new PrismaClient();
const weekId = "test_week_market_board_routing";
const gameId = "test_game_market_board_routing";
const playerId = "test_player_market_board_routing";
const marketId = "test_market_board_routing_top_5";
const userId = "test_user_market_board_routing";

describe("FX016.5 market board routing", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  it("keeps /markets/board as a compatibility redirect to the designated markets view", () => {
    const boardPath = join(process.cwd(), "app", "markets", "board", "page.tsx");
    const dynamicPath = join(process.cwd(), "app", "markets", "[marketId]", "page.tsx");

    expect(existsSync(boardPath)).toBe(true);
    expect(existsSync(dynamicPath)).toBe(true);

    const source = readFileSync(boardPath, "utf8");
    expect(source).toContain('redirect("/markets")');
    expect(source).not.toContain("Market not found");
  });

  it("allows guests to explore /markets/board", () => {
    const response = middleware(new NextRequest("http://localhost/markets/board"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps normal /markets/[marketId] detail lookups working", async () => {
    const cookie = `${sessionCookieName}=${await createSession(userId)}`;
    const response = await getMarketDetail(
      new Request(`http://localhost/api/markets/${marketId}`, { headers: { cookie } }),
      { params: Promise.resolve({ marketId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { market: { id: string }; player: { name: string } };
    expect(body.market.id).toBe(marketId);
    expect(body.player.name).toBe("Board Route QB");
  });
});

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2198,
      week: 1,
      startsAt: new Date("2098-09-01T00:00:00.000Z"),
      endsAt: new Date("2098-09-08T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "BRD",
      awayTeam: "TST",
      kickoffTime: new Date("2098-09-03T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: {
      id: playerId,
      name: "Board Route QB",
      team: "BRD",
      position: "QB"
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: "Board Route User",
      firstName: "Board",
      lastName: "User",
      displayName: "Board Route User",
      email: "board.route.user@fantasyx.test",
      passwordHash: "test-hash",
      mockBalance: 1000,
      startingBalance: 1000
    }
  });

  await prisma.market.create({
    data: {
      id: marketId,
      playerId,
      weekId,
      gameId,
      position: "QB",
      thresholdType: "TOP_5",
      yesPrice: 0.45,
      noPrice: 0.55,
      openingPrice: 0.4,
      yesPool: 275,
      noPool: 225,
      volume: 125,
      openInterest: 25,
      status: "OPEN",
      kickoffTime: new Date("2098-09-03T17:00:00.000Z")
    }
  });
}

async function resetTestData() {
  await prisma.watchMarket.deleteMany({ where: { OR: [{ marketId }, { userId }] } });
  await prisma.marketPriceHistory.deleteMany({ where: { marketId } });
  await prisma.marketEvent.deleteMany({ where: { marketId } });
  await prisma.adminAuditLog.deleteMany({ where: { OR: [{ marketId }, { actorId: userId }] } });
  await prisma.settlement.deleteMany({ where: { marketId } });
  await prisma.trade.deleteMany({ where: { marketId } });
  await prisma.position.deleteMany({ where: { marketId } });
  await prisma.leaderboardEntry.deleteMany({ where: { OR: [{ weekId }, { userId }] } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { OR: [{ marketId }, { userId }] } });
  });
  await prisma.market.deleteMany({ where: { id: marketId } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}
