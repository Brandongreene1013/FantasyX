import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { toNumber } from "@/lib/db-serialization";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const params = new URL(request.url).searchParams;
    const weekId = params.get("weekId") ?? undefined;
    const playerId = params.get("playerId") ?? undefined;
    const position = params.get("position") ?? undefined;
    const marketId = params.get("marketId") ?? undefined;
    const status = params.get("status") ?? undefined;

    const trades = await prisma.trade.findMany({
      where: {
        userId: user.id,
        marketId,
        market: {
          weekId,
          playerId,
          position: isPosition(position) ? position : undefined,
          status: isStatus(status) ? status : undefined
        }
      },
      include: {
        market: {
          include: {
            player: true,
            week: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json({
      trades: trades.map((trade) => ({
        id: trade.id,
        marketId: trade.marketId,
        playerId: trade.market.playerId,
        playerName: trade.market.player.name,
        weekId: trade.market.weekId,
        week: trade.market.week.week,
        position: trade.market.position,
        thresholdType: trade.market.thresholdType,
        status: trade.market.status,
        side: trade.side,
        executionPrice: toNumber(trade.priceBefore),
        marketPriceAfter: toNumber(trade.priceAfter),
        shares: toNumber(trade.shares),
        cost: toNumber(trade.spend),
        timestamp: trade.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return apiError(error, "Could not load trade history");
  }
}

function isPosition(value: string | undefined): value is "QB" | "RB" | "WR" | "TE" {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

function isStatus(value: string | undefined): value is "OPEN" | "LOCKED" | "SETTLED" | "VOID" {
  return value === "OPEN" || value === "LOCKED" || value === "SETTLED" || value === "VOID";
}
