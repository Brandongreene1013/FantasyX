import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generate } from "otplib";
import { POST as setupTwoFactor } from "@/app/api/auth/2fa/setup/route";
import { POST as enableTwoFactor } from "@/app/api/auth/2fa/enable/route";
import { POST as verifyTwoFactor } from "@/app/api/auth/2fa/verify/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { GET as completeDesktopLogin } from "@/app/api/auth/desktop-complete/route";
import { createSession } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";
import { csrfTokenForRequest } from "@/lib/csrf";
import { hashPassword, verifyPassword } from "@/lib/password";
import { issueAuthToken, consumeAuthToken } from "@/lib/auth-tokens";
import { resetRateLimiterForTests } from "@/lib/rate-limit-config";
import { twoFactorChallengeCookieName } from "@/lib/auth-security";
import { beginOAuth, configuredOAuthProviders } from "@/lib/oauth";

const prisma = new PrismaClient();
const userId = "test_auth_security_sprint";
const email = "security.sprint@fantasyx.test";
const password = "OriginalPassword123!";

describe("official account security sprint", () => {
  beforeEach(async () => {
    resetRateLimiterForTests();
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.oAuthAttempt.deleteMany({ where: { provider: { in: ["google", "microsoft", "apple"] } } });
    await prisma.user.create({
      data: { id: userId, name: "Security Sprint", firstName: "Security", lastName: "Sprint", displayName: "Security Sprint", email,
        emailVerifiedAt: new Date(), passwordHash: await hashPassword(password), mockBalance: 1000, startingBalance: 1000 }
    });
  });

  afterAll(async () => { await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect(); });

  it("enables TOTP and gates a later password sign-in behind a valid code", async () => {
    const sessionCookie = `${sessionCookieName}=${await createSession(userId)}`;
    const setup = await setupTwoFactor(jsonRequest("/api/auth/2fa/setup", { password }, sessionCookie));
    expect(setup.status).toBe(200);
    const setupBody = await setup.json() as { manualKey: string; qrCode: string };
    expect(setupBody.qrCode).toMatch(/^data:image\/png;base64,/);

    const code = await generate({ secret: setupBody.manualKey });
    const enabled = await enableTwoFactor(jsonRequest("/api/auth/2fa/enable", { code }, sessionCookie));
    expect(enabled.status).toBe(200);
    const recoveryCodes = (await enabled.json() as { recoveryCodes: string[] }).recoveryCodes;
    expect(recoveryCodes).toHaveLength(10);

    const firstStep = await login(jsonRequest("/api/auth/login", { email, password }));
    expect(firstStep.status).toBe(202);
    const challengeCookie = cookieFromResponse(firstStep, twoFactorChallengeCookieName);
    const secondStep = await verifyTwoFactor(jsonRequest("/api/auth/2fa/verify", { code: await generate({ secret: setupBody.manualKey }), trustDevice: true }, challengeCookie));
    expect(secondStep.status).toBe(200);
    expect(secondStep.headers.get("set-cookie")).toContain(sessionCookieName);
  });

  it("allows each recovery code only once", async () => {
    const sessionCookie = `${sessionCookieName}=${await createSession(userId)}`;
    const setupBody = await (await setupTwoFactor(jsonRequest("/api/auth/2fa/setup", { password }, sessionCookie))).json() as { manualKey: string };
    const enabled = await enableTwoFactor(jsonRequest("/api/auth/2fa/enable", { code: await generate({ secret: setupBody.manualKey }) }, sessionCookie));
    const recovery = (await enabled.json() as { recoveryCodes: string[] }).recoveryCodes[0];

    const firstChallenge = cookieFromResponse(await login(jsonRequest("/api/auth/login", { email, password })), twoFactorChallengeCookieName);
    expect((await verifyTwoFactor(jsonRequest("/api/auth/2fa/verify", { code: recovery, trustDevice: false }, firstChallenge))).status).toBe(200);
    const secondChallenge = cookieFromResponse(await login(jsonRequest("/api/auth/login", { email, password })), twoFactorChallengeCookieName);
    expect((await verifyTwoFactor(jsonRequest("/api/auth/2fa/verify", { code: recovery, trustDevice: false }, secondChallenge))).status).toBe(401);
  });

  it("consumes reset and desktop handoff tokens once and revokes old sessions", async () => {
    await createSession(userId);
    const resetToken = await issueAuthToken(userId, "PASSWORD_RESET", 60_000);
    const reset = await resetPassword(jsonRequest("/api/auth/reset-password", { token: resetToken, password: "UpdatedPassword123!", confirmPassword: "UpdatedPassword123!" }));
    expect(reset.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("UpdatedPassword123!", user.passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect((await resetPassword(jsonRequest("/api/auth/reset-password", { token: resetToken, password: "AnotherPassword123!", confirmPassword: "AnotherPassword123!" }))).status).toBe(400);

    const desktopToken = await issueAuthToken(userId, "DESKTOP_LOGIN", 60_000);
    const first = await completeDesktopLogin(new Request(`http://localhost/api/auth/desktop-complete?token=${desktopToken}&next=/portfolio`));
    expect(first.status).toBe(307);
    expect(first.headers.get("location")).toBe("http://localhost/portfolio");
    expect(first.headers.get("set-cookie")).toContain(sessionCookieName);
    const replay = await completeDesktopLogin(new Request(`http://localhost/api/auth/desktop-complete?token=${desktopToken}`));
    expect(replay.headers.get("location")).toContain("desktop_auth_expired");
  });

  it("rejects expired opaque tokens", async () => {
    const token = await issueAuthToken(userId, "EMAIL_VERIFICATION", 60_000);
    await prisma.authToken.updateMany({ where: { userId, type: "EMAIL_VERIFICATION" }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await consumeAuthToken(token, "EMAIL_VERIFICATION")).toBeNull();
  });

  it("creates a one-time PKCE OAuth attempt and requests Google's account chooser", async () => {
    const previousId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    try {
      expect(configuredOAuthProviders().google).toBe(true);
      const url = await beginOAuth("google", new Request("http://localhost/api/auth/oauth/google"), "/portfolio", null, true);
      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.searchParams.get("prompt")).toBe("select_account");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      const attempt = await prisma.oAuthAttempt.findFirstOrThrow({ where: { provider: "google" } });
      expect(attempt.codeVerifier).toBeTruthy();
      expect(attempt.nextPath).toBe("/portfolio");
      expect(attempt.desktop).toBe(true);
    } finally {
      process.env.GOOGLE_CLIENT_ID = previousId;
      process.env.GOOGLE_CLIENT_SECRET = previousSecret;
    }
  });
});

function jsonRequest(path: string, body: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(cookie ? csrfHeaders(cookie) : {}) }, body: JSON.stringify(body)
  });
}

function csrfHeaders(cookie: string) {
  return { cookie, "x-csrf-token": csrfTokenForRequest(new Request("http://localhost", { headers: { cookie } })) ?? "" };
}

function cookieFromResponse(response: Response, name: string) {
  const header = response.headers.get("set-cookie") || "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  if (!match) throw new Error(`Missing ${name} cookie`);
  return `${name}=${match[1]}`;
}
