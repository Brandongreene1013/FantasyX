import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { bulkMarketAction } from "@/lib/market-generation.service";
import { z } from "zod";

const BulkActionSchema = z.object({
  weekId: z.string().min(1),
  action: z.enum(["OPEN", "LOCK", "VOID", "ARCHIVE"]),
  reason: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const body = await request.json() as unknown;
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const result = await bulkMarketAction(parsed.data.weekId, parsed.data.action, admin.id, parsed.data.reason);
    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error, "Bulk action failed", 500, request);
  }
}
