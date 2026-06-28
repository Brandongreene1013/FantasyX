import type { MarketEventType, Prisma } from "@prisma/client";
import { toNumber } from "@/lib/db-serialization";
import { recordMarketPriceSnapshot } from "@/lib/market-analytics.service";

export type MarketSnapshot = {
  yesPrice: unknown;
  noPrice?: unknown;
  yesPool: unknown;
  noPool: unknown;
  volume: unknown;
  openInterest: unknown;
};

export type EmitMarketEventInput = {
  marketId: string;
  type: MarketEventType;
  userId?: string;
  tradeId?: string;
  settlementId?: string;
  priceBefore?: number;
  priceAfter?: number;
  note?: string;
  snapshot?: MarketSnapshot;
};

export async function emitMarketEvent(
  tx: Prisma.TransactionClient,
  input: EmitMarketEventInput
) {
  const liquidity = input.snapshot
    ? toNumber(input.snapshot.yesPool) + toNumber(input.snapshot.noPool)
    : undefined;
  const volume = input.snapshot ? toNumber(input.snapshot.volume) : undefined;
  const openInterest = input.snapshot
    ? toNumber(input.snapshot.openInterest)
    : undefined;

  const event = await tx.marketEvent.create({
    data: {
      marketId: input.marketId,
      type: input.type,
      userId: input.userId,
      tradeId: input.tradeId,
      settlementId: input.settlementId,
      priceBefore: input.priceBefore,
      priceAfter: input.priceAfter,
      liquidity,
      volume,
      openInterest,
      note: input.note,
    },
  });

  if (input.snapshot) {
    const yesPrice = toNumber(input.snapshot.yesPrice);
    await recordMarketPriceSnapshot(tx, {
      marketId: input.marketId,
      yesPrice,
      noPrice: input.snapshot.noPrice === undefined ? 1 - yesPrice : toNumber(input.snapshot.noPrice),
      yesPool: toNumber(input.snapshot.yesPool),
      noPool: toNumber(input.snapshot.noPool),
      volume: volume ?? 0,
      openInterest: openInterest ?? 0,
      source: input.type
    });
  }

  return event;
}

export function snapshotFromMarket(market: MarketSnapshot): MarketSnapshot {
  return {
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    yesPool: market.yesPool,
    noPool: market.noPool,
    volume: market.volume,
    openInterest: market.openInterest,
  };
}

export async function emitTradeEvents(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId: string;
    tradeId: string;
    side: string;
    spend: number;
    priceBefore: number;
    priceAfter: number;
    snapshot: MarketSnapshot;
  }
) {
  await emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "TRADE",
    userId: input.userId,
    tradeId: input.tradeId,
    priceBefore: input.priceBefore,
    priceAfter: input.priceAfter,
    snapshot: input.snapshot,
    note: `${input.side} buy for ${input.spend.toFixed(2)} mock credits`,
  });

  await emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "PRICE_CHANGE",
    userId: input.userId,
    tradeId: input.tradeId,
    priceBefore: input.priceBefore,
    priceAfter: input.priceAfter,
    snapshot: input.snapshot,
    note: "Price changed after trade execution",
  });
}

export async function emitSettlementEvent(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId?: string;
    settlementId: string;
    result: string;
    reason?: string;
    snapshot: MarketSnapshot;
  }
) {
  return emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "SETTLE",
    userId: input.userId,
    settlementId: input.settlementId,
    priceAfter: toNumber(input.snapshot.yesPrice),
    snapshot: input.snapshot,
    note: input.reason ?? `Market settled ${input.result}`,
  });
}

export async function emitLockEvent(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId?: string;
    reason?: string;
    snapshot: MarketSnapshot;
  }
) {
  return emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "LOCK",
    userId: input.userId,
    priceAfter: toNumber(input.snapshot.yesPrice),
    snapshot: input.snapshot,
    note: input.reason ?? "Market locked",
  });
}

export async function emitUnlockEvent(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId?: string;
    reason?: string;
    snapshot: MarketSnapshot;
  }
) {
  return emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "UNLOCK",
    userId: input.userId,
    priceAfter: toNumber(input.snapshot.yesPrice),
    snapshot: input.snapshot,
    note: input.reason ?? "Market reopened",
  });
}

export async function emitVoidEvent(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId?: string;
    reason?: string;
    snapshot: MarketSnapshot;
  }
) {
  return emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "VOID",
    userId: input.userId,
    priceAfter: toNumber(input.snapshot.yesPrice),
    snapshot: input.snapshot,
    note: input.reason ?? "Market voided",
  });
}

export async function emitAdminNoteEvent(
  tx: Prisma.TransactionClient,
  input: {
    marketId: string;
    userId: string;
    note: string;
    snapshot: MarketSnapshot;
  }
) {
  return emitMarketEvent(tx, {
    marketId: input.marketId,
    type: "ADMIN_NOTE",
    userId: input.userId,
    priceAfter: toNumber(input.snapshot.yesPrice),
    snapshot: input.snapshot,
    note: input.note,
  });
}
