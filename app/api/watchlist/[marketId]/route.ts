import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const BodySchema = z.object({ action: z.enum(["add", "remove"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    const { marketId } = await params;
    const body = await request.json() as unknown;
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error, "Validation failed", 422, request);

    if (parsed.data.action === "add") {
      await prisma.watchMarket.upsert({
        where: { userId_marketId: { userId: user.id, marketId } },
        update: {},
        create: { userId: user.id, marketId }
      });
    } else {
      await prisma.watchMarket.deleteMany({ where: { userId: user.id, marketId } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Watchlist update failed", undefined, request);
  }
}
