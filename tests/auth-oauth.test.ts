import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET as oauthCallback } from "@/app/api/auth/callback/[provider]/route";
import { beginOAuth, configuredOAuthProviders } from "@/lib/oauth";
import { sessionCookieName } from "@/lib/session";
import { resetRateLimiterForTests } from "@/lib/rate-limit-config";

const prisma = new PrismaClient();
const oauthEmail = "google.oauth@fantasyx.test";
const oauthSub = "google-oauth-subject";

describe("Google OAuth login flow", () => {
  const previousEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_BASE_URL: process.env.AUTH_BASE_URL
  };

  beforeEach(async () => {
    resetRateLimiterForTests();
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.AUTH_BASE_URL = "http://localhost";
    await resetOAuthTestData();
    vi.stubGlobal("fetch", vi.fn(mockGoogleFetch));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    process.env.GOOGLE_CLIENT_ID = previousEnv.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = previousEnv.GOOGLE_CLIENT_SECRET;
    process.env.AUTH_BASE_URL = previousEnv.AUTH_BASE_URL;
  });

  afterAll(async () => {
    await resetOAuthTestData();
    await prisma.$disconnect();
  });

  it("starts Google sign-in only when credentials are non-empty", () => {
    process.env.GOOGLE_CLIENT_ID = " ";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    expect(configuredOAuthProviders().google).toBe(false);
  });

  it("creates a verified account, links Google, and sets a session on callback", async () => {
    const state = await startGoogleState("/portfolio");
    const response = await oauthCallback(
      new Request(`http://localhost/api/auth/callback/google?state=${state}&code=valid-code`),
      { params: Promise.resolve({ provider: "google" }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/portfolio");
    expect(response.headers.get("set-cookie")).toContain(sessionCookieName);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: oauthEmail } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(Number(user.mockBalance)).toBeCloseTo(10000);
    await expect(prisma.authProviderAccount.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: oauthSub } }
    })).resolves.toMatchObject({ userId: user.id, providerEmail: oauthEmail });
  });

  it("handles concurrent callbacks for the same Google account without duplicate users", async () => {
    const [firstState, secondState] = await Promise.all([
      startGoogleState("/markets"),
      startGoogleState("/markets")
    ]);

    const [first, second] = await Promise.all([
      oauthCallback(new Request(`http://localhost/api/auth/callback/google?state=${firstState}&code=first-code`), { params: Promise.resolve({ provider: "google" }) }),
      oauthCallback(new Request(`http://localhost/api/auth/callback/google?state=${secondState}&code=second-code`), { params: Promise.resolve({ provider: "google" }) })
    ]);

    expect(first.status).toBe(307);
    expect(second.status).toBe(307);
    expect(await prisma.user.count({ where: { email: oauthEmail } })).toBe(1);
    expect(await prisma.authProviderAccount.count({ where: { provider: "google", providerAccountId: oauthSub } })).toBe(1);
  });

  it("redirects cancelled provider responses with a specific error code", async () => {
    const state = await startGoogleState("/portfolio");
    const response = await oauthCallback(
      new Request(`http://localhost/api/auth/callback/google?state=${state}&error=access_denied`),
      { params: Promise.resolve({ provider: "google" }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?error=oauth_cancelled");
  });
});

async function startGoogleState(next: string) {
  const url = await beginOAuth("google", new Request("http://localhost/api/auth/oauth/google"), next);
  const state = url.searchParams.get("state");
  if (!state) throw new Error("Missing OAuth state");
  return state;
}

async function mockGoogleFetch(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input);
  if (url === "https://oauth2.googleapis.com/token") {
    return Response.json({ token_type: "Bearer", access_token: "mock-google-access-token", expires_in: 3600 });
  }
  if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
    return Response.json({
      sub: oauthSub,
      email: oauthEmail,
      email_verified: true,
      given_name: "Google",
      family_name: "User",
      name: "Google User"
    });
  }
  return new Response("not found", { status: 404 });
}

async function resetOAuthTestData() {
  const users = await prisma.user.findMany({
    where: { email: oauthEmail },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  await prisma.oAuthAttempt.deleteMany({ where: { provider: "google" } });
  await prisma.authProviderAccount.deleteMany({ where: { OR: [{ providerAccountId: oauthSub }, { providerEmail: oauthEmail }] } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.authToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.trustedDevice.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.betaEvent.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { referrerId: { in: userIds } }] } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { userId: { in: userIds } } });
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
