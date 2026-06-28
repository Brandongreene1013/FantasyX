import type { Prisma } from "@prisma/client";
import { toNumber } from "@/lib/db-serialization";
import { applyLedgerBalanceChange } from "@/lib/ledger-service";
import { createAdminAuditLog } from "@/lib/exchange-records";
import { emitVoidEvent, snapshotFromMarket } from "@/lib/market-event.service";
import { refreshLeaderboardForWeek } from "@/lib/leaderboard.service";
import { DomainError } from "@/lib/domain-errors";

export async function voidDbMarket(
  tx: Prisma.TransactionClient,
  marketId: string,
  actorId?: string,
  reason?: string
) {
  const market = await tx.market.findUnique({
    where: { id: marketId },
    include: { positions: true }
  });

  if (!market) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (market.status === "SETTLED") {
    throw new DomainError("INVALID_MARKET_TRANSITION", "Settled market cannot be voided", 409);
  }
  if (market.status === "VOID") {
    throw new DomainError("MARKET_ALREADY_VOID", "Market is already void", 409);
  }

  const updated = await tx.market.update({
    where: { id: marketId },
    data: { status: "VOID", result: null }
  });

  await emitVoidEvent(tx, {
    marketId,
    userId: actorId,
    reason,
    snapshot: snapshotFromMarket(market)
  });

  if (actorId) {
    await createAdminAuditLog(tx, {
      actorId,
      action: "VOID",
      marketId,
      weekId: market.weekId,
      playerId: market.playerId,
      reason: reason ?? "Market voided",
      previousState: market.status,
      nextState: "VOID"
    });
  }

  for (const position of market.positions) {
    if (toNumber(position.realizedPayout) > 0) {
      continue;
    }
    const refund = toNumber(position.costBasis);
    if (refund <= 0) {
      continue;
    }

    await applyLedgerBalanceChange(tx, {
      userId: position.userId,
      type: "VOID_REFUND",
      amount: refund,
      marketId,
      adminId: actorId,
      idempotencyKey: `void_refund:${marketId}:${position.userId}`,
      reason: reason ?? "Market void refund",
      metadata: {
        positionId: position.id,
        costBasis: refund
      }
    });

    await tx.position.update({
      where: { id: position.id },
      data: { realizedPayout: refund }
    });
  }

  await refreshLeaderboardForWeek(tx, market.weekId);
  return updated;
}
