import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const watches = await prisma.watchMarket.findMany({
      where: { userId: user.id },
      select: { marketId: true }
    });
    return NextResponse.json({ marketIds: watches.map((w) => w.marketId) });
  } catch (error) {
    return apiError(error, "Failed to load watchlist", undefined, request);
  }
}
