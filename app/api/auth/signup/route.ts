import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { signupSchema } from "@/lib/api-validation";
import { trackBetaEventTx } from "@/lib/beta-events";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit-config";
import { findReferrerId, reserveReferralCode } from "@/lib/referrals";
import { sessionCookieName } from "@/lib/session";
import { createSession, getSessionCookieOptions } from "@/lib/session-store";

const startingCredits = new Prisma.Decimal(10000);

export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.auth, getClientIp(request));
    const body = signupSchema.parse(await request.json());
    const passwordHash = await hashPassword(body.password);
    const displayName = `${body.firstName} ${body.lastName}`.trim();

    if (process.env.ADMIN_EMAIL && body.email === process.env.ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const [referralCode, referredByUserId] = await Promise.all([
        reserveReferralCode(tx),
        findReferrerId(tx, body.referralCode)
      ]);

      const createdUser = await tx.user.create({
        data: {
          name: displayName,
          firstName: body.firstName,
          lastName: body.lastName,
          displayName,
          email: body.email,
          passwordHash,
          role: "TRADER",
          isAdmin: false,
          mockBalance: startingCredits,
          startingBalance: startingCredits,
          referralCode,
          referredByUserId
        },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          role: true,
          isAdmin: true,
          mockBalance: true,
          startingBalance: true,
          referralCode: true
        }
      });

      await tx.accountLedgerEntry.create({
        data: {
          userId: createdUser.id,
          type: "SEED_GRANT",
          amount: startingCredits,
          balanceAfter: startingCredits,
          reason: "Initial signup mock-credit grant",
          idempotencyKey: `signup_seed_grant:${createdUser.id}`,
          metadata: { source: "signup" }
        }
      });

      await trackBetaEventTx(tx, {
        type: "SIGNUP",
        userId: createdUser.id,
        referrerId: referredByUserId,
        metadata: { source: "signup" }
      });

      if (referredByUserId) {
        await trackBetaEventTx(tx, {
          type: "REFERRAL_SIGNUP",
          userId: createdUser.id,
          referrerId: referredByUserId,
          metadata: { referralCode: body.referralCode }
        });
      }

      return createdUser;
    });

    const sessionToken = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        mockBalance: Number(user.mockBalance),
        startingBalance: Number(user.startingBalance),
        referralCode: user.referralCode
      }
    }, { status: 201 });
    response.cookies.set(sessionCookieName, sessionToken, getSessionCookieOptions());
    return response;
  } catch (error) {
    return apiError(error, "Signup failed", undefined, request);
  }
}
