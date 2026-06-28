import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/session";

const buckets = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxRequests = 120;

export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (request.nextUrl.pathname === "/markets" || request.nextUrl.pathname.startsWith("/markets/") || request.nextUrl.pathname.startsWith("/players/") || request.nextUrl.pathname === "/portfolio" || request.nextUrl.pathname === "/history" || request.nextUrl.pathname === "/admin" || request.nextUrl.pathname === "/account" || request.nextUrl.pathname === "/settings") {
    const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-request-id", requestId);
      return response;
    }
  }

  if (!request.nextUrl.pathname.startsWith("/api")) {
    return withRequestHeaders(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
  }

  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return withRateHeaders(withRequestHeaders(NextResponse.next({ request: { headers: requestHeaders } }), requestId), maxRequests - 1, now + windowMs);
  }

  bucket.count += 1;
  const remaining = Math.max(0, maxRequests - bucket.count);

  if (bucket.count > maxRequests) {
    return withRateHeaders(withRequestHeaders(NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 }), requestId), remaining, bucket.resetAt);
  }

  return withRateHeaders(withRequestHeaders(NextResponse.next({ request: { headers: requestHeaders } }), requestId), remaining, bucket.resetAt);
}

function withRequestHeaders(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

function withRateHeaders(response: NextResponse, remaining: number, resetAt: number) {
  response.headers.set("x-ratelimit-limit", String(maxRequests));
  response.headers.set("x-ratelimit-remaining", String(remaining));
  response.headers.set("x-ratelimit-reset", String(Math.ceil(resetAt / 1000)));
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/markets", "/markets/:path*", "/players/:path*", "/portfolio", "/history", "/admin"]
};
