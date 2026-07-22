import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import {
  getSignatureConfirmation,
  recordSubmittedBlockchainTransaction
} from "@/lib/blockchain-transaction.service";

const recordSchema = z.object({
  signature: z.string().min(32).max(128),
  walletAddress: z.string().min(32).max(64),
  idempotencyKey: z.string().min(8).max(120),
  memo: z.string().min(1).max(180)
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    const body = recordSchema.parse(await request.json());

    const wallet = await prisma.blockchainWallet.findFirst({
      where: { userId: user.id, address: body.walletAddress, cluster: "DEVNET", status: "ACTIVE" }
    });
    if (!wallet) {
      throw new Error("Verify this devnet wallet before recording a test transaction");
    }

    const transaction = await prisma.$transaction((tx) => recordSubmittedBlockchainTransaction(tx, {
      userId: user.id,
      walletId: wallet.id,
      cluster: "DEVNET",
      kind: "DEVNET_MEMO",
      signature: body.signature,
      idempotencyKey: body.idempotencyKey,
      metadata: {
        memo: body.memo,
        walletAddress: body.walletAddress,
        boundary: "No FantasyX mock balance, position, or ledger entry was mutated."
      }
    }));

    const confirmation = await getSignatureConfirmation(body.signature);
    const updated = await prisma.blockchainTransaction.update({
      where: { id: transaction.id },
      data: {
        status: confirmation.status,
        slot: confirmation.slot,
        error: confirmation.error,
        confirmedAt: confirmation.status === "CONFIRMED" || confirmation.status === "FINALIZED" ? new Date() : null
      }
    });

    return NextResponse.json({
      transaction: {
        id: updated.id,
        kind: updated.kind,
        status: updated.status,
        signature: updated.signature,
        slot: updated.slot?.toString() ?? null,
        createdAt: updated.createdAt.toISOString()
      }
    });
  } catch (error) {
    return apiError(error, "Could not record devnet transaction", undefined, request);
  }
}
