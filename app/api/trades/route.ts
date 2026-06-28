import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeDbBuy } from "@/lib/trade.service";
import { apiError } from "@/lib/api-response";
import { tradeSchema } from "@/lib/api-validation";
import { requireSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = tradeSchema.parse(await request.json());
    const user = await requireSessionUser(request);
    const trade = await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId: user.id,
        marketId: body.marketId,
        side: body.side,
        spend: body.spend
      })
    );

    return NextResponse.json({ trade });
  } catch (error) {
    return apiError(error, "Trade failed", undefined, request);
  }
}
