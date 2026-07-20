import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { generateSecret, generateURI } from "otplib";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { encryptAuthSecret } from "@/lib/auth-security";

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser(request);
    await requireCsrf(request);
    const { password } = z.object({ password: z.string().optional() }).parse(await request.json());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
    if (user.passwordHash && (!password || !(await verifyPassword(password, user.passwordHash)))) {
      return NextResponse.json({ error: "Current password is required" }, { status: 403 });
    }
    const secret = generateSecret();
    const uri = generateURI({ issuer: "FantasyX", label: user.email || user.displayName, secret });
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: encryptAuthSecret(secret), twoFactorEnabled: false } });
    return NextResponse.json({ qrCode: await QRCode.toDataURL(uri, { width: 240, margin: 1 }), manualKey: secret });
  } catch (error) { return apiError(error, "Could not start two-factor setup", undefined, request); }
}
