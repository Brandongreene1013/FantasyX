import type { Prisma, Trade, TradeSide } from "@prisma/client";
import { executeBuy, executeSell } from "@/lib/amm";
import type { Market as ClientMarket, Side } from "@/lib/types";
import { toNumber } from "@/lib/db-serialization";
import { applyLedgerBalanceChange } from "@/lib/ledger-service";
import { emitTradeEvents } from "@/lib/market-event.service";
import { recordMarketPriceSnapshot } from "@/lib/market-analytics.service";
import { DomainError } from "@/lib/domain-errors";

export async function executeDbBuy(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    marketId: string;
    side: TradeSide;
    spend: number;
    idempotencyKey?: string;
  }
) {
  if (input.idempotencyKey) {
    const existing = await tx.trade.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      assertIdempotentTradeReplay(existing, { ...input, action: "BUY" });
      return existing;
    }
  }

  await lockUserAndMarket(tx, input.userId, input.marketId);
  const [user, market] = await Promise.all([
    tx.user.findUnique({ where: { id: input.userId } }),
    tx.market.findUnique({ where: { id: input.marketId } })
  ]);

  if (!user) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }
  if (!market) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (market.status !== "OPEN") {
    throw new DomainError("MARKET_NOT_OPEN", "Market is not open", 400);
  }
  assertBeforeKickoff(market.kickoffTime);

  const balance = toNumber(user.mockBalance);
  if (input.spend <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Trade amount must be positive", 400);
  }
  if (input.spend > balance) {
    throw new DomainError("INSUFFICIENT_BALANCE", "Insufficient mock credit balance", 400);
  }

  const executableMarket: ClientMarket = {
    id: market.id,
    playerId: market.playerId,
    week: 1,
    position: market.position,
    threshold: market.thresholdType,
    yesPool: toNumber(market.yesPool),
    noPool: toNumber(market.noPool),
    liquidity: toNumber(market.yesPool) + toNumber(market.noPool),
    status: "OPEN",
    result: market.result
  };

  const { market: nextMarket, quote } = executeBuy(executableMarket, input.side as Side, input.spend);
  const yesPrice = nextMarket.noPool / (nextMarket.yesPool + nextMarket.noPool);
  const noPrice = 1 - yesPrice;
  const nextVolume = toNumber(market.volume) + input.spend;
  const nextOpenInterest = toNumber(market.openInterest) + quote.shares;

  const trade = await tx.trade.create({
    data: {
      userId: input.userId,
      marketId: input.marketId,
      action: "BUY",
      side: input.side,
      spend: input.spend,
      shares: quote.shares,
      priceBefore: quote.priceBefore,
      priceAfter: quote.priceAfter,
      idempotencyKey: input.idempotencyKey
    }
  });

  await tx.market.update({
    where: { id: input.marketId },
    data: {
      yesPool: nextMarket.yesPool,
      noPool: nextMarket.noPool,
      yesPrice,
      noPrice,
      volume: nextVolume,
      openInterest: nextOpenInterest
    }
  });

  await applyLedgerBalanceChange(tx, {
    userId: input.userId,
    type: "TRADE_SPEND",
    amount: -input.spend,
    marketId: input.marketId,
    tradeId: trade.id,
    idempotencyKey: `trade_spend:${trade.id}`,
    reason: `Bought ${input.side} shares`,
    metadata: {
      side: input.side,
      shares: quote.shares,
      priceBefore: quote.priceBefore,
      priceAfter: quote.priceAfter
    }
  });

  await emitTradeEvents(tx, {
    marketId: input.marketId,
    userId: input.userId,
    tradeId: trade.id,
    side: input.side,
    spend: input.spend,
    priceBefore: quote.priceBefore,
    priceAfter: quote.priceAfter,
    snapshot: {
      yesPrice,
      noPrice,
      yesPool: nextMarket.yesPool,
      noPool: nextMarket.noPool,
      volume: nextVolume,
      openInterest: nextOpenInterest
    }
  });

  await recordMarketPriceSnapshot(tx, {
    marketId: input.marketId,
    yesPrice,
    noPrice,
    yesPool: nextMarket.yesPool,
    noPool: nextMarket.noPool,
    volume: nextVolume,
    openInterest: nextOpenInterest,
    source: "TRADE"
  });

  const currentPosition = await tx.position.findUnique({
    where: {
      userId_marketId: { userId: input.userId, marketId: input.marketId }
    }
  });

  await tx.position.upsert({
    where: {
      userId_marketId: { userId: input.userId, marketId: input.marketId }
    },
    create: {
      userId: input.userId,
      marketId: input.marketId,
      yesShares: input.side === "YES" ? quote.shares : 0,
      noShares: input.side === "NO" ? quote.shares : 0,
      costBasis: input.spend
    },
    update: {
      yesShares: toNumber(currentPosition?.yesShares ?? 0) + (input.side === "YES" ? quote.shares : 0),
      noShares: toNumber(currentPosition?.noShares ?? 0) + (input.side === "NO" ? quote.shares : 0),
      costBasis: toNumber(currentPosition?.costBasis ?? 0) + input.spend
    }
  });

  return trade;
}

