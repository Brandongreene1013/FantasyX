import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import type { AdminAuditAction } from "@prisma/client";
import { z } from "zod";

const BodySchema = z.object({
  weekId: z.string().min(1).optional()
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

    const now = new Date();

    // Find all OPEN markets where kickoff has passed
    const marketsToLock = await prisma.market.findMany({
      where: {
        status: "OPEN",
        kickoffTime: { lte: now },
        ...(parsed.data.weekId ? { weekId: parsed.data.weekId } : {})
      },
      select: { id: true, weekId: true, playerId: true }
    });

    if (marketsToLock.length === 0) {
      return NextResponse.json({ result: { locked: 0, message: "No markets past kickoff" } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.market.updateMany({
        where: { id: { in: marketsToLock.map((m) => m.id) } },
        data: { status: "LOCKED" }
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: admin.id,
          action: "KICKOFF_LOCK" as AdminAuditAction,
          weekId: parsed.data.weekId,
          reason: `Auto-locked ${marketsToLock.length} markets past kickoff`,
          previousState: "OPEN",
          nextState: "LOCKED"
        }
      });
    });

    return NextResponse.json({ result: { locked: marketsToLock.length } });
  } catch (error) {
    return apiError(error, "Kickoff lock failed", undefined, request);
  }
}
