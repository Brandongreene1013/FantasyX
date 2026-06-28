import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const { searchParams } = new URL(request.url);
    const weekId   = searchParams.get("weekId") ?? undefined;
    const status   = searchParams.get("status") ?? undefined;
    const position = searchParams.get("position") ?? undefined;

    const markets = await prisma.market.findMany({
      where: {
        ...(weekId   ? { weekId }   : {}),
        ...(status   ? { status: status as never }   : {}),
        ...(position ? { position: position as never } : {})
      },
      include: {
        player: { select: { id: true, name: true, team: true, position: true, status: true } },
        week:   { select: { id: true, season: true, week: true, status: true } },
        game:   { select: { id: true, homeTeam: true, awayTeam: true, kickoffTime: true } },
        _count: { select: { trades: true, positions: true } }
      },
      orderBy: [{ kickoffTime: "asc" }, { position: "asc" }, { thresholdType: "asc" }]
    });

    const serialized = markets.map((m) => ({
      id: m.id,
      weekId: m.weekId,
      season: m.week.season,
      week: m.week.week,
      playerId: m.playerId,
      playerName: m.player.name,
      playerTeam: m.player.team,
      playerStatus: m.player.status,
      position: m.position,
      thresholdType: m.thresholdType,
      status: m.status,
      result: m.result,
      yesPrice: Number(m.yesPrice),
      noPrice: Number(m.noPrice),
      openingPrice: Number(m.openingPrice),
      volume: Number(m.volume),
      openInterest: Number(m.openInterest),
      kickoffTime: m.kickoffTime.toISOString(),
      tradeCount: m._count.trades,
      positionCount: m._count.positions,
      game: m.game
        ? { homeTeam: m.game.homeTeam, awayTeam: m.game.awayTeam, kickoffTime: m.game.kickoffTime.toISOString() }
        : null
    }));

    return NextResponse.json({ markets: serialized });
  } catch (error) {
    return apiError(error, "Failed to load markets", 500, request);
  }
}
