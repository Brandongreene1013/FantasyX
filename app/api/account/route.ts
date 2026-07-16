import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/db-serialization";
import { prisma } from "@/lib/prisma";
import { ensureUserReferralCode } from "@/lib/referrals";

export async function GET(request: Request) {
  try {
    const sessionUser = await requireSessionUser(request);
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        positions: true,
        trades: true,
        referrals: { select: { id: true } },
        referredBy: { select: { displayName: true, name: true } }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const referralCode = await ensureUserReferralCode(prisma, user.id, user.referralCode);
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      account: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.role === "ADMIN" || user.isAdmin,
        mockBalance: toNumber(user.mockBalance),
        startingBalance: toNumber(user.startingBalance),
        joinedAt: user.createdAt.toISOString(),
        openPositions: user.positions.filter((position) => toNumber(position.yesShares) + toNumber(position.noShares) > 0).length,
        totalTrades: user.trades.length,
        portfolioPnl: toNumber(user.mockBalance) - toNumber(user.startingBalance),
        referralCode,
        referralUrl: `${origin}/signup?ref=${encodeURIComponent(referralCode)}`,
        referralCount: user.referrals.length,
        referredByName: user.referredBy ? user.referredBy.displayName || user.referredBy.name : null
      }
    });
  } catch (error) {
    return apiError(error, "Could not load account", undefined, request);
  }
}
