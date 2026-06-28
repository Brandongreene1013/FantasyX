import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/db-serialization";

export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    const params = new URL(request.url).searchParams;
    const marketId = params.get("marketId") ?? undefined;
    const weekId = params.get("weekId") ?? undefined;

    const events = await prisma.marketEvent.findMany({
      where: {
        marketId,
        market: { weekId }
      },
      include: {
        user: true,
        trade: true,
        settlement: true,
        market: {
          include: { player: true }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    });

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        marketId: event.marketId,
        playerName: event.market.player.name,
        position: event.market.position,
        thresholdType: event.market.thresholdType,
        type: event.type,
        actorName: event.user?.name ?? null,
        tradeId: event.tradeId,
        settlementId: event.settlementId,
        priceBefore: event.priceBefore === null ? null : toNumber(event.priceBefore),
        priceAfter: event.priceAfter === null ? null : toNumber(event.priceAfter),
        liquidity: event.liquidity === null ? null : toNumber(event.liquidity),
        volume: event.volume === null ? null : toNumber(event.volume),
        openInterest: event.openInterest === null ? null : toNumber(event.openInterest),
        note: event.note,
        createdAt: event.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return apiError(error, "Could not load market events", undefined, request);
  }
}
