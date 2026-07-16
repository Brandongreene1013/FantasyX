import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET as getSession } from "@/app/api/session/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getAccount } from "@/app/api/account/route";
import { PATCH as patchSettings } from "@/app/api/settings/route";
import { POST as trade } from "@/app/api/trades/route";
import { GET as getPortfolio } from "@/app/api/portfolio/route";
import { GET as getNflStats } from "@/app/api/admin/nfl/stats/route";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";
import { csrfTokenForRequest } from "@/lib/csrf";

const prisma = new PrismaClient();
const weekId = "test_week_auth_accounts";
const gameId = "test_game_auth_accounts";
const playerId = "test_player_auth_accounts";
const marketId = "test_market_auth_accounts_top_5";

describe("FX009 real account auth", () => {
  beforeEach(async () => {
    await resetTestData();
    await createMarketData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  it("signs up a user, hashes the password, creates a seed ledger entry, and persists a session", async () => {
    const response = await signup(signupRequest("casey@example.com"));
    expect(response.status).toBe(201);
    const cookie = getCookie(response);
    expect(cookie).toContain(sessionCookieName);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "casey@example.com" } });
    expect(user.passwordHash).not.toBe("SuperSecret123!");
    expect(await verifyPassword("SuperSecret123!", user.passwordHash)).toBe(true);
    expect(Number(user.mockBalance)).toBeCloseTo(10000);

    const ledger = await prisma.accountLedgerEntry.findMany({ where: { userId: user.id, type: "SEED_GRANT" } });
    expect(ledger).toHaveLength(1);

    const sessionResponse = await getSession(new Request("http://localhost/api/session", { headers: { cookie } }));
    expect(sessionResponse.status).toBe(200);
  });

  it("rejects duplicate signup email addresses", async () => {
    expect((await signup(signupRequest("duplicate@example.com"))).status).toBe(201);
    expect((await signup(signupRequest("duplicate@example.com"))).status).toBe(409);
  });

  it("creates referral codes and attributes referred signups", async () => {
    await signup(signupRequest("inviter@example.com"));
    const inviter = await prisma.user.findUniqueOrThrow({ where: { email: "inviter@example.com" } });
    expect(inviter.referralCode).toMatch(/^FX[A-Z0-9]+/);

    const referredResponse = await signup(jsonRequest("/api/auth/signup", {
      firstName: "Riley",
      lastName: "Referral",
      email: "referred@example.com",
      password: "SuperSecret123!",
      confirmPassword: "SuperSecret123!",
      referralCode: inviter.referralCode?.toLowerCase()
    }));
    expect(referredResponse.status).toBe(201);

    const referred = await prisma.user.findUniqueOrThrow({ where: { email: "referred@example.com" } });
    expect(referred.referredByUserId).toBe(inviter.id);

    const account = await getAccount(new Request("http://localhost/api/account", {
      headers: { cookie: `${sessionCookieName}=${await createSession(inviter.id)}` }
    }));
    expect(account.status).toBe(200);
    expect(await account.json()).toMatchObject({
      account: {
        referralCode: inviter.referralCode,
        referralCount: 1
      }
    });
  });

  it("does not allow normal signup to reserve the configured admin email", async () => {
    const previousAdminEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "reserved-admin@example.com";
    try {
      const response = await signup(signupRequest("reserved-admin@example.com"));
      expect(response.status).toBe(409);
    } finally {
      process.env.ADMIN_EMAIL = previousAdminEmail;
    }
  });

  it("logs in with valid credentials and rejects invalid credentials generically", async () => {
    await signup(signupRequest("login@example.com"));

    const good = await login(jsonRequest("/api/auth/login", { email: "login@example.com", password: "SuperSecret123!" }));
    expect(good.status).toBe(200);
    expect(getCookie(good)).toContain(sessionCookieName);

    const bad = await login(jsonRequest("/api/auth/login", { email: "login@example.com", password: "wrong-password" }));
    expect(bad.status).toBe(401);
    expect(await bad.json()).toMatchObject({ error: "Invalid email or password" });
  });

  it("destroys sessions on logout", async () => {
    const signupResponse = await signup(signupRequest("logout@example.com"));
    const cookie = getCookie(signupResponse);

    const logoutResponse = await logout(new Request("http://localhost/api/auth/logout", { method: "POST", headers: csrfHeaders(cookie) }));
    expect(logoutResponse.status).toBe(200);

    const sessionResponse = await getSession(new Request("http://localhost/api/session", { headers: { cookie } }));
    expect(sessionResponse.status).toBe(401);
  });

  it("requires auth for account and settings APIs", async () => {
    const accountResponse = await getAccount(new Request("http://localhost/api/account"));
    const settingsResponse = await patchSettings(jsonRequest("/api/settings", {
      firstName: "No",
      lastName: "Session",
      displayName: "No Session"
    }));

    expect(accountResponse.status).toBe(401);
    expect(settingsResponse.status).toBe(401);
  });

  it("requires authentication for trading and executes trades as the session user", async () => {
    const userCookie = getCookie(await signup(signupRequest("trader@example.com")));

    const unauthorized = await trade(jsonRequest("/api/trades", { marketId, side: "YES", spend: 25 }));
    expect(unauthorized.status).toBe(401);

    const authorized = await trade(jsonRequest("/api/trades", { userId: "forged-user", marketId, side: "YES", spend: 25 }, userCookie));
    expect(authorized.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "trader@example.com" } });
    const position = await prisma.position.findUnique({ where: { userId_marketId: { userId: user.id, marketId } } });
    expect(position).not.toBeNull();
  });

  it("isolates portfolio data between users", async () => {
    const firstCookie = getCookie(await signup(signupRequest("first@example.com")));
    const secondCookie = getCookie(await signup(signupRequest("second@example.com")));

    expect((await trade(jsonRequest("/api/trades", { marketId, side: "NO", spend: 30 }, firstCookie))).status).toBe(200);

    const firstPortfolio = await getPortfolio(new Request("http://localhost/api/portfolio", { headers: { cookie: firstCookie } }));
    const secondPortfolio = await getPortfolio(new Request("http://localhost/api/portfolio", { headers: { cookie: secondCookie } }));

    expect(((await firstPortfolio.json()) as { positions: unknown[] }).positions).toHaveLength(1);
    expect(((await secondPortfolio.json()) as { positions: unknown[] }).positions).toHaveLength(0);
  });

  it("enforces admin permissions from the authenticated session", async () => {
    const traderCookie = getCookie(await signup(signupRequest("not-admin@example.com")));
    const admin = await prisma.user.create({
      data: {
        id: "test_auth_admin",
        name: "Auth Admin",
        firstName: "Auth",
        lastName: "Admin",
        displayName: "Auth Admin",
        email: "auth.admin@fantasyx.test",
        passwordHash: await hashPassword("AdminSecret123!"),
        role: "ADMIN",
        isAdmin: true,
        mockBalance: 10000,
        startingBalance: 10000
      }
    });
    const adminCookie = `${sessionCookieName}=${await createSession(admin.id)}`;

    expect((await getNflStats(new Request("http://localhost/api/admin/nfl/stats", { headers: { cookie: traderCookie } }))).status).toBe(403);
    expect((await getNflStats(new Request("http://localhost/api/admin/nfl/stats", { headers: { cookie: adminCookie } }))).status).toBe(200);
  });
});

