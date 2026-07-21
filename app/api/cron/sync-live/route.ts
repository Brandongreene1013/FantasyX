import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { requireConfiguredLiveProvider } from "@/lib/nfl-data/provider-config";
import { syncLiveGameScores } from "@/lib/live-score-sync.service";
import { runTracked } from "@/lib/operation-log.service";
import { prisma } from "@/lib/prisma";

const SYSTEM_ACTOR = "SYSTEM_CRON";

async function sync(request: Request) {
  if (!hasValidCronSecret(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const target = await resolveTargetWeek(request);
    if (!target) return NextResponse.json({ error: "No NFL week is available for live score sync." }, { status: 404 });
    const provider = requireConfiguredLiveProvider();
    const result = await runTracked("CRON_SYNC_LIVE", () => syncLiveGameScores(provider, target.season, target.week), SYSTEM_ACTOR);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live score sync failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

async function resolveTargetWeek(request: Request) {
  const url = new URL(request.url);
  const season = Number(url.searchParams.get("season"));
  const week = Number(url.searchParams.get("week"));
  if (Number.isInteger(season) && season >= 2020 && season <= 2099 && Number.isInteger(week) && week >= 1 && week <= 22) {
    return { season, week };
  }

  const now = new Date();
  return prisma.nflWeek.findFirst({
    where: { endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    select: { season: true, week: true }
  });
}

export const GET = sync;
export const POST = sync;