export async function executeDbSell(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    marketId: string;
    side: TradeSide;
    shares: number;
    idempotencyKey?: string;
  }
) {
  if (input.idempotencyKey) {
    const existing = await tx.trade.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      assertIdempotentTradeReplay(existing, { ...input, action: "SELL" });
      return existing;
    }
  }

  await lockUserAndMarket(tx, input.userId, input.marketId);
  const [user, market, position] = await Promise.all([
    tx.user.findUnique({ where: { id: input.userId } }),
    tx.market.findUnique({ where: { id: input.marketId } }),
    tx.position.findUnique({ where: { userId_marketId: { userId: input.userId, marketId: input.marketId } } })
  ]);

  if (!user) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }
  if (!market) {
    throw new DomainError("NOT_FOUND", "Market not found", 404);
  }
  if (!position) {
    throw new DomainError("INSUFFICIENT_SHARES", "No position found for this market", 400);
  }
  if (market.status !== "OPEN") {
    throw new DomainError("MARKET_NOT_OPEN", "Market is not open", 400);
  }
  assertBeforeKickoff(market.kickoffTime);
  if (input.shares <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Sell quantity must be positive", 400);
  }

  const ownedShares = input.side === "YES" ? toNumber(position.yesShares) : toNumber(position.noShares);
  if (input.shares > ownedShares + 0.000001) {
    throw new DomainError("INSUFFICIENT_SHARES", "Cannot sell more shares than owned", 400);
  }

  const executableMarket = toExecutableMarket(market);
  const { market: nextMarket, quote } = executeSell(executableMarket, input.side as Side, input.shares);
  const yesPrice = nextMarket.noPool / (nextMarket.yesPool + nextMarket.noPool);
  const noPrice = 1 - yesPrice;
  const nextVolume = toNumber(market.volume) + quote.proceeds;
  const nextOpenInterest = Math.max(0, toNumber(market.openInterest) - input.shares);

  const trade = await tx.trade.create({
    data: {
      userId: input.userId,
      marketId: input.marketId,
      action: "SELL",
      side: input.side,
      spend: quote.proceeds,
      shares: input.shares,
      priceBefore: quote.priceBefore,
      priceAfter: quote.priceAfter,
      idempotencyKey: input.idempotencyKey
    }
  });

  await tx.market.update({
    where: { id: input.marketId },
    data: {
      yesPool: nextMarket.yesPool,
      noPool: nextMarket.noPool,
      yesPrice,
      noPrice,
      volume: nextVolume,
      openInterest: nextOpenInterest
    }
  });

  await applyLedgerBalanceChange(tx, {
    userId: input.userId,
    type: "TRADE_PROCEEDS",
    amount: quote.proceeds,
    marketId: input.marketId,
    tradeId: trade.id,
    idempotencyKey: `trade_proceeds:${trade.id}`,
    reason: `Sold ${input.side} shares`,
    metadata: {
      side: input.side,
      shares: input.shares,
      priceBefore: quote.priceBefore,
      priceAfter: quote.priceAfter
    }
  });

  await emitTradeEvents(tx, {
    marketId: input.marketId,
    userId: input.userId,
    tradeId: trade.id,
    side: input.side,
    spend: quote.proceeds,
    priceBefore: quote.priceBefore,
    priceAfter: quote.priceAfter,
    snapshot: {
      yesPrice,
      noPrice,
      yesPool: nextMarket.yesPool,
      noPool: nextMarket.noPool,
      volume: nextVolume,
      openInterest: nextOpenInterest
    }
  });

  await recordMarketPriceSnapshot(tx, {
    marketId: input.marketId,
    yesPrice,
    noPrice,
    yesPool: nextMarket.yesPool,
    noPool: nextMarket.noPool,
    volume: nextVolume,
    openInterest: nextOpenInterest,
    source: "TRADE"
  });

  const yesShares = Math.max(0, toNumber(position.yesShares) - (input.side === "YES" ? input.shares : 0));
  const noShares = Math.max(0, toNumber(position.noShares) - (input.side === "NO" ? input.shares : 0));
  const totalSharesBefore = toNumber(position.yesShares) + toNumber(position.noShares);
  const costBasisBefore = toNumber(position.costBasis);
  const costBasisReduction = totalSharesBefore > 0 ? costBasisBefore * (input.shares / totalSharesBefore) : 0;

  await tx.position.update({
    where: { userId_marketId: { userId: input.userId, marketId: input.marketId } },
    data: {
      yesShares,
      noShares,
      costBasis: Math.max(0, costBasisBefore - costBasisReduction)
    }
  });

  return trade;
}

