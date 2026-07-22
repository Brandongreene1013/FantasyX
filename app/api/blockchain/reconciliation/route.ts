import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { reconcileIndexedProtocolMarket } from "@/lib/on-chain-reconciliation.service";

const reconciliationSchema = z.object({
  onChainMarketId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    await requireCsrf(request);
    const body = reconciliationSchema.parse(await request.json());
    const run = await prisma.$transaction((tx) => reconcileIndexedProtocolMarket(tx, body.onChainMarketId));

    return NextResponse.json({
      reconciliation: {
        id: run.id,
        status: run.status,
        summary: run.summary,
        checkedAt: run.checkedAt.toISOString()
      }
    });
  } catch (error) {
    return apiError(error, "Could not reconcile on-chain market", undefined, request);
  }
}
