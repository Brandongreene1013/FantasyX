import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lockDbMarket, openDbMarket, settleDbMarket, settleDbPlayerMarkets } from "@/lib/settlement.service";
import { voidDbMarket } from "@/lib/void.service";
import { apiError } from "@/lib/api-response";
import { settlementSchema } from "@/lib/api-validation";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";

export async function POST(request: Request) {
  try {
    const body = settlementSchema.parse(await request.json());
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const result = await prisma.$transaction(async (tx) => {
      if (body.action === "SETTLE_PLAYER") {
        return settleDbPlayerMarkets(tx, { ...body, settledById: admin.id });
      }
      if (body.action === "SETTLE_MARKET") {
        return settleDbMarket(tx, { ...body, settledById: admin.id });
      }
      if (body.action === "LOCK_MARKET") {
        return lockDbMarket(tx, body.marketId, admin.id, body.reason);
      }
      if (body.action === "OPEN_MARKET") {
        return openDbMarket(tx, body.marketId, admin.id, body.reason);
      }
      return voidDbMarket(tx, body.marketId, admin.id, body.reason);
    });

    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error, "Settlement failed", undefined, request);
  }
}
