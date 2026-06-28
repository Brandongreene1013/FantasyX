import type { Prisma, TradeSide } from "@prisma/client";
import { executeBuy } from "@/lib/amm";
import type { Market as ClientMarket, Side } from "@/lib/types";
import { toNumber } from "@/lib/db-serialization";
import { applyLedgerBalanceChange } from "@/lib/ledger-service";
import { emitTradeEvents } from "@/lib/market-event.service";
import { DomainError } from "@/lib/domain-errors";

export async function executeDbBuy(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    marketId: string;
    side: TradeSide;
    spend: number;
  }
) {
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
      side: input.side,
      spend: input.spend,
      shares: quote.shares,
      priceBefore: quote.priceBefore,
      priceAfter: quote.priceAfter
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
      yesPrice: quote.priceAfter,
      yesPool: nextMarket.yesPool,
      noPool: nextMarket.noPool,
      volume: nextVolume,
      openInterest: nextOpenInterest
    }
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
