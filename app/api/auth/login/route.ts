import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/api-validation";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit-config";
import { completeJsonLogin } from "@/lib/login-flow";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.auth, getClientIp(request));
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const valid = Boolean(user?.passwordHash) && await verifyPassword(body.password, user!.passwordHash);
    if (!user || !valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    if (!user.emailVerifiedAt) {
      return NextResponse.json({ error: "Verify your email before signing in", code: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }
    return completeJsonLogin(user, request);
  } catch (error) {
    return apiError(error, "Login failed", undefined, request);
  }
}
