import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/csrf";
import { approveBatchSettlement } from "@/lib/settlement-preview.service";
import { z } from "zod";

const BodySchema = z.object({
  weekId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const result = await approveBatchSettlement({
      weekId: parsed.data.weekId,
      adminId: admin.id
    });

    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error, "Batch settlement failed", undefined, request);
  }
}
