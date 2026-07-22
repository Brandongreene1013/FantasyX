import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceThresholdOrdering } from "@/lib/seeded-market-repricing.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.REPRICE_MARKETS_TOKEN;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token || token.length < 32 || supplied !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await enforceThresholdOrdering(prisma);
  return NextResponse.json({
    ok: true,
    checked: result.checkedPlayers,
    changed: result.changedMarkets,
    skipped: result.skippedPlayers,
    sample: result.updates.slice(0, 10)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
