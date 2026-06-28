import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const url = new URL(request.url);
    const weekId = url.searchParams.get("weekId");

    // Find the active/current week if not specified
    const activeWeek = weekId
      ? await prisma.nflWeek.findUnique({ where: { id: weekId } })
      : await prisma.nflWeek.findFirst({ where: { status: "ACTIVE" }, orderBy: { season: "desc" } }) ??
        await prisma.nflWeek.findFirst({ orderBy: [{ season: "desc" }, { week: "desc" }] });

    if (!activeWeek) {
      return NextResponse.json({
        operations: null,
        message: "No weeks found. Create a week first."
      });
    }

    const now = new Date();

    const [
      allMarkets,
      gamesCount,
      lastImport,
      lastSync
    ] = await Promise.all([
      prisma.market.findMany({
        where: { weekId: activeWeek.id },
        select: { status: true, kickoffTime: true }
      }),
      prisma.game.count({ where: { weekId: activeWeek.id, kickoffTime: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
      prisma.scoreImport.findFirst({
        where: { weekId: activeWeek.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, status: true, rowCount: true }
      }),
      prisma.adminAuditLog.findFirst({
        where: { action: { in: ["BULK_OPEN", "BULK_LOCK", "MARKET_CREATE"] as const } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true }
      })
    ]);

    const marketsByStatus = allMarkets.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});

    const pastKickoff = allMarkets.filter(
      (m) => m.status === "OPEN" && m.kickoffTime.getTime() <= now.getTime()
    ).length;

    // Score coverage
    const playerIds = await prisma.market.findMany({
      where: { weekId: activeWeek.id },
      select: { playerId: true },
      distinct: ["playerId"]
    });
    const scoredCount = await prisma.playerScore.count({
      where: { weekId: activeWeek.id, playerId: { in: playerIds.map((p) => p.playerId) } }
    });

    const total = allMarkets.length;
    const settled = marketsByStatus["SETTLED"] ?? 0;
    const settlementProgress = total > 0 ? Math.round((settled / total) * 100) : 0;

    return NextResponse.json({
      operations: {
        week: {
          id: activeWeek.id,
          season: activeWeek.season,
          week: activeWeek.week,
          status: activeWeek.status,
          startsAt: activeWeek.startsAt,
          endsAt: activeWeek.endsAt
        },
        markets: {
          total,
          open:     marketsByStatus["OPEN"]     ?? 0,
          draft:    marketsByStatus["DRAFT"]     ?? 0,
          locked:   marketsByStatus["LOCKED"]    ?? 0,
          settled,
          void:     marketsByStatus["VOID"]      ?? 0,
          scheduled: marketsByStatus["SCHEDULED"] ?? 0,
          pastKickoffOpen: pastKickoff
        },
        players: {
          total: playerIds.length,
          withScores: scoredCount,
          awaitingScores: playerIds.length - scoredCount
        },
        games: {
          today: gamesCount
        },
        settlement: {
          progress: settlementProgress,
          settled,
          remaining: total - settled
        },
        lastImport: lastImport
          ? { at: lastImport.createdAt, status: lastImport.status, rowCount: lastImport.rowCount }
          : null,
        lastSync: lastSync
          ? { at: lastSync.createdAt, action: lastSync.action }
          : null
      }
    });
  } catch (error) {
    return apiError(error, "Failed to load operations data", undefined, request);
  }
}
