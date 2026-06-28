import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { signupSchema } from "@/lib/api-validation";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { sessionCookieName } from "@/lib/session";
import { createSession, getSessionCookieOptions } from "@/lib/session-store";

const startingCredits = new Prisma.Decimal(10000);

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());
    const passwordHash = await hashPassword(body.password);
    const displayName = `${body.firstName} ${body.lastName}`.trim();

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const user = await prisma.$transaction(async (tx) => {
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
          startingBalance: startingCredits
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
          startingBalance: true
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
        startingBalance: Number(user.startingBalance)
      }
    }, { status: 201 });
    response.cookies.set(sessionCookieName, sessionToken, getSessionCookieOptions());
    return response;
  } catch (error) {
    return apiError(error, "Signup failed", undefined, request);
  }
}
