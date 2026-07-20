import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { issueAuthToken } from "@/lib/auth-tokens";
import { sendAuthEmail } from "@/lib/auth-email";
import { RATE_LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit-config";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.auth, getClientIp(request));
    const { email } = z.object({ email: z.string().email().transform((v) => v.toLowerCase()) }).parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000);
      const url = `${baseUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
      await sendAuthEmail({ kind: "verify", to: email, name: user.firstName, url });
    }
    return NextResponse.json({ sent: true });
  } catch (error) { return apiError(error, "Could not resend verification", undefined, request); }
}

function baseUrl(request: Request) { return (process.env.AUTH_BASE_URL?.trim() || new URL(request.url).origin).replace(/\/$/, ""); }
