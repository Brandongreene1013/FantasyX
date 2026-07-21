import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTracked } from "@/lib/operation-log.service";
import { hasValidCronSecret } from "@/lib/cron-auth";
import type { AdminAuditAction } from "@prisma/client";

const SYSTEM_ACTOR = "SYSTEM_CRON";

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTracked("CRON_LOCK_MARKETS", async () => {
      const now = new Date();

      const marketsToLock = await prisma.market.findMany({
        where: { status: "OPEN", kickoffTime: { lte: now } },
        select: { id: true, weekId: true, playerId: true }
      });

      if (marketsToLock.length === 0) {
        return { locked: 0, skipped: 0, message: "No markets past kickoff" };
      }

      // Group by week for audit log
      const byWeek = new Map<string, string[]>();
      for (const m of marketsToLock) {
        if (!byWeek.has(m.weekId)) byWeek.set(m.weekId, []);
        byWeek.get(m.weekId)!.push(m.id);
      }

      await prisma.$transaction(async (tx) => {
        await tx.market.updateMany({
          where: { id: { in: marketsToLock.map((m) => m.id) } },
          data: { status: "LOCKED" }
        });

        for (const [weekId, marketIds] of byWeek) {
          await tx.adminAuditLog.create({
            data: {
              actorId: SYSTEM_ACTOR,
              action: "KICKOFF_LOCK" as AdminAuditAction,
              weekId,
              reason: `Cron auto-locked ${marketIds.length} markets past kickoff`,
              previousState: "OPEN",
              nextState: "LOCKED"
            }
          });
        }
      });

      return { locked: marketsToLock.length, skipped: 0 };
    }, SYSTEM_ACTOR);

    return NextResponse.json({ result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cron lock-markets failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Allow Vercel cron GET pings for health checks
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, endpoint: "lock-markets" });
}
