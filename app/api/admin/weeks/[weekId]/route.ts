import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { updateWeekStatus } from "@/lib/week.service";
import { z } from "zod";

const UpdateWeekSchema = z.object({
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETE", "ARCHIVED"]),
  reason: z.string().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const { weekId } = await params;
    const body = await request.json() as unknown;
    const parsed = UpdateWeekSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const week = await updateWeekStatus(weekId, parsed.data.status, admin.id, parsed.data.reason);
    return NextResponse.json({ week });
  } catch (error) {
    return apiError(error, "Failed to update week", 500, request);
  }
}
