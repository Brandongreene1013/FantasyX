import type { Market as DbMarket, MarketResult, Prisma, ThresholdType } from "@prisma/client";
import { toNumber } from "@/lib/db-serialization";
import { applyLedgerBalanceChange } from "@/lib/ledger-service";
import { createAdminAuditLog } from "@/lib/exchange-records";
import {
  emitSettlementEvent,
  emitLockEvent,
  emitUnlockEvent,
  snapshotFromMarket
} from "@/lib/market-event.service";
import { refreshLeaderboardForWeek } from "@/lib/leaderboard.service";
import { DomainError } from "@/lib/domain-errors";

export async function settleDbMarket(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    result: MarketResult;
    settledById?: string;
    fantasyPoints?: number;
    positionalRank?: number;
    reason?: string;
  }
) {
  const existingMarket = await tx.market.findUnique({
    where: { id: input.marketId },
    include: { positions: true }
  });

  if (!existingMarket) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (existingMarket.status === "SETTLED") {
    throw new DomainError("MARKET_ALREADY_SETTLED", "Market is already settled", 409);
  }
  if (existingMarket.status === "VOID") {
    throw new DomainError("INVALID_MARKET_TRANSITION", "Voided market cannot be settled", 409);
  }

  const market = await tx.market.update({
    where: { id: input.marketId },
    data: { status: "SETTLED", result: input.result }
  });

  const settlement = await tx.settlement.upsert({
    where: { marketId: input.marketId },
    create: {
      marketId: input.marketId,
      settledById: input.settledById,
      result: input.result,
      fantasyPoints: input.fantasyPoints,
      positionalRank: input.positionalRank
    },
    update: {
      settledById: input.settledById,
      result: input.result,
      fantasyPoints: input.fantasyPoints,
      positionalRank: input.positionalRank,
      settledAt: new Date()
    }
  });

  await emitSettlementEvent(tx, {
    marketId: input.marketId,
    userId: input.settledById,
    settlementId: settlement.id,
    result: input.result,
    reason: input.reason,
    snapshot: snapshotFromMarket(existingMarket)
  });

  if (input.settledById) {
    await createAdminAuditLog(tx, {
      actorId: input.settledById,
      action: "SETTLEMENT",
      marketId: input.marketId,
      weekId: existingMarket.weekId,
      playerId: existingMarket.playerId,
      reason: input.reason ?? `Market settled ${input.result}`,
      previousState: existingMarket.status,
      nextState: `SETTLED:${input.result}`
    });
  }

  await payWinningPositions(tx, existingMarket, input.result, settlement.id, input.settledById);
  await refreshLeaderboardForWeek(tx, existingMarket.weekId);

  return market;
}

export async function settleDbPlayerMarkets(
  tx: Prisma.TransactionClient,
  input: {
    playerId: string;
    weekId: string;
    rank: number;
    settledById?: string;
    fantasyPoints?: number;
    reason?: string;
  }
) {
  const markets = await tx.market.findMany({
    where: { playerId: input.playerId, weekId: input.weekId },
    include: { positions: true }
  });

  if (markets.length === 0) {
    throw new DomainError("NOT_FOUND", "No markets found for player and week", 404);
  }

  const settled = [];
  for (const market of markets) {
    if (market.status === "SETTLED" || market.status === "VOID") {
      continue;
    }

    const result = input.rank <= thresholdToRank(market.thresholdType) ? "YES" : "NO";
    const updated = await tx.market.update({
      where: { id: market.id },
      data: { status: "SETTLED", result }
    });

    const settlement = await tx.settlement.upsert({
      where: { marketId: market.id },
      create: {
        marketId: market.id,
        settledById: input.settledById,
        result,
        fantasyPoints: input.fantasyPoints,
        positionalRank: input.rank
      },
      update: {
        settledById: input.settledById,
        result,
        fantasyPoints: input.fantasyPoints,
        positionalRank: input.rank,
        settledAt: new Date()
      }
    });

    await emitSettlementEvent(tx, {
      marketId: market.id,
      userId: input.settledById,
      settlementId: settlement.id,
      result,
      reason: input.reason ?? `Player rank ${input.rank} settled market ${result}`,
      snapshot: snapshotFromMarket(market)
    });

    if (input.settledById) {
      await createAdminAuditLog(tx, {
        actorId: input.settledById,
        action: "SETTLEMENT",
        marketId: market.id,
        weekId: market.weekId,
        playerId: market.playerId,
        reason: input.reason ?? `Player rank ${input.rank}`,
        previousState: market.status,
        nextState: `SETTLED:${result}`
      });
    }

    await payWinningPositions(tx, market, result, settlement.id, input.settledById);
    settled.push(updated);
  }

  await refreshLeaderboardForWeek(tx, input.weekId);
  return settled;
}

