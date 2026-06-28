import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { adminNoteSchema } from "@/lib/api-validation";
import { requireAdminUser } from "@/lib/auth";
import { emitAdminNoteEvent, snapshotFromMarket } from "@/lib/market-event.service";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = adminNoteSchema.parse(await request.json());

    const event = await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({
        where: { id: body.marketId },
      });
      if (!market) {
        throw new Error("Market not found");
      }

      return emitAdminNoteEvent(tx, {
        marketId: body.marketId,
        userId: admin.id,
        note: body.note,
        snapshot: snapshotFromMarket(market),
      });
    });

    return NextResponse.json({ event });
  } catch (error) {
    return apiError(error, "Admin note failed");
  }
}
