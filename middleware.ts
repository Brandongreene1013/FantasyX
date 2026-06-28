import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/session";

const buckets = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxRequests = 120;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/markets" || request.nextUrl.pathname === "/portfolio" || request.nextUrl.pathname === "/history" || request.nextUrl.pathname === "/admin") {
    const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return withRateHeaders(NextResponse.next(), maxRequests - 1, now + windowMs);
  }

  bucket.count += 1;
  const remaining = Math.max(0, maxRequests - bucket.count);

  if (bucket.count > maxRequests) {
    return withRateHeaders(NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }), remaining, bucket.resetAt);
  }

  return withRateHeaders(NextResponse.next(), remaining, bucket.resetAt);
}

function withRateHeaders(response: NextResponse, remaining: number, resetAt: number) {
  response.headers.set("x-ratelimit-limit", String(maxRequests));
  response.headers.set("x-ratelimit-remaining", String(remaining));
  response.headers.set("x-ratelimit-reset", String(Math.ceil(resetAt / 1000)));
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/markets", "/portfolio", "/history", "/admin"]
};
