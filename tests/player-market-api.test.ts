import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET as getPlayerDetail } from "@/app/api/players/[playerId]/route";
import { sessionCookieName } from "@/lib/session";
import { createSession } from "@/lib/session-store";

const prisma = new PrismaClient();
const weekId = "nfl_2026_w1";
const gameId = "test_game_player_market_api";
const playerId = "test_player_market_api";
const userId = "test_user_player_market_api";
let userSessionCookie = "";

describe("FX026 player market API", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  it("returns grouped threshold markets with account, positions, watch state, and sorted history", async () => {
    const response = await getPlayerDetail(authenticatedRequest(`http://localhost/api/players/${playerId}`), {
      params: Promise.resolve({ playerId })
    });
    const payload = await response.json() as {
      account: { balance: number };
      markets: Array<{
        id: string;
        threshold: string;
        isWatchlisted: boolean;
        position: { yesShares: number; noShares: number; currentValue: number } | null;
        history: Array<{ id: string; createdAt: string; yesPrice: number }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.account.balance).toBe(900);
    expect(payload.markets.map((market) => market.threshold).sort()).toEqual(["TOP_10", "TOP_3", "TOP_5"]);

    const top5 = payload.markets.find((market) => market.threshold === "TOP_5");
    expect(top5?.isWatchlisted).toBe(true);
    expect(top5?.position?.yesShares).toBe(12);
    expect(top5?.position?.currentValue).toBeGreaterThan(0);
    expect(top5?.history.map((point) => point.id)).toContain("opening");
    expect(top5?.history.map((point) => point.id)).toContain("current");

    const historyTimes = top5!.history.map((point) => new Date(point.createdAt).getTime());
    expect(historyTimes).toEqual([...historyTimes].sort((a, b) => a - b));
  });

  it("returns public market data without exposing personalized account state", async () => {
    const response = await getPlayerDetail(new Request(`http://localhost/api/players/${playerId}`), {
      params: Promise.resolve({ playerId })
    });
    const payload = await response.json() as {
      account: { balance: number };
      markets: Array<{ isWatchlisted: boolean; position: unknown | null }>;
    };

    expect(response.status).toBe(200);
    expect(payload.account.balance).toBe(0);
    expect(payload.markets.every((market) => !market.isWatchlisted && market.position === null)).toBe(true);
  });
});

async function createBaseData() {
  await prisma.nflWeek.upsert({
    where: { id: weekId },
    update: {},
    create: {
      id: weekId,
      season: 2026,
      week: 1,
      startsAt: new Date("2026-09-01T00:00:00.000Z"),
      endsAt: new Date("2026-09-08T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "API",
      awayTeam: "OPP",
      kickoffTime: new Date("2099-09-03T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: { id: playerId, name: "API Test Receiver", team: "API", position: "WR" }
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: "Player API User",
      firstName: "Player",
      lastName: "API",
      displayName: "Player API",
      email: "player.api@fantasyx.test",
      passwordHash: "test-password-hash",
      mockBalance: 900,
      startingBalance: 1000
    }
  });

  await prisma.market.createMany({
    data: [
      makeMarket("TOP_3", 0.25),
      makeMarket("TOP_5", 0.45),
      makeMarket("TOP_10", 0.62)
    ]
  });

  await prisma.position.create({
    data: {
      userId,
      marketId: marketId("TOP_5"),
      yesShares: 12,
      noShares: 0,
      costBasis: 8
    }
  });

  await prisma.watchMarket.create({
    data: { userId, marketId: marketId("TOP_5") }
  });

  await prisma.marketPriceHistory.createMany({
    data: [
      {
        marketId: marketId("TOP_5"),
        yesPrice: 0.48,
        noPrice: 0.52,
        liquidity: 500,
        volume: 25,
        openInterest: 5,
        source: "TEST",
        createdAt: new Date("2026-09-01T12:00:00.000Z")
      },
      {
        marketId: marketId("TOP_5"),
        yesPrice: 0.51,
        noPrice: 0.49,
        liquidity: 520,
        volume: 50,
        openInterest: 8,
        source: "TEST",
        createdAt: new Date("2026-09-01T13:00:00.000Z")
      }
    ]
  });

  userSessionCookie = `${sessionCookieName}=${await createSession(userId)}`;
}

function makeMarket(thresholdType: "TOP_3" | "TOP_5" | "TOP_10", yesPrice: number) {
  return {
    id: marketId(thresholdType),
    playerId,
    weekId,
    gameId,
    position: "WR" as const,
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

async function resetTestData() {
  await prisma.marketPriceHistory.deleteMany({ where: { marketId: { startsWith: "test_market_player_api" } } });
  await prisma.watchMarket.deleteMany({ where: { OR: [{ userId }, { marketId: { startsWith: "test_market_player_api" } }] } });
  await prisma.position.deleteMany({ where: { OR: [{ userId }, { marketId: { startsWith: "test_market_player_api" } }] } });
  await prisma.marketEvent.deleteMany({ where: { marketId: { startsWith: "test_market_player_api" } } });
  await prisma.trade.deleteMany({ where: { marketId: { startsWith: "test_market_player_api" } } });
  await prisma.market.deleteMany({ where: { id: { startsWith: "test_market_player_api" } } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function marketId(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  return `test_market_player_api_${thresholdType.toLowerCase()}`;
}

function authenticatedRequest(url: string) {
  return new Request(url, { headers: { cookie: userSessionCookie } });
}
