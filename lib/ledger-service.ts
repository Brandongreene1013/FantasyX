import type { LedgerEntryType, Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { toNumber } from "@/lib/db-serialization";

export type LedgerBalanceChangeInput = {
  userId: string;
  type: LedgerEntryType;
  amount: number;
  idempotencyKey: string;
  marketId?: string;
  tradeId?: string;
  settlementId?: string;
  adminId?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
};

export type LedgerReconciliation = {
  userId: string;
  ledgerBalance: number;
  storedBalance: number;
  difference: number;
  isBalanced: boolean;
  entryCount: number;
};

export async function applyLedgerBalanceChange(tx: Prisma.TransactionClient, input: LedgerBalanceChangeInput) {
  const existingEntry = await tx.accountLedgerEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });

  if (existingEntry) {
    throw new Error(`Duplicate ledger idempotency key: ${input.idempotencyKey}`);
  }

  const user = await tx.user.update({
    where: { id: input.userId },
    data: {
      mockBalance: {
        increment: input.amount
      }
    }
  });

  return tx.accountLedgerEntry.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceAfter: user.mockBalance,
      tradeId: input.tradeId,
      settlementId: input.settlementId,
      marketId: input.marketId,
      adminId: input.adminId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? PrismaNamespace.JsonNull
    }
  });
}

export async function createSeedGrantLedgerEntry(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.accountLedgerEntry.create({
    data: {
      userId: input.userId,
      type: "SEED_GRANT",
      amount: input.amount,
      balanceAfter: input.amount,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? PrismaNamespace.JsonNull
    }
  });
}

export async function reconcileUserLedger(tx: Prisma.TransactionClient, userId: string): Promise<LedgerReconciliation> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      mockBalance: true,
      ledgerEntries: {
        orderBy: { createdAt: "asc" },
        select: {
          amount: true
        }
      }
    }
  });

  const ledgerBalance = calculateLedgerBalance(user.ledgerEntries);
  const storedBalance = toNumber(user.mockBalance);

  return {
    userId,
    ledgerBalance,
    storedBalance,
    difference: storedBalance - ledgerBalance,
    isBalanced: cents(ledgerBalance) === cents(storedBalance),
    entryCount: user.ledgerEntries.length
  };
}

export async function reconcileAllLedgers(tx: Prisma.TransactionClient) {
  const users = await tx.user.findMany({ select: { id: true } });
  return Promise.all(users.map((user) => reconcileUserLedger(tx, user.id)));
}

export function calculateLedgerBalance(entries: Array<{ amount: unknown }>) {
  return entries.reduce((total, entry) => total + toNumber(entry.amount), 0);
}

function cents(value: number) {
  return Math.round(value * 100);
}
