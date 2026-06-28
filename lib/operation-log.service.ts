import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type OperationType =
  | "SYNC_TEAMS"
  | "SYNC_PLAYERS"
  | "SYNC_SCHEDULE"
  | "SYNC_WEEK"
  | "SYNC_EVERYTHING"
  | "KICKOFF_LOCK"
  | "SCORE_IMPORT"
  | "SETTLEMENT_BATCH"
  | "CRON_SYNC_NFL"
  | "CRON_LOCK_MARKETS";

export type OperationStatus = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";

export async function startOperation(type: OperationType, actorId?: string) {
  return prisma.operationLog.create({
    data: { type, status: "RUNNING", actorId }
  });
}

export async function finishOperation(
  id: string,
  status: OperationStatus,
  summary?: Record<string, unknown>,
  error?: string
) {
  const now = new Date();
  const log = await prisma.operationLog.findUnique({ where: { id }, select: { startedAt: true } });
  const durationMs = log ? now.getTime() - log.startedAt.getTime() : undefined;

  return prisma.operationLog.update({
    where: { id },
    data: {
      status,
      finishedAt: now,
      durationMs,
      summary: summary as Prisma.InputJsonValue | undefined,
      error
    }
  });
}

export async function runTracked<T>(
  type: OperationType,
  fn: () => Promise<T>,
  actorId?: string
): Promise<T> {
  const log = await startOperation(type, actorId);
  try {
    const result = await fn();
    await finishOperation(log.id, "SUCCESS", result as Record<string, unknown>);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishOperation(log.id, "FAILED", undefined, msg);
    throw err;
  }
}

export async function getRecentOperations(limit = 20) {
  return prisma.operationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function getLastOperation(type: OperationType) {
  return prisma.operationLog.findFirst({
    where: { type },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLastSuccessfulOperation(type: OperationType) {
  return prisma.operationLog.findFirst({
    where: { type, status: "SUCCESS" },
    orderBy: { createdAt: "desc" }
  });
}
