import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeDbBuy, executeDbSell } from "@/lib/trade.service";
import { apiError } from "@/lib/api-response";
import { tradeSchema } from "@/lib/api-validation";
import { requireSessionUser } from "@/lib/auth";
import { trackBetaEvent } from "@/lib/beta-events";
import { requireCsrf } from "@/lib/csrf";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit-config";

export async function POST(request: Request) {
  try {
    const body = tradeSchema.parse(await request.json());
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    await enforceRateLimit(RATE_LIMITS.trade, user.id);
    const trade = await runSerializableTrade((tx) => {
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

async function runSerializableTrade<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(handler, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableTransactionError(error)) {
        throw error;
      }
    }
  }
  throw new Error("Trade transaction retry failed");
}

function isRetryableTransactionError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    (
      ("code" in error && (error as { code?: string }).code === "P2034") ||
      ("message" in error && typeof (error as { message?: unknown }).message === "string" && (error as { message: string }).message.includes("write conflict"))
    )
  );
}
