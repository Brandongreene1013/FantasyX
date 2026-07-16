import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BetaEventType =
  | "SIGNUP"
  | "REFERRAL_SIGNUP"
  | "ONBOARDING_COMPLETE"
  | "FIRST_TRADE"
  | "MARKET_SHARE"
  | "INVITE_COPY";

type TrackInput = {
  type: BetaEventType;
  userId?: string | null;
  marketId?: string | null;
  referrerId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function trackBetaEvent(input: TrackInput) {
  try {
    await prisma.betaEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        marketId: input.marketId ?? null,
        referrerId: input.referrerId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    });
  } catch {
    // Analytics must never block the core product flow.
  }
}

export async function trackBetaEventTx(tx: Prisma.TransactionClient, input: TrackInput) {
  try {
    await tx.betaEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        marketId: input.marketId ?? null,
        referrerId: input.referrerId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    });
  } catch {
    // Analytics must never block the core product flow.
  }
}
