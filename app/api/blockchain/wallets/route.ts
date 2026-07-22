import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const wallets = await prisma.blockchainWallet.findMany({
      where: { userId: user.id },
      orderBy: { verifiedAt: "desc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      }
    });

    return NextResponse.json({
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        address: wallet.address,
        cluster: wallet.cluster,
        status: wallet.status,
        verifiedAt: wallet.verifiedAt.toISOString(),
        transactions: wallet.transactions.map((transaction) => ({
          id: transaction.id,
          kind: transaction.kind,
          status: transaction.status,
          signature: transaction.signature,
          createdAt: transaction.createdAt.toISOString()
        }))
      }))
    });
  } catch (error) {
    return apiError(error, "Could not load blockchain wallets", undefined, request);
  }
}
