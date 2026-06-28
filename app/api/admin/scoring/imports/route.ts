import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { listScoreImports } from "@/lib/score-import.service";
import { z } from "zod";

const QuerySchema = z.object({
  weekId: z.string().min(1, "weekId is required")
});

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const url = new URL(request.url);
    const query = QuerySchema.safeParse({ weekId: url.searchParams.get("weekId") });
    if (!query.success) {
      return apiError(query.error, "Validation failed", 422, request);
    }

    const imports = await listScoreImports(query.data.weekId);
    return NextResponse.json({ imports });
  } catch (error) {
    return apiError(error, "Failed to list score imports", undefined, request);
  }
}
