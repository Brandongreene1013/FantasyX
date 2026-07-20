import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { EnvConfigError } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sessionCookieName } from "@/lib/session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const signedToken = signSessionToken(token);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000)
    }
  });
  return signedToken;
}

export async function destroySession(signedToken: string | null) {
  const token = verifySessionToken(signedToken);
  if (!token) {
    return;
  }
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function getSessionUserIdFromToken(signedToken: string | null) {
  const token = verifySessionToken(signedToken);
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { userId: true, expiresAt: true }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    return null;
  }

  return session.userId;
}

export function readSessionCookie(request: Request) {
  return parseCookieHeader(request.headers.get("cookie"))[sessionCookieName] ?? null;
}

export function signSessionToken(token: string) {
  return `${token}.${signatureForToken(token)}`;
}

export function verifySessionToken(signedToken: string | null) {
  if (!signedToken) {
    return null;
  }

  const parts = signedToken.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [token, signature] = parts;
  if (!token || !signature) {
    return null;
  }

  const expected = signatureForToken(token);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return token;
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signatureForToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("base64url");
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

function parseCookieHeader(header: string | null) {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      continue;
    }
    const rawValue = valueParts.join("=");
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      // A malformed cookie is untrusted input. Ignore it so public routes can
      // continue as a guest instead of turning a bad client cookie into a 500.
    }
  }
  return cookies;
}
