import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { parseSearchParams, weekQuerySchema } from "@/lib/api-validation";

export async function GET(request: Request) {
  try {
    const { weekId } = parseSearchParams(weekQuerySchema, request);

    const markets = await prisma.market.findMany({
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
    });

    const players = new Map(
      markets
        .map(serializePlayerFromMarket)
        .filter((player) => player !== null)
        .map((player) => [player.id, player])
    );

    return NextResponse.json({
      weekId,
      players: Array.from(players.values()),
      markets: markets.map(serializeMarket)
    });
  } catch (error) {
    return apiError(error, "Could not load slate");
  }
}
