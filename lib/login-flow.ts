import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { verify } from "otplib";
import { prisma } from "@/lib/prisma";
import { createSession, getSessionCookieOptions } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";
import { issueAuthToken } from "@/lib/auth-tokens";
import {
  createOpaqueToken, decryptAuthSecret, hashAuthToken, hashRecoveryCode, readCookieValue,
  secureCookieOptions, trustedDeviceCookieName, twoFactorChallengeCookieName
} from "@/lib/auth-security";

type LoginUser = Pick<User, "id" | "twoFactorEnabled">;

export async function completeJsonLogin(user: LoginUser, request: Request, next = "/") {
  if (await needsTwoFactor(user, request)) {
    const response = NextResponse.json({ requiresTwoFactor: true, next }, { status: 202 });
    await attachTwoFactorChallenge(response, user.id);
    return response;
  }
  const response = NextResponse.json({ authenticated: true });
  await attachSession(response, user.id);
  return response;
}

export async function completeRedirectLogin(user: LoginUser, request: Request, next: string) {
  if (await needsTwoFactor(user, request)) {
    const url = new URL("/login/2fa", request.url);
    url.searchParams.set("next", next);
    const response = NextResponse.redirect(url);
    await attachTwoFactorChallenge(response, user.id);
    return response;
  }
  const response = NextResponse.redirect(new URL(next, request.url));
  await attachSession(response, user.id);
  return response;
}

export async function verifyLoginSecondFactor(request: Request, code: string) {
  const challenge = readCookieValue(request, twoFactorChallengeCookieName);
  if (!challenge) return null;
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashAuthToken(challenge) }, include: { user: true }
  });
  if (!record || record.type !== "TWO_FACTOR_LOGIN" || record.consumedAt || record.expiresAt.getTime() <= Date.now()) return null;
  if (!(await verifyUserSecondFactor(record.user, code))) return null;
  const consumed = await prisma.authToken.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return consumed.count === 1 ? record.user : null;
}

export async function attachSession(response: NextResponse, userId: string) {
  response.cookies.set(sessionCookieName, await createSession(userId), getSessionCookieOptions());
  response.cookies.set(twoFactorChallengeCookieName, "", { ...secureCookieOptions(0), maxAge: 0 });
}

export async function trustDevice(response: NextResponse, request: Request, userId: string) {
  const token = createOpaqueToken();
  const maxAge = 60 * 60 * 24 * 30;
  await prisma.trustedDevice.create({
    data: {
      userId, tokenHash: hashAuthToken(token), expiresAt: new Date(Date.now() + maxAge * 1000),
      label: deviceLabel(request.headers.get("user-agent"))
    }
  });
  response.cookies.set(trustedDeviceCookieName, token, secureCookieOptions(maxAge));
}

async function needsTwoFactor(user: LoginUser, request: Request) {
  if (!user.twoFactorEnabled) return false;
  const token = readCookieValue(request, trustedDeviceCookieName);
  if (!token) return true;
  const trusted = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!trusted || trusted.userId !== user.id || trusted.expiresAt.getTime() <= Date.now()) return true;
  await prisma.trustedDevice.update({ where: { id: trusted.id }, data: { lastUsedAt: new Date() } });
  return false;
}

async function attachTwoFactorChallenge(response: NextResponse, userId: string) {
  const token = await issueAuthToken(userId, "TWO_FACTOR_LOGIN", 10 * 60 * 1000);
  response.cookies.set(twoFactorChallengeCookieName, token, secureCookieOptions(10 * 60));
}

export async function verifyUserSecondFactor(user: Pick<User, "id" | "twoFactorSecret" | "recoveryCodeHashes">, code: string) {
  if (user.twoFactorSecret && /^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const result = await verify({ secret: decryptAuthSecret(user.twoFactorSecret), token: code.replace(/\s/g, ""), epochTolerance: 30 });
    if (result.valid) return true;
  }
  const hash = hashRecoveryCode(code);
  const hashes = Array.isArray(user.recoveryCodeHashes) ? user.recoveryCodeHashes.filter((item): item is string => typeof item === "string") : [];
  if (!hashes.includes(hash)) return false;
  await prisma.user.update({ where: { id: user.id }, data: { recoveryCodeHashes: hashes.filter((item) => item !== hash) } });
  return true;
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Trusted device";
  if (/electron/i.test(userAgent)) return "FantasyX desktop";
  if (/iphone|ipad/i.test(userAgent)) return "Apple mobile device";
  if (/android/i.test(userAgent)) return "Android device";
  return "Web browser";
}
