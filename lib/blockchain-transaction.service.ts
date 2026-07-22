import type { BlockchainCluster, BlockchainTransactionKind, Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { createSolanaConnection } from "@/packages/solana-client/src";

export async function recordSubmittedBlockchainTransaction(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    kind: BlockchainTransactionKind;
    cluster: BlockchainCluster;
    signature: string;
    idempotencyKey: string;
    walletId?: string;
    referenceId?: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  const existing = await tx.blockchainTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });
  if (existing) {
    if (existing.userId !== input.userId || existing.signature !== input.signature || existing.kind !== input.kind) {
      throw new Error("Blockchain transaction idempotency key was already used for a different transaction");
    }
    return existing;
  }

  return tx.blockchainTransaction.create({
    data: {
      userId: input.userId,
      walletId: input.walletId,
      kind: input.kind,
      cluster: input.cluster,
      signature: input.signature,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.referenceId,
      status: "SUBMITTED",
      submittedAt: new Date(),
      metadata: input.metadata ?? PrismaNamespace.JsonNull
    }
  });
}

export async function getSignatureConfirmation(signature: string) {
  const connection = createSolanaConnection();
  const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  const value = status.value;
  if (!value) {
    return { status: "SUBMITTED" as const, slot: null, error: null };
  }
  if (value.err) {
    return { status: "FAILED" as const, slot: BigInt(value.slot), error: JSON.stringify(value.err) };
  }
  if (value.confirmationStatus === "finalized") {
    return { status: "FINALIZED" as const, slot: BigInt(value.slot), error: null };
  }
  return { status: "CONFIRMED" as const, slot: BigInt(value.slot), error: null };
}
