import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { DomainError } from "@/lib/domain-errors";
import { getMarketAnalytics } from "@/lib/market-analytics.service";
import { getMarketIntelligence } from "@/lib/fantasy-intelligence.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params;

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { player: true, game: true }
    });

    if (!market) {
      throw new DomainError("NOT_FOUND", "Market not found", 404);
    }

    const events = await prisma.marketEvent.findMany({
      where: { marketId },
      include: {
        user: true,
        trade: true,
        settlement: true,
        market: { include: { player: true } }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50
    });

    const [analytics, intelligence] = await Promise.all([
      getMarketAnalytics(marketId),
      getMarketIntelligence(marketId)
    ]);

    return NextResponse.json({
      market: serializeMarket(market),
      player: serializePlayerFromMarket(market),
      history: analytics.history,
      sentiment: analytics.sentiment,
      intelligence,
      events: events.map((event) => ({
        id: event.id,
        marketId: event.marketId,
        playerName: event.market.player.name,
        position: event.market.position,
        thresholdType: event.market.thresholdType,
        type: event.type,
        actorName: event.user?.displayName || event.user?.name || null,
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
    return apiError(error, "Could not load market", undefined, request);
  }
}
