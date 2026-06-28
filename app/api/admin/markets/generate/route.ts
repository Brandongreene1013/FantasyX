import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { generateMarketsForWeek } from "@/lib/market-generation.service";
import { z } from "zod";

const GenerateSchema = z.object({
  weekId: z.string().min(1),
  initialStatus: z.enum(["DRAFT", "OPEN"]).optional().default("OPEN"),
  templateIds: z.array(z.string()).optional(),
  playerIds: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const body = await request.json() as unknown;
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error, "Validation failed", 422, request);
    }

    const result = await generateMarketsForWeek({
      ...parsed.data,
      adminId: admin.id
    });

    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error, "Market generation failed", 500, request);
  }
}
