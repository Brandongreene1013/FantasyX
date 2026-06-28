import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const params = new URL(request.url).searchParams;
    const marketId = params.get("marketId") ?? undefined;
    const action = params.get("action") ?? undefined;
    const actorId = params.get("actorId") ?? undefined;

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        ...(marketId ? { marketId } : {}),
        ...(action ? { action: action as never } : {}),
        ...(actorId ? { actorId } : {}),
      },
      include: {
        actor: { select: { id: true, name: true } },
        market: {
          select: {
            id: true,
            position: true,
            thresholdType: true,
            player: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: log.actor.name,
        action: log.action,
        marketId: log.marketId,
        playerName: log.market?.player.name ?? null,
        position: log.market?.position ?? null,
        thresholdType: log.market?.thresholdType ?? null,
        weekId: log.weekId,
        playerId: log.playerId,
        reason: log.reason,
        previousState: log.previousState,
        nextState: log.nextState,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiError(error, "Could not load audit history");
  }
}
