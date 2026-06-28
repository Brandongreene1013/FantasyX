import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const BodySchema = z.object({
  favoriteTeam:   z.string().max(5).nullable().optional(),
  onboardingDone: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);

    const body = await request.json() as unknown;
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error, "Validation failed", 422, request);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.favoriteTeam !== undefined && { favoriteTeam: parsed.data.favoriteTeam }),
        ...(parsed.data.onboardingDone !== undefined && { onboardingDone: parsed.data.onboardingDone })
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Onboarding update failed", undefined, request);
  }
}
