import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { toNumber } from "@/lib/db-serialization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const weekId = url.searchParams.get("weekId") ?? "nfl_2026_w1";
    const take = Math.min(Number(url.searchParams.get("take") ?? "20"), 50);

    const events = await prisma.marketEvent.findMany({
      where: { type: "TRADE", market: { weekId } },
      include: {
        user: { select: { firstName: true, lastName: true, displayName: true } },
        trade: { select: { action: true, side: true, spend: true } },
        market: { include: { player: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take
    });

    return NextResponse.json({
      events: events.map((e) => {
        const dn = e.user?.displayName;
        const fn = e.user?.firstName ?? "";
        const ln = e.user?.lastName ?? "";
        const actorName = dn?.trim() ? dn : fn ? `${fn} ${ln ? ln[0] + "." : ""}`.trim() : "Trader";
        return {
          id: e.id,
          actorName,
          action: e.trade?.action ?? "BUY",
          side: e.trade?.side ?? "YES",
          spend: e.trade?.spend ? toNumber(e.trade.spend) : 0,
          playerName: e.market.player.name,
          position: e.market.position,
          threshold: e.market.thresholdType,
          marketId: e.marketId,
          priceAfter: e.priceAfter ? toNumber(e.priceAfter) : 0,
          createdAt: e.createdAt.toISOString()
        };
      })
    });
  } catch (error) {
    return apiError(error, "Could not load exchange feed", undefined, request);
  }
}
