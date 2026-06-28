import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { createWeek, listWeeksWithCounts } from "@/lib/week.service";
import { z } from "zod";

const CreateWeekSchema = z.object({
  season: z.number().int().min(2020).max(2099),
  week: z.number().int().min(1).max(22),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
});

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const weeks = await listWeeksWithCounts();
    return NextResponse.json({ weeks });
  } catch (error) {
    return apiError(error, "Failed to load weeks", 500, request);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const body = await request.json() as unknown;
    const parsed = CreateWeekSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const week = await createWeek({
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      adminId: admin.id
    });
    return NextResponse.json({ week }, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to create week", 500, request);
  }
}