export async function lockDbMarket(
  tx: Prisma.TransactionClient,
  marketId: string,
  actorId?: string,
  reason?: string
) {
  const market = await tx.market.findUnique({ where: { id: marketId } });
  if (!market) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (market.status === "SETTLED" || market.status === "VOID") {
    throw new DomainError("INVALID_MARKET_TRANSITION", "Finalized market cannot be locked", 409);
  }

  const updated = await tx.market.update({ where: { id: marketId }, data: { status: "LOCKED" } });

  await emitLockEvent(tx, {
    marketId,
    userId: actorId,
    reason,
    snapshot: snapshotFromMarket(market)
  });

  if (actorId) {
    await createAdminAuditLog(tx, {
      actorId,
      action: "LOCK",
      marketId,
      weekId: market.weekId,
      playerId: market.playerId,
      reason: reason ?? "Market locked",
      previousState: market.status,
      nextState: updated.status
    });
  }

  return updated;
}

export async function openDbMarket(
  tx: Prisma.TransactionClient,
  marketId: string,
  actorId?: string,
  reason?: string
) {
  const market = await tx.market.findUnique({ where: { id: marketId } });
  if (!market) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (market.status !== "LOCKED") {
    throw new DomainError("INVALID_MARKET_TRANSITION", "Only locked markets can be reopened", 409);
  }

  const updated = await tx.market.update({ where: { id: marketId }, data: { status: "OPEN" } });

  await emitUnlockEvent(tx, {
    marketId,
    userId: actorId,
    reason,
    snapshot: snapshotFromMarket(market)
  });

  if (actorId) {
    await createAdminAuditLog(tx, {
      actorId,
      action: "UNLOCK",
      marketId,
      weekId: market.weekId,
      playerId: market.playerId,
      reason: reason ?? "Market reopened",
      previousState: market.status,
      nextState: updated.status
    });
  }

  return updated;
}

async function payWinningPositions(
  tx: Prisma.TransactionClient,
  market: DbMarket & { positions: Array<{ id: string; userId: string; yesShares: unknown; noShares: unknown; realizedPayout: unknown }> },
  result: MarketResult,
  settlementId: string,
  adminId?: string
) {
  for (const position of market.positions) {
    if (toNumber(position.realizedPayout) > 0) {
      continue;
    }

    const payout = result === "YES" ? toNumber(position.yesShares) : toNumber(position.noShares);
    if (payout <= 0) {
      await tx.position.update({
        where: { id: position.id },
        data: { realizedPayout: 0 }
      });
      continue;
    }

    await applyLedgerBalanceChange(tx, {
      userId: position.userId,
      type: "SETTLEMENT_PAYOUT",
      amount: payout,
      marketId: market.id,
      settlementId,
      adminId,
      idempotencyKey: `settlement_payout:${settlementId}:${position.userId}`,
      reason: `Winning ${result} shares paid`,
      metadata: {
        positionId: position.id,
        result,
        yesShares: toNumber(position.yesShares),
        noShares: toNumber(position.noShares)
      }
    });

    await tx.position.update({
      where: { id: position.id },
      data: { realizedPayout: payout }
    });
  }
}

function thresholdToRank(threshold: ThresholdType) {
  if (threshold === "TOP_3") return 3;
  if (threshold === "TOP_5") return 5;
  return 10;
}
