import type { AdminAuditAction, Prisma } from "@prisma/client";

export async function createAdminAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    action: AdminAuditAction;
    marketId?: string;
    weekId?: string;
    playerId?: string;
    reason?: string;
    previousState?: string;
    nextState?: string;
  }
) {
  return tx.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      marketId: input.marketId,
      weekId: input.weekId,
      playerId: input.playerId,
      reason: input.reason,
      previousState: input.previousState,
      nextState: input.nextState
    }
  });
}
