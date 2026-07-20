import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { prisma } from "@/lib/prisma";
import { attachSession } from "@/lib/login-flow";

export async function POST(request: Request) {
  try {
    const { token } = z.object({ token: z.string().min(20) }).parse(await request.json());
    const record = await consumeAuthToken(token, "EMAIL_VERIFICATION");
    if (!record) return NextResponse.json({ error: "Verification link is invalid or expired" }, { status: 400 });
    await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    const response = NextResponse.json({ verified: true });
    await attachSession(response, record.userId);
    return response;
  } catch (error) { return apiError(error, "Could not verify email", undefined, request); }
}