type TradeReplayInput =
  | { action: "BUY"; userId: string; marketId: string; side: TradeSide; spend: number }
  | { action: "SELL"; userId: string; marketId: string; side: TradeSide; shares: number };

export function assertIdempotentTradeReplay(
  existing: Pick<Trade, "userId" | "marketId" | "action" | "side" | "spend" | "shares">,
  input: TradeReplayInput
) {
  const sameTrade =
    existing.userId === input.userId &&
    existing.marketId === input.marketId &&
    existing.action === input.action &&
    existing.side === input.side &&
    (input.action === "BUY"
      ? nearlyEqual(toNumber(existing.spend), input.spend)
      : nearlyEqual(toNumber(existing.shares), input.shares));

  if (!sameTrade) {
    throw new DomainError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key was already used for a different trade",
      409
    );
  }
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.000001;
}

async function lockUserAndMarket(tx: Prisma.TransactionClient, userId: string, marketId: string) {
  await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "markets" WHERE id = ${marketId} FOR UPDATE`;
}

function assertBeforeKickoff(kickoffTime: Date) {
  if (kickoffTime.getTime() <= Date.now()) {
    throw new DomainError("MARKET_LOCKED", "Market is past kickoff", 400);
  }
}

function toExecutableMarket(market: {
  id: string;
  playerId: string;
  position: ClientMarket["position"];
  thresholdType: ClientMarket["threshold"];
  yesPool: unknown;
  noPool: unknown;
  result: ClientMarket["result"];
}): ClientMarket {
  return {
    id: market.id,
    playerId: market.playerId,
    week: 1,
    position: market.position,
    threshold: market.thresholdType,
    yesPool: toNumber(market.yesPool),
    noPool: toNumber(market.noPool),
    liquidity: toNumber(market.yesPool) + toNumber(market.noPool),
    status: "OPEN",
    result: market.result
  };
}
