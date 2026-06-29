import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET as getIntelligence } from "@/app/api/intelligence/route";
import { buildMarketIntelligence, buildMarketScanner } from "@/lib/fantasy-intelligence.service";
import { createSession } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";

const prisma = new PrismaClient();
const weekId = "test_week_fantasy_intelligence";
const gameId = "test_game_fantasy_intelligence";
const playerId = "test_player_fantasy_intelligence";
const marketId = "test_market_fantasy_intelligence_top_5";
const userId = "test_user_fantasy_intelligence";

describe("FX019 Fantasy Intelligence Terminal", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  it("builds bull, bear, confidence, trend, and impact intelligence for a market", () => {
    const intelligence = buildMarketIntelligence({
      id: "market_scoring",
      playerId: "player_scoring",
      playerName: "Signal Receiver",
      team: "BUF",
      opponent: "MIA",
      position: "WR",
      threshold: "TOP_5",
      status: "OPEN",
      playerStatus: "QUESTIONABLE",
      yesPrice: 0.68,
      noPrice: 0.32,
      openingPrice: 0.51,
      volume: 900,
      openInterest: 80,
      liquidity: 1200,
      kickoffTime: "2098-09-03T17:00:00.000Z",
      recentTradeCount: 6,
      watchCount: 4
    });

    expect(intelligence.bullCase).toContain("Signal Receiver");
    expect(intelligence.bearCase).toContain("questionable");
    expect(intelligence.confidenceScore).toBeGreaterThan(60);
    expect(intelligence.trendScore).toBeGreaterThan(60);
    expect(intelligence.injuryImpact).toBe("MEDIUM");
    expect(intelligence.historicalSimilarGames).toHaveLength(3);
    expect(intelligence.signals).toContain("Tape active");
  });

  it("ranks scanner sections by trend, conviction, activity, and kickoff risk", () => {
    const quiet = buildMarketIntelligence(baseInput("quiet", { yesPrice: 0.49, openingPrice: 0.5, volume: 10, recentTradeCount: 0 }));
    const active = buildMarketIntelligence(baseInput("active", { yesPrice: 0.7, openingPrice: 0.51, volume: 1000, openInterest: 100, recentTradeCount: 8 }));
    const locking = buildMarketIntelligence(baseInput("locking", { kickoffTime: new Date(Date.now() + 30 * 60 * 1000).toISOString() }));

    const scanner = buildMarketScanner([quiet, active, locking]);

    expect(scanner.trending[0].marketId).toBe("active");
    expect(scanner.highestConviction[0].marketId).toBe("active");
    expect(scanner.mostActive[0].marketId).toBe("active");
    expect(scanner.lockingSoon[0].marketId).toBe("locking");
  });

  it("requires authentication for the fantasy intelligence API", async () => {
    const response = await getIntelligence(new Request(`http://localhost/api/intelligence?weekId=${weekId}`));

    expect(response.status).toBe(401);
  });

  it("returns scanner sections from the protected fantasy intelligence API", async () => {
    const cookie = `${sessionCookieName}=${await createSession(userId)}`;
    const response = await getIntelligence(
      new Request(`http://localhost/api/intelligence?weekId=${weekId}`, { headers: { cookie } })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      weekId: string;
      markets: Array<{ marketId: string; confidenceScore: number; bullCase: string }>;
      scanner: { trending: unknown[]; breaking: unknown[]; sharpMoney: unknown[]; publicMoney: unknown[] };
    };

    expect(body.weekId).toBe(weekId);
    expect(body.markets[0].marketId).toBe(marketId);
    expect(body.markets[0].confidenceScore).toBeGreaterThan(0);
    expect(body.markets[0].bullCase).toContain("Fantasy Intelligence QB");
    expect(body.scanner.trending.length).toBeGreaterThan(0);
    expect(body.scanner.sharpMoney.length).toBeGreaterThan(0);
    expect(body.scanner.publicMoney.length).toBeGreaterThan(0);
  });
});

function baseInput(id: string, overrides: Partial<Parameters<typeof buildMarketIntelligence>[0]> = {}) {
  return {
    id,
    playerId: `player_${id}`,
    playerName: id,
    team: "BUF",
    opponent: "MIA",
    position: "QB" as const,
    threshold: "TOP_5" as const,
    status: "OPEN",
    playerStatus: "ACTIVE",
    yesPrice: 0.52,
    noPrice: 0.48,
    openingPrice: 0.5,
    volume: 100,
    openInterest: 10,
    liquidity: 900,
    kickoffTime: "2098-09-03T17:00:00.000Z",
    recentTradeCount: 1,
    watchCount: 0,
    ...overrides
  };
}

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2199,
      week: 2,
      startsAt: new Date("2098-09-08T00:00:00.000Z"),
      endsAt: new Date("2098-09-15T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "BUF",
      awayTeam: "MIA",
      kickoffTime: new Date("2098-09-10T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: {
      id: playerId,
      name: "Fantasy Intelligence QB",
      team: "BUF",
      position: "QB",
      status: "ACTIVE"
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: "Intelligence User",
      firstName: "Intelligence",
      lastName: "User",
      displayName: "Intelligence User",
      email: "intelligence.user@fantasyx.test",
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
      yesPrice: 0.66,
      noPrice: 0.34,
      openingPrice: 0.48,
      yesPool: 420,
      noPool: 280,
      volume: 880,
      openInterest: 64,
      status: "OPEN",
      kickoffTime: new Date("2098-09-10T17:00:00.000Z")
    }
  });

  await prisma.watchMarket.create({ data: { userId, marketId } });
  await prisma.trade.createMany({
    data: [
      { userId, marketId, action: "BUY", side: "YES", spend: 100, shares: 180, priceBefore: 0.58, priceAfter: 0.62 },
      { userId, marketId, action: "BUY", side: "YES", spend: 80, shares: 120, priceBefore: 0.62, priceAfter: 0.66 }
    ]
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
