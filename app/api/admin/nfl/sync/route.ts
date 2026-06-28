import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/csrf";
import { getConfiguredProvider, getProviderStatus } from "@/lib/nfl-data/provider-config";
import { syncNflData } from "@/lib/nfl-sync.service";
import { runTracked } from "@/lib/operation-log.service";
import { z } from "zod";

const BodySchema = z.object({
  season: z.number().int().min(2020).max(2099).optional(),
  week:   z.number().int().min(1).max(22).optional(),
  op:     z.enum(["teams", "players", "schedule", "week", "everything"]).default("everything")
});

const DEMO_SEASON = 2026;
const DEMO_WEEK   = 1;

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const body = await request.json() as unknown;
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const status = getProviderStatus();
    const provider = getConfiguredProvider();

    const season = parsed.data.season ?? DEMO_SEASON;
    const week   = parsed.data.week   ?? DEMO_WEEK;
    const op     = parsed.data.op;

    const opType = op === "everything" ? "SYNC_EVERYTHING"
      : op === "players"  ? "SYNC_PLAYERS"
      : op === "teams"    ? "SYNC_TEAMS"
      : op === "schedule" ? "SYNC_SCHEDULE"
      : "SYNC_WEEK";

    const result = await runTracked(opType as Parameters<typeof runTracked>[0], async () => {
      return syncNflData(provider, season, week);
    }, admin.id);

    return NextResponse.json({ result, providerName: status.name });
  } catch (error) {
    return apiError(error, "NFL sync failed", undefined, request);
  }
}
