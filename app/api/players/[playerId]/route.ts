import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { getSessionUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain-errors";
import { calcSentiment, getIntelligence } from "@/lib/player-intelligence";
import { buildMarketHistoryPoints } from "@/lib/market-analytics.service";

const DEFAULT_WEEK_ID = "nfl_2026_w1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const user = await getSessionUser(request);
    const viewerId = user?.id ?? "__anonymous__";
    const { playerId } = await params;
    const weekId = new URL(request.url).searchParams.get("weekId") ?? DEFAULT_WEEK_ID;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new DomainError("NOT_FOUND", "Player not found", 404);
    }

    const [account, markets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: viewerId },
        select: { mockBalance: true }
      }),
      prisma.market.findMany({
      where: { playerId, weekId },
      include: {
        player: true,
        game: true,
        priceHistory: { orderBy: { createdAt: "asc" } },
        events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        positions: { where: { userId: viewerId } },
        watchedBy: { where: { userId: viewerId }, select: { id: true } }
      },
      orderBy: { thresholdType: "asc" }
      })
    ]);

    const serializedMarkets = markets.map((market) => {
      const serialized = serializeMarket(market);
      const position = market.positions[0] ?? null;
      const yesShares = toNumber(position?.yesShares ?? 0);
      const noShares = toNumber(position?.noShares ?? 0);
      const costBasis = toNumber(position?.costBasis ?? 0);
      const currentValue = yesShares * serialized.yesPrice + noShares * serialized.noPrice;

      return {
        ...serialized,
        isWatchlisted: market.watchedBy.length > 0,
        history: buildMarketHistoryPoints({
          openingPrice: serialized.openingPrice,
          currentYesPrice: serialized.yesPrice,
          currentNoPrice: serialized.noPrice,
          currentLiquidity: serialized.liquidity,
          currentVolume: serialized.volume,
          currentOpenInterest: serialized.openInterest,
          createdAt: market.createdAt.toISOString(),
          updatedAt: market.updatedAt.toISOString(),
          snapshots: market.priceHistory.map((point) => ({
            id: point.id,
            createdAt: point.createdAt.toISOString(),
            yesPrice: toNumber(point.yesPrice),
            noPrice: toNumber(point.noPrice),
            liquidity: toNumber(point.liquidity),
            volume: toNumber(point.volume),
            openInterest: toNumber(point.openInterest)
          })),
          events: market.events.map((event) => ({
            id: event.id,
            createdAt: event.createdAt.toISOString(),
            priceAfter: event.priceAfter === null ? null : toNumber(event.priceAfter),
            liquidity: event.liquidity === null ? null : toNumber(event.liquidity),
            volume: event.volume === null ? null : toNumber(event.volume),
            openInterest: event.openInterest === null ? null : toNumber(event.openInterest)
          }))
        }),
        position: position
          ? {
            yesShares,
            noShares,
            costBasis,
            currentValue,
            unrealizedPnl: currentValue - costBasis
          }
          : null,
        events: market.events.slice(-20).reverse().map((event) => ({
          id: event.id,
          marketId: event.marketId,
          playerName: player.name,
          position: market.position,
          thresholdType: market.thresholdType,
          type: event.type,
          actorName: null,
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
      };
    });

    const playerWithGame = markets[0]
      ? serializePlayerFromMarket(markets[0])
      : { id: player.id, name: player.name, team: player.team, position: player.position as "QB" | "RB" | "WR" | "TE", opponent: "TBD", kickoff: new Date().toISOString(), projection: 0 };

    const opponent = playerWithGame?.opponent ?? "TBD";
    const kickoff = playerWithGame?.kickoff ?? new Date().toISOString();

    const sentiment = calcSentiment(
      serializedMarkets.map((m) => ({
        threshold: m.threshold,
        yesPrice: toNumber(m.yesPrice),
        volume: toNumber(m.volume),
        openInterest: toNumber(m.openInterest)
      }))
    );

    const intelligence = getIntelligence(
      playerId,
      player.position,
      opponent,
      serializedMarkets.map((m) => ({
        threshold: m.threshold,
        yesPrice: toNumber(m.yesPrice),
        volume: toNumber(m.volume),
        openInterest: toNumber(m.openInterest)
      }))
    );

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        opponent,
        kickoff
      },
      account: {
        balance: toNumber(account?.mockBalance ?? 0),
        isAuthenticated: Boolean(user)
      },
      weekId,
      markets: serializedMarkets,
      sentiment,
      intelligence
    });
  } catch (error) {
    return apiError(error, "Could not load player", undefined, request);
  }
}
