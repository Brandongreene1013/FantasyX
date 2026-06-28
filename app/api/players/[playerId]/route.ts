import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain-errors";
import { calcSentiment, getIntelligence } from "@/lib/player-intelligence";

const DEFAULT_WEEK_ID = "nfl_2026_w1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    await requireSessionUser(request);
    const { playerId } = await params;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new DomainError("NOT_FOUND", "Player not found", 404);
    }

    const markets = await prisma.market.findMany({
      where: { playerId, weekId: DEFAULT_WEEK_ID },
      include: { player: true, game: true },
      orderBy: { thresholdType: "asc" }
    });

    const serializedMarkets = markets.map(serializeMarket);

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
      markets: serializedMarkets,
      sentiment,
      intelligence
    });
  } catch (error) {
    return apiError(error, "Could not load player");
  }
}
