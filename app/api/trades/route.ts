import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertIdempotentTradeReplay, executeDbBuy, executeDbSell } from "@/lib/trade.service";
import { apiError } from "@/lib/api-response";
import { tradeSchema } from "@/lib/api-validation";
import { requireSessionUser } from "@/lib/auth";
import { trackBetaEvent } from "@/lib/beta-events";
import { requireCsrf } from "@/lib/csrf";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit-config";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    await enforceRateLimit(RATE_LIMITS.trade, user.id);
    const body = tradeSchema.parse(await request.json());
    let trade;
    try {
      trade = await runSerializableTrade((tx) => {
        if (body.action === "SELL") {
          return executeDbSell(tx, {
            userId: user.id,
            marketId: body.marketId,
            side: body.side,
            shares: body.shares!,
            idempotencyKey: body.idempotencyKey
          });
        }
        return executeDbBuy(tx, {
          userId: user.id,
          marketId: body.marketId,
          side: body.side,
          spend: body.spend!,
          idempotencyKey: body.idempotencyKey
        });
      });
    } catch (error) {
      if (!body.idempotencyKey || !isUniqueConstraintError(error)) {
        throw error;
      }
      const existing = await prisma.trade.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
      if (!existing) {
        throw error;
      }
      if (body.action === "SELL") {
        assertIdempotentTradeReplay(existing, {
          action: "SELL", userId: user.id, marketId: body.marketId, side: body.side, shares: body.shares!
        });
      } else {
        assertIdempotentTradeReplay(existing, {
          action: "BUY", userId: user.id, marketId: body.marketId, side: body.side, spend: body.spend!
        });
      }
      trade = existing;
    }

    const tradeCount = await prisma.trade.count({ where: { userId: user.id } });
    if (tradeCount === 1) {
      await trackBetaEvent({
        type: "FIRST_TRADE",
        userId: user.id,
        marketId: body.marketId,
        metadata: { action: body.action, side: body.side }
      });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    return apiError(error, "Trade failed", undefined, request);
  }
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

async function runSerializableTrade<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(handler, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableTransactionError(error)) {
        throw error;
      }
      await waitForRetry(attempt);
    }
  }
  throw new Error("Trade transaction retry failed");
}

function isRetryableTransactionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const prismaCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  const message = "message" in error ? (error as { message?: unknown }).message : undefined;
  const meta = "meta" in error ? (error as { meta?: unknown }).meta : undefined;
  const databaseCode = meta && typeof meta === "object" && "code" in meta
    ? (meta as { code?: unknown }).code
    : undefined;

  return prismaCode === "P2034" ||
    databaseCode === "40001" ||
    databaseCode === "40P01" ||
    (typeof message === "string" && (
      message.includes("write conflict") ||
      message.includes("could not serialize access") ||
      message.includes("deadlock detected")
    ));
}

function waitForRetry(attempt: number) {
  const delayMs = attempt * 15 + Math.floor(Math.random() * 20);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
