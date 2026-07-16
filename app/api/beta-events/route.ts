import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { trackBetaEvent } from "@/lib/beta-events";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit-config";

const BodySchema = z.object({
  type: z.enum(["INVITE_COPY", "MARKET_SHARE"]),
  marketId: z.string().min(1).optional(),
  source: z.string().max(80).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    await enforceRateLimit(RATE_LIMITS.betaEvents, user.id);
    const body = BodySchema.parse(await request.json());

    await trackBetaEvent({
      type: body.type,
      userId: user.id,
      marketId: body.marketId,
      metadata: { source: body.source ?? "client" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Could not track beta event", undefined, request);
  }
}
