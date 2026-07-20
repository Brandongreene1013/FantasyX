import { NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "otplib";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { decryptAuthSecret, generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth-security";

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser(request);
    await requireCsrf(request);
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await request.json());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
    if (!user.twoFactorSecret) return NextResponse.json({ error: "Start two-factor setup first" }, { status: 400 });
    const result = await verify({ secret: decryptAuthSecret(user.twoFactorSecret), token: code, epochTolerance: 30 });
    if (!result.valid) return NextResponse.json({ error: "That authenticator code is not valid" }, { status: 400 });
    const recoveryCodes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id }, data: { twoFactorEnabled: true, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) }
    });
    return NextResponse.json({ enabled: true, recoveryCodes });
  } catch (error) { return apiError(error, "Could not enable two-factor authentication", undefined, request); }
}
