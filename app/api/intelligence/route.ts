import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { parseSearchParams, weekQuerySchema } from "@/lib/api-validation";
import { requireSessionUser } from "@/lib/auth";
import { getFantasyIntelligence } from "@/lib/fantasy-intelligence.service";

export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    const { weekId } = parseSearchParams(weekQuerySchema, request);
    const intelligence = await getFantasyIntelligence(weekId);

    return NextResponse.json(intelligence);
  } catch (error) {
    return apiError(error, "Could not load fantasy intelligence", undefined, request);
  }
}
