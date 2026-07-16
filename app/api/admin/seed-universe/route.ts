import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { seedFantasyUniverse } from "../../../../prisma/seed";

export const runtime = "nodejs";

const BodySchema = z.object({
  confirm: z.literal("RESET_SEEDED_UNIVERSE")
});

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    await requireCsrf(request);

    const body = BodySchema.parse(await request.json());
    if (body.confirm !== "RESET_SEEDED_UNIVERSE") {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
    }

    await seedFantasyUniverse();

    const [players, markets] = await Promise.all([
      prisma.player.count(),
      prisma.market.count()
    ]);

    return NextResponse.json({ ok: true, players, markets });
  } catch (error) {
    return apiError(error, "Seed universe failed", 500, request);
  }
}
