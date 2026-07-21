import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { getRateLimiterStatus } from "@/lib/rate-limit-config";
import { getProviderStatus } from "@/lib/nfl-data/provider-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("deep") !== "1") {
    return healthResponse({ status: "ok" });
  }

  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const rateLimiter = getRateLimiterStatus();
  const provider = getProviderStatus();
  const latestScore = await prisma.game.findFirst({
    where: { scoreUpdatedAt: { not: null } },
    orderBy: { scoreUpdatedAt: "desc" },
    select: { scoreUpdatedAt: true, scoreProvider: true }
  }).catch(() => null);
  const healthy = database === "ok" && rateLimiter.isConfigured;
  return healthResponse(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        database,
        rateLimiter: rateLimiter.mode,
        liveData: provider.mode,
        liveDataConfigured: provider.mode === "live" && provider.isConfigured,
        latestScoreAt: latestScore?.scoreUpdatedAt ?? null,
        scoreProvider: latestScore?.scoreProvider ?? null
      }
    },
    healthy ? 200 : 503
  );
}

function healthResponse(body: object, status = 200) {
  const response = NextResponse.json({ ...body, timestamp: new Date().toISOString() }, { status });
  response.headers.set("cache-control", "no-store");
  return response;
}