function signupRequest(email: string) {
  return jsonRequest("/api/auth/signup", {
    firstName: "Casey",
    lastName: "Coach",
    email,
    password: "SuperSecret123!",
    confirmPassword: "SuperSecret123!"
  });
}

function jsonRequest(path: string, body: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? csrfHeaders(cookie) : {})
    },
    body: JSON.stringify(body)
  });
}

function csrfHeaders(cookie: string) {
  const request = new Request("http://localhost", { headers: { cookie } });
  return { cookie, "x-csrf-token": csrfTokenForRequest(request) ?? "" };
}

function getCookie(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) {
    throw new Error("Missing set-cookie header");
  }
  return header.split(";")[0];
}

async function createMarketData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2097,
      week: 1,
      startsAt: new Date("2097-09-01T00:00:00.000Z"),
      endsAt: new Date("2097-09-08T00:00:00.000Z"),
      status: "OPEN"
    }
  });
  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "AUT",
      awayTeam: "TST",
      kickoffTime: new Date("2097-09-03T17:00:00.000Z")
    }
  });
  await prisma.player.create({
    data: {
      id: playerId,
      name: "Auth Test QB",
      team: "AUT",
      position: "QB"
    }
  });
  await prisma.market.create({
    data: {
      id: marketId,
      playerId,
      weekId,
      gameId,
      position: "QB",
      thresholdType: "TOP_5",
      yesPrice: 0.45,
      noPrice: 0.55,
      openingPrice: 0.45,
      yesPool: 275,
      noPool: 225,
      volume: 0,
      openInterest: 0,
      status: "OPEN",
      kickoffTime: new Date("2097-09-03T17:00:00.000Z")
    }
  });
}

async function resetTestData() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@example.com" } },
        { email: "auth.admin@fantasyx.test" }
      ]
    },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { OR: [{ marketId }, { userId: { in: userIds } }] } });
  });
  await prisma.marketEvent.deleteMany({ where: { marketId } });
  await prisma.adminAuditLog.deleteMany({ where: { OR: [{ marketId }, { actorId: { in: userIds } }] } });
  await prisma.settlement.deleteMany({ where: { marketId } });
  await prisma.trade.deleteMany({ where: { marketId } });
  await prisma.position.deleteMany({ where: { marketId } });
  await prisma.leaderboardEntry.deleteMany({ where: { OR: [{ weekId }, { userId: { in: userIds } }] } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.market.deleteMany({ where: { id: marketId } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
}
