import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { parseSearchParams, weekQuerySchema } from "@/lib/api-validation";

export async function GET(request: Request) {
  try {
    const { weekId } = parseSearchParams(weekQuerySchema, request);

    const entries = await prisma.leaderboardEntry.findMany({
      where: { weekId },
      include: { user: true },
      orderBy: [{ rank: "asc" }, { pnl: "desc" }]
    });

    return NextResponse.json({
      weekId,
      entries: entries.map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        name: entry.user.name,
        weeklyPnl: toNumber(entry.pnl),
        totalPnl: toNumber(entry.user.mockBalance) - toNumber(entry.user.startingBalance),
        balance: toNumber(entry.user.mockBalance),
        rank: entry.rank
      }))
    });
  } catch (error) {
    return apiError(error, "Could not load leaderboard");
  }
}
