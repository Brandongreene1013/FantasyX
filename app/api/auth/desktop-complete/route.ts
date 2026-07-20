import { NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { completeRedirectLogin } from "@/lib/login-flow";
import { safeInternalPath } from "@/lib/redirects";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const token = query.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=desktop_auth_failed", request.url));
  const record = await consumeAuthToken(token, "DESKTOP_LOGIN");
  if (!record) return NextResponse.redirect(new URL("/login?error=desktop_auth_expired", request.url));
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return NextResponse.redirect(new URL("/login?error=desktop_auth_failed", request.url));
  return completeRedirectLogin(user, request, safeInternalPath(query.get("next")));
}
