import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const [weeks, players, games, markets] = await Promise.all([
      prisma.nflWeek.count(),
      prisma.player.count(),
      prisma.game.count(),
      prisma.market.count(),
    ]);

    const playersByStatus = await prisma.player.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const marketsByStatus = await prisma.market.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return NextResponse.json({
      stats: {
        weeks,
        players,
        games,
        markets,
        playersByStatus: Object.fromEntries(
          playersByStatus.map((r) => [r.status, r._count.id])
        ),
        marketsByStatus: Object.fromEntries(
          marketsByStatus.map((r) => [r.status, r._count.id])
        ),
      },
    });
  } catch (error) {
    return apiError(error, "Failed to load NFL stats");
  }
}
