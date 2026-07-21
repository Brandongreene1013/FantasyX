import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { getRateLimiterStatus } from "@/lib/rate-limit-config";

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
  const healthy = database === "ok" && rateLimiter.isConfigured;
  return healthResponse(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database, rateLimiter: rateLimiter.mode }
    },
    healthy ? 200 : 503
  );
}

function healthResponse(body: object, status = 200) {
  const response = NextResponse.json({ ...body, timestamp: new Date().toISOString() }, { status });
  response.headers.set("cache-control", "no-store");
  return response;
}
