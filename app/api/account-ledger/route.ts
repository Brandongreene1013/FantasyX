import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/db-serialization";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const entries = await prisma.accountLedgerEntry.findMany({
      where: { userId: user.id },
      include: {
        market: { include: { player: true } },
        admin: true,
        trade: true,
        settlement: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json({
      entries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: toNumber(entry.amount),
        balanceAfter: toNumber(entry.balanceAfter),
        reason: entry.reason,
        idempotencyKey: entry.idempotencyKey,
        tradeId: entry.tradeId,
        settlementId: entry.settlementId,
        marketId: entry.marketId,
        adminId: entry.adminId,
        adminName: entry.admin?.name ?? null,
        playerName: entry.market?.player.name ?? null,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return apiError(error, "Could not load account ledger", undefined, request);
  }
}
