import { createHmac, timingSafeEqual } from "crypto";
import { AuthError } from "@/lib/auth";
import { EnvConfigError } from "@/lib/env";
import { readSessionCookie, verifySessionToken } from "@/lib/session-store";

export function csrfTokenForRequest(request: Request) {
  const token = verifySessionToken(readSessionCookie(request));
  return token ? csrfTokenForSessionToken(token) : null;
}

export async function requireCsrf(request: Request) {
  const expected = csrfTokenForRequest(request);
  const provided = request.headers.get("x-csrf-token");

  if (!expected || !provided || !constantTimeEqual(expected, provided)) {
    throw new AuthError("Invalid CSRF token", 403);
  }
}

function csrfTokenForSessionToken(sessionToken: string) {
  return createHmac("sha256", getSessionSecret()).update(`csrf:${sessionToken}`).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.trim().length >= 32) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new EnvConfigError("Missing required environment variable: SESSION_SECRET", ["SESSION_SECRET"]);
  }
  return "development-session-secret-change-before-production";
}
