import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { parseSearchParams, weekQuerySchema } from "@/lib/api-validation";
import { summarizeGames } from "@/lib/live-games";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { weekId } = parseSearchParams(weekQuerySchema, request);

    const [markets, liveScores] = await Promise.all([
      prisma.market.findMany({
        where: { weekId },
        include: {
          player: true,
          game: true
        },
        orderBy: [
          { position: "asc" },
          { kickoffTime: "asc" },
          { player: { name: "asc" } },
          { thresholdType: "asc" }
        ]
      }),
      prisma.livePlayerScore.findMany({
        where: { weekId },
        select: { playerId: true, fantasyPoints: true, source: true, updatedAt: true }
      })
    ]);

    const players = new Map(
      markets
        .map(serializePlayerFromMarket)
        .filter((player) => player !== null)
        .map((player) => [player.id, player])
    );

    return NextResponse.json({
      weekId,
      games: summarizeGames(markets),
      players: Array.from(players.values()),
      liveScores: liveScores.map((score) => ({
        playerId: score.playerId,
        fantasyPoints: Number(score.fantasyPoints),
        source: score.source,
        updatedAt: score.updatedAt.toISOString()
      })),
      markets: markets.map(serializeMarket)
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return apiError(error, "Could not load slate", undefined, request);
  }
}
