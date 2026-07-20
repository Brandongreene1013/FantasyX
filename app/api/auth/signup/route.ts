import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { signupSchema } from "@/lib/api-validation";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit-config";
import { provisionAccount } from "@/lib/account-provisioning";
import { issueAuthToken } from "@/lib/auth-tokens";
import { sendAuthEmail } from "@/lib/auth-email";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.auth, getClientIp(request));
    const body = signupSchema.parse(await request.json());
    if (process.env.ADMIN_EMAIL && body.email === process.env.ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    const user = await provisionAccount({
      firstName: body.firstName, lastName: body.lastName, email: body.email,
      passwordHash: await hashPassword(body.password), referralCode: body.referralCode
    });
    const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000);
    const url = `${authBaseUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
    const delivery = await sendAuthEmail({ kind: "verify", to: body.email, name: user.firstName, url });
    return NextResponse.json({
      requiresVerification: true,
      email: body.email,
      ...(delivery.previewUrl ? { verificationPreviewUrl: delivery.previewUrl } : {})
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "Signup failed", undefined, request);
  }
}

function authBaseUrl(request: Request) {
  return (process.env.AUTH_BASE_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}
