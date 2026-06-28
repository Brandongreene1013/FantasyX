import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getDashboardAnalytics } from "@/lib/market-analytics.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get("weekId") ?? undefined;
    return NextResponse.json(await getDashboardAnalytics(weekId));
  } catch (error) {
    return apiError(error, "Could not load analytics dashboard");
  }
}
