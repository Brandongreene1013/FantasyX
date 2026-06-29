import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { toNumber } from "@/lib/db-serialization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const weekId = url.searchParams.get("weekId") ?? "nfl_2026_w1";

    const [marketCounts, volAgg, activeTraders] = await Promise.all([
      prisma.market.groupBy({
        by: ["status"],
        where: { weekId },
        _count: { status: true }
      }),
      prisma.market.aggregate({
        where: { weekId },
        _sum: { volume: true }
      }),
      prisma.trade.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        distinct: ["userId"],
        select: { userId: true }
      })
    ]);

    const counts: Record<string, number> = {};
    for (const g of marketCounts) counts[g.status] = g._count.status;

    return NextResponse.json({
      weekId,
      weekLabel: "Week 1",
      isLive: (counts["OPEN"] ?? 0) > 0,
      openMarkets: counts["OPEN"] ?? 0,
      lockedMarkets: counts["LOCKED"] ?? 0,
      settledMarkets: counts["SETTLED"] ?? 0,
      awaitingSettlement: counts["LOCKED"] ?? 0,
      totalVolume: toNumber(volAgg._sum.volume ?? 0),
      activeTraders: activeTraders.length
    });
  } catch (error) {
    return apiError(error, "Could not load exchange status", undefined, request);
  }
}
