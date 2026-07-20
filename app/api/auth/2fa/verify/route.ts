import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { attachSession, trustDevice, verifyLoginSecondFactor } from "@/lib/login-flow";
import { RATE_LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit-config";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.auth, getClientIp(request));
    const { code, trustDevice: remember } = z.object({ code: z.string().min(6).max(20), trustDevice: z.boolean().default(false) }).parse(await request.json());
    const user = await verifyLoginSecondFactor(request, code);
    if (!user) return NextResponse.json({ error: "Code is invalid or expired" }, { status: 401 });
    const response = NextResponse.json({ authenticated: true });
    await attachSession(response, user.id);
    if (remember) await trustDevice(response, request, user.id);
    return response;
  } catch (error) { return apiError(error, "Could not verify two-factor code", undefined, request); }
}
