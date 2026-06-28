import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { adminAdjustmentSchema } from "@/lib/api-validation";
import { requireAdminUser } from "@/lib/auth";
import { applyLedgerBalanceChange } from "@/lib/ledger-service";
import { createAdminAuditLog } from "@/lib/exchange-records";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = adminAdjustmentSchema.parse(await request.json());

    const entry = await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: body.userId },
      });
      if (!targetUser) {
        throw new Error("Target user not found");
      }

      const ledgerEntry = await applyLedgerBalanceChange(tx, {
        userId: body.userId,
        type: "ADMIN_ADJUSTMENT",
        amount: body.amount,
        adminId: admin.id,
        idempotencyKey: `admin_adjustment:${admin.id}:${body.userId}:${Date.now()}`,
        reason: body.reason,
        metadata: {
          adjustedBy: admin.name,
          adjustedUserId: body.userId,
          adjustedUserName: targetUser.name,
        },
      });

      await createAdminAuditLog(tx, {
        actorId: admin.id,
        action: "MARKET_EDIT",
        reason: `Admin adjustment: ${body.amount > 0 ? "+" : ""}${body.amount} credits for ${targetUser.name}. ${body.reason}`,
        previousState: `balance:${targetUser.mockBalance}`,
        nextState: `balance:${ledgerEntry.balanceAfter}`,
      });

      return ledgerEntry;
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return apiError(error, "Admin adjustment failed");
  }
}
