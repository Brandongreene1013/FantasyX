import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { verifyUserSecondFactor } from "@/lib/login-flow";

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser(request);
    await requireCsrf(request);
    const { code } = z.object({ code: z.string().min(6).max(20) }).parse(await request.json());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
    if (!user.twoFactorEnabled || !(await verifyUserSecondFactor(user, code))) {
      return NextResponse.json({ error: "A valid authenticator or recovery code is required" }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodeHashes: Prisma.DbNull } }),
      prisma.trustedDevice.deleteMany({ where: { userId: user.id } })
    ]);
    return NextResponse.json({ enabled: false });
  } catch (error) { return apiError(error, "Could not disable two-factor authentication", undefined, request); }
}
