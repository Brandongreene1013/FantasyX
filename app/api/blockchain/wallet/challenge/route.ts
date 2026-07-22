import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { getSolanaRuntimeConfig, assertSupportedPublicKey } from "@/packages/solana-config/src";
import {
  buildWalletChallengeMessage,
  createWalletNonce,
  hashWalletNonce
} from "@/packages/solana-client/src";

const challengeSchema = z.object({
  address: z.string().min(32).max(64)
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    const body = challengeSchema.parse(await request.json());
    const publicKey = assertSupportedPublicKey(body.address);
    const config = getSolanaRuntimeConfig();
    const nonce = createWalletNonce();
    const issuedAt = new Date();
    const domain = new URL(request.url).host;
    const message = buildWalletChallengeMessage({
      appName: "FantasyX",
      domain,
      userId: user.id,
      address: publicKey.toBase58(),
      cluster: config.cluster,
      nonce,
      issuedAt
    });

    const challenge = await prisma.walletChallenge.create({
      data: {
        userId: user.id,
        address: publicKey.toBase58(),
        cluster: toDbCluster(config.cluster),
        nonceHash: hashWalletNonce(nonce),
        message,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    return NextResponse.json({
      challengeId: challenge.id,
      address: challenge.address,
      cluster: config.cluster,
      message,
      expiresAt: challenge.expiresAt.toISOString()
    });
  } catch (error) {
    return apiError(error, "Could not create wallet challenge", undefined, request);
  }
}

function toDbCluster(cluster: string) {
  if (cluster === "localnet") return "LOCALNET";
  if (cluster === "mainnet-beta") return "MAINNET_BETA";
  return "DEVNET";
}
