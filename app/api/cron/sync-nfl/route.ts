import { NextResponse } from "next/server";
import { getConfiguredProvider } from "@/lib/nfl-data/provider-config";
import { syncNflData } from "@/lib/nfl-sync.service";
import { runTracked } from "@/lib/operation-log.service";

const SYSTEM_ACTOR = "SYSTEM_CRON";
const DEMO_SEASON = 2026;
const DEMO_WEEK = 1;

function validateCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const altHeader = request.headers.get("x-cron-secret") ?? "";
  return altHeader === cronSecret;
}

export async function POST(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTracked("CRON_SYNC_NFL", async () => {
      const provider = getConfiguredProvider();

      // Determine current season/week from provider if possible
      let season = DEMO_SEASON;
      let week = DEMO_WEEK;

      try {
        const weeks = await provider.getWeeks(season);
        if (weeks.length > 0) {
          season = weeks[0].season;
          week = weeks[0].week;
        }
      } catch {
        // fall back to defaults
      }

      const syncResult = await syncNflData(provider, season, week);
      return syncResult;
    }, SYSTEM_ACTOR);

    return NextResponse.json({ result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cron sync-nfl failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, endpoint: "sync-nfl" });
}
