import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string().min(20), password: z.string().min(8).max(128), confirmPassword: z.string() })
      .refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
      .parse(await request.json());
    const record = await consumeAuthToken(body.token, "PASSWORD_RESET");
    if (!record) return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(body.password), emailVerifiedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
      prisma.trustedDevice.deleteMany({ where: { userId: record.userId } })
    ]);
    return NextResponse.json({ reset: true });
  } catch (error) { return apiError(error, "Could not reset password", undefined, request); }
}
