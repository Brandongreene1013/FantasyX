import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/api-validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, getSessionCookieOptions } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        passwordHash: true,
        role: true,
        isAdmin: true
      }
    });

    const isPasswordValid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    const isEnvAdminLogin =
      Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) &&
      body.email === process.env.ADMIN_EMAIL?.toLowerCase() &&
      body.password === process.env.ADMIN_PASSWORD;

    if (!user && !isEnvAdminLogin) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user && !isPasswordValid && !isEnvAdminLogin) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const adminDisplayName = `${process.env.ADMIN_FIRST_NAME ?? "FantasyX"} ${process.env.ADMIN_LAST_NAME ?? "Admin"}`.trim();
    const loginUser = user
      ? isPasswordValid ? user : await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.password),
        role: "ADMIN",
        isAdmin: true,
        firstName: process.env.ADMIN_FIRST_NAME ?? user.firstName,
        lastName: process.env.ADMIN_LAST_NAME ?? user.lastName,
        displayName: adminDisplayName || user.displayName || user.name,
        name: adminDisplayName || user.displayName || user.name
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        passwordHash: true,
        role: true,
        isAdmin: true
      }
    })
      : await prisma.$transaction(async (tx) => {
        const startingCredits = new Prisma.Decimal(10000);
        const createdUser = await tx.user.create({
          data: {
            name: adminDisplayName,
            firstName: process.env.ADMIN_FIRST_NAME ?? "FantasyX",
            lastName: process.env.ADMIN_LAST_NAME ?? "Admin",
            displayName: adminDisplayName,
            email: body.email,
            passwordHash: await hashPassword(body.password),
            role: "ADMIN",
            isAdmin: true,
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
            passwordHash: true,
            role: true,
            isAdmin: true
          }
        });
        await tx.accountLedgerEntry.create({
          data: {
            userId: createdUser.id,
            type: "SEED_GRANT",
            amount: startingCredits,
            balanceAfter: startingCredits,
            reason: "Initial admin mock-credit grant",
            idempotencyKey: `admin_seed_grant:${createdUser.id}`,
            metadata: { source: "admin_login_bootstrap" }
          }
        });
        return createdUser;
      });

    const sessionToken = await createSession(loginUser.id);
    const response = NextResponse.json({
      user: {
        id: loginUser.id,
        name: loginUser.displayName || loginUser.name,
        firstName: loginUser.firstName,
        lastName: loginUser.lastName,
        displayName: loginUser.displayName || loginUser.name,
        email: loginUser.email,
        role: loginUser.role,
        isAdmin: loginUser.role === "ADMIN" || loginUser.isAdmin
      }
    });
    response.cookies.set(sessionCookieName, sessionToken, getSessionCookieOptions());
    return response;
  } catch (error) {
    return apiError(error, "Login failed", undefined, request);
  }
}
