import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import type { BetaEventType } from "@/lib/beta-events";
import { prisma } from "@/lib/prisma";

const betaEventTypes: BetaEventType[] = [
  "SIGNUP",
  "REFERRAL_SIGNUP",
  "ONBOARDING_COMPLETE",
  "FIRST_TRADE",
  "MARKET_SHARE",
  "INVITE_COPY"
];

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [events, users, topReferrers] = await Promise.all([
      prisma.betaEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      }),
      prisma.user.count(),
      prisma.user.findMany({
        where: { referrals: { some: {} } },
        select: {
          id: true,
          displayName: true,
          name: true,
          referralCode: true,
          _count: { select: { referrals: true } }
        },
        orderBy: { referrals: { _count: "desc" } },
        take: 10
      })
    ]);

    const counts = Object.fromEntries(betaEventTypes.map((type) => [type, 0])) as Record<BetaEventType, number>;
    for (const event of events) counts[event.type] = event._count._all;

    return NextResponse.json({
      beta: {
        since: since.toISOString(),
        totalUsers: users,
        counts,
        activation: {
          signupToOnboardingPct: pct(counts.ONBOARDING_COMPLETE, counts.SIGNUP),
          signupToFirstTradePct: pct(counts.FIRST_TRADE, counts.SIGNUP),
          referralSignupPct: pct(counts.REFERRAL_SIGNUP, counts.SIGNUP)
        },
        topReferrers: topReferrers.map((user) => ({
          id: user.id,
          name: user.displayName || user.name,
          referralCode: user.referralCode,
          referrals: user._count.referrals
        }))
      }
    });
  } catch (error) {
    return apiError(error, "Could not load beta metrics", undefined, request);
  }
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
