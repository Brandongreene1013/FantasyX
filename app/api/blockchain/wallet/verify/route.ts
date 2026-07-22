import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { verifyWalletSignature } from "@/packages/solana-client/src";

const verifySchema = z.object({
  challengeId: z.string().min(1),
  address: z.string().min(32).max(64),
  signature: z.string().min(32).max(256)
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    const body = verifySchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.walletChallenge.findUnique({ where: { id: body.challengeId } });
      if (!challenge || challenge.userId !== user.id || challenge.address !== body.address) {
        throw new Error("Wallet challenge was not found");
      }
      if (challenge.status !== "PENDING" || challenge.expiresAt.getTime() <= Date.now()) {
        await tx.walletChallenge.update({ where: { id: challenge.id }, data: { status: "EXPIRED" } });
        throw new Error("Wallet challenge expired");
      }
      if (!verifyWalletSignature({ address: body.address, message: challenge.message, signature: body.signature })) {
        throw new Error("Wallet signature could not be verified");
      }

      const existing = await tx.blockchainWallet.findUnique({
        where: { cluster_address: { cluster: challenge.cluster, address: challenge.address } }
      });
      if (existing && existing.userId !== user.id) {
        throw new Error("This wallet is already linked to another FantasyX account");
      }

      const wallet = await tx.blockchainWallet.upsert({
        where: { cluster_address: { cluster: challenge.cluster, address: challenge.address } },
        create: {
          userId: user.id,
          cluster: challenge.cluster,
          address: challenge.address,
          verifiedAt: new Date(),
          verificationMessage: challenge.message,
          verificationSignature: body.signature
        },
        update: {
          status: "ACTIVE",
          revokedAt: null,
          verifiedAt: new Date(),
          verificationMessage: challenge.message,
          verificationSignature: body.signature
        }
      });

      await tx.walletChallenge.update({
        where: { id: challenge.id },
        data: { status: "VERIFIED", verifiedAt: new Date() }
      });

      await tx.user.update({ where: { id: user.id }, data: { walletAddress: challenge.address } });

      await tx.blockchainTransaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          cluster: challenge.cluster,
          kind: "WALLET_VERIFICATION",
          status: "CONFIRMED",
          signature: `wallet-verification:${challenge.id}`,
          idempotencyKey: `wallet_verification:${challenge.id}`,
          confirmedAt: new Date(),
          metadata: { address: challenge.address }
        }
      });

      return wallet;
    });

    return NextResponse.json({
      wallet: {
        id: result.id,
        address: result.address,
        cluster: result.cluster,
        status: result.status,
        verifiedAt: result.verifiedAt.toISOString()
      }
    });
  } catch (error) {
    return apiError(error, "Could not verify wallet", undefined, request);
  }
}
