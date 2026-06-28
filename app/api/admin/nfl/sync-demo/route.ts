import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { DemoNflDataProvider } from "@/lib/nfl-data/demo-provider";
import { syncNflData } from "@/lib/nfl-sync.service";

const DEMO_SEASON = 2026;
const DEMO_WEEK   = 1;

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);

    const provider = new DemoNflDataProvider();
    const result   = await syncNflData(provider, DEMO_SEASON, DEMO_WEEK);

    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error, "NFL demo sync failed");
  }
}
