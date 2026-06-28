import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateMarketsForWeek, bulkMarketAction } from "@/lib/market-generation.service";
import { createWeek, updateWeekStatus } from "@/lib/week.service";
import { getTemplatesForPosition, getAllTemplates } from "@/lib/market-template.service";
import { POST as generatePOST } from "@/app/api/admin/markets/generate/route";
import { POST as bulkPOST } from "@/app/api/admin/markets/bulk-action/route";
import { GET as weeksGET, POST as weeksPOST } from "@/app/api/admin/weeks/route";
import { sessionCookieName } from "@/lib/session";
import { createSession } from "@/lib/session-store";
import { csrfTokenForRequest } from "@/lib/csrf";

const prisma = new PrismaClient();

const TEST_SEASON = 2097;
const TEST_WEEK   = 11;
const weekId      = `nfl_${TEST_SEASON}_w${TEST_WEEK}`;
const adminId     = "test_mgen_admin";
const traderId    = "test_mgen_trader";
const testPlayerId = "test_mgen_player_qb";

let adminSessionCookie = "";
let traderSessionCookie = "";

function makeAdminRequest(path: string, body?: unknown): Request {
  const cookie = adminSessionCookie;
  const req = new Request(`http://localhost${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { cookie, "content-type": "application/json", "x-csrf-token": csrfTokenForRequest(new Request("http://localhost", { headers: { cookie } })) ?? "" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return req;
}

function makeTraderRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { cookie: traderSessionCookie, "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

beforeEach(async () => {
  // Clean up test data in dependency order
  await prisma.adminAuditLog.deleteMany({ where: { weekId } });
  await prisma.marketEvent.deleteMany({ where: { market: { weekId } } });
  await prisma.market.deleteMany({ where: { weekId } });
  await prisma.game.deleteMany({ where: { weekId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.player.deleteMany({ where: { id: testPlayerId } });

  await prisma.user.deleteMany({ where: { id: { in: [adminId, traderId] } } });

  await prisma.user.createMany({
    data: [
      { id: adminId, name: "Test Admin", email: `test-mgen-admin-${Date.now()}@test.com`, isAdmin: true, role: "ADMIN", mockBalance: 10000, startingBalance: 10000 },
      { id: traderId, name: "Test Trader", email: `test-mgen-trader-${Date.now()}@test.com`, role: "TRADER", mockBalance: 10000, startingBalance: 10000 }
    ]
  });

  await prisma.player.create({
    data: { id: testPlayerId, name: "Test QB Player", team: "TST", position: "QB", status: "ACTIVE" }
  });

  const adminToken = await createSession(adminId);
  const traderToken = await createSession(traderId);
  adminSessionCookie = `${sessionCookieName}=${adminToken}`;
  traderSessionCookie = `${sessionCookieName}=${traderToken}`;
});

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { weekId } });
  await prisma.marketEvent.deleteMany({ where: { market: { weekId } } });
  await prisma.market.deleteMany({ where: { weekId } });
  await prisma.game.deleteMany({ where: { weekId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.player.deleteMany({ where: { id: testPlayerId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, traderId] } } });
  await prisma.$disconnect();
});

// ── Template tests ────────────────────────────────────────────────────────────

describe("Market Templates", () => {
  it("returns QB templates with correct thresholds", () => {
    const templates = getTemplatesForPosition("QB");
    expect(templates).toHaveLength(2);
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_3");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_5");
  });

  it("returns RB templates with correct thresholds", () => {
    const templates = getTemplatesForPosition("RB");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_5");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_10");
  });

  it("returns WR templates with correct thresholds", () => {
    const templates = getTemplatesForPosition("WR");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_5");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_10");
  });

  it("returns TE templates with correct thresholds", () => {
    const templates = getTemplatesForPosition("TE");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_3");
    expect(templates.map((t) => t.thresholdType)).toContain("TOP_5");
  });

  it("returns 8 total templates", () => {
    expect(getAllTemplates()).toHaveLength(8);
  });
});

// ── Week service tests ────────────────────────────────────────────────────────

describe("Week Service", () => {
  it("creates a week successfully", async () => {
    const week = await createWeek({
      season: TEST_SEASON,
      week: TEST_WEEK,
      startsAt: new Date("2097-09-01T00:00:00Z"),
      endsAt: new Date("2097-09-07T23:59:59Z"),
      adminId
    });
    expect(week.id).toBe(weekId);
    expect(week.status).toBe("SCHEDULED");
    expect(week.marketCount).toBe(0);
  });

  it("throws if week already exists", async () => {
    await createWeek({
      season: TEST_SEASON,
      week: TEST_WEEK,
      startsAt: new Date("2097-09-01T00:00:00Z"),
      endsAt: new Date("2097-09-07T23:59:59Z"),
      adminId
    });
    await expect(
      createWeek({ season: TEST_SEASON, week: TEST_WEEK, startsAt: new Date(), endsAt: new Date(), adminId })
    ).rejects.toThrow(/already exists/);
  });

  it("activates and deactivates a week", async () => {
    await createWeek({
      season: TEST_SEASON,
      week: TEST_WEEK,
      startsAt: new Date("2097-09-01T00:00:00Z"),
      endsAt: new Date("2097-09-07T23:59:59Z"),
      adminId
    });

    const active = await updateWeekStatus(weekId, "ACTIVE", adminId);
    expect(active.status).toBe("ACTIVE");

    const scheduled = await updateWeekStatus(weekId, "SCHEDULED", adminId);
    expect(scheduled.status).toBe("SCHEDULED");
  });

  it("archives a week", async () => {
    await createWeek({
      season: TEST_SEASON,
      week: TEST_WEEK,
      startsAt: new Date("2097-09-01T00:00:00Z"),
      endsAt: new Date("2097-09-07T23:59:59Z"),
      adminId
    });

    const archived = await updateWeekStatus(weekId, "ARCHIVED", adminId);
    expect(archived.status).toBe("ARCHIVED");
  });
});

// ── Market generation tests ───────────────────────────────────────────────────

describe("Market Generation", () => {
  beforeEach(async () => {
    await prisma.nflWeek.upsert({
      where: { id: weekId },
      create: { id: weekId, season: TEST_SEASON, week: TEST_WEEK, startsAt: new Date("2097-09-01T00:00:00Z"), endsAt: new Date("2097-09-07T23:59:59Z"), status: "SCHEDULED" },
      update: {}
    });
  });

  it("generates markets for specified players", async () => {
    const result = await generateMarketsForWeek({ weekId, adminId, playerIds: [testPlayerId] });
    expect(result.marketsCreated).toBeGreaterThan(0);
    expect(result.playersProcessed).toBe(1);
  });

  it("skips duplicate markets (idempotent)", async () => {
    const result1 = await generateMarketsForWeek({ weekId, adminId, playerIds: [testPlayerId] });
    const result2 = await generateMarketsForWeek({ weekId, adminId, playerIds: [testPlayerId] });

    expect(result2.marketsCreated).toBe(0);
    expect(result2.marketsSkipped).toBe(result1.marketsCreated);
  });

  it("creates markets with DRAFT status when requested", async () => {
    const result = await generateMarketsForWeek({ weekId, adminId, initialStatus: "DRAFT" as const, playerIds: [testPlayerId] });
    expect(result.marketsCreated).toBeGreaterThan(0);

    const draftMarkets = await prisma.market.findMany({ where: { weekId, status: "DRAFT" } });
    expect(draftMarkets.length).toBeGreaterThan(0);
  });

  it("creates markets with OPEN status by default", async () => {
    const result = await generateMarketsForWeek({ weekId, adminId, playerIds: [testPlayerId] });
    expect(result.marketsCreated).toBeGreaterThan(0);

    const openMarkets = await prisma.market.findMany({ where: { weekId, status: "OPEN" } });
    expect(openMarkets.length).toBeGreaterThan(0);
  });
});

// ── Bulk action tests ─────────────────────────────────────────────────────────

describe("Bulk Market Actions", () => {
  beforeEach(async () => {
    await prisma.nflWeek.upsert({
      where: { id: weekId },
      create: { id: weekId, season: TEST_SEASON, week: TEST_WEEK, startsAt: new Date("2097-09-01T00:00:00Z"), endsAt: new Date("2097-09-07T23:59:59Z"), status: "ACTIVE" },
      update: {}
    });
    await generateMarketsForWeek({ weekId, adminId, initialStatus: "OPEN", playerIds: [testPlayerId] });
  });

  it("bulk locks all open markets", async () => {
    const result = await bulkMarketAction(weekId, "LOCK", adminId);
    expect(result.affected).toBeGreaterThan(0);
    expect(result.action).toBe("LOCK");

    const locked = await prisma.market.findMany({ where: { weekId, status: "LOCKED" } });
    expect(locked.length).toBe(result.affected);
  });

  it("bulk opens all locked markets", async () => {
    await bulkMarketAction(weekId, "LOCK", adminId);
    const result = await bulkMarketAction(weekId, "OPEN", adminId);
    expect(result.affected).toBeGreaterThan(0);
    expect(result.action).toBe("OPEN");
  });

  it("bulk void skips already settled markets", async () => {
    const markets = await prisma.market.findMany({ where: { weekId }, take: 1 });
    if (markets.length > 0) {
      await prisma.market.update({ where: { id: markets[0].id }, data: { status: "SETTLED" } });
    }

    const result = await bulkMarketAction(weekId, "VOID", adminId);
    // Settled markets are skipped
    const settled = await prisma.market.findMany({ where: { weekId, status: "SETTLED" } });
    expect(settled.length).toBe(1);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it("throws if week not found", async () => {
    await expect(bulkMarketAction("nfl_9999_w99", "LOCK", adminId)).rejects.toThrow(/not found/);
  });
});

// ── API authorization tests ────────────────────────────────────────────────────

describe("Market Generation API — authorization", () => {
  it("rejects non-admin generate request", async () => {
    const req = makeTraderRequest("/api/admin/markets/generate", { weekId });
    const res = await generatePOST(req);
    expect(res.status).toBe(403);
  });

  it("rejects non-admin bulk action request", async () => {
    const req = makeTraderRequest("/api/admin/markets/bulk-action", { weekId, action: "LOCK" });
    const res = await bulkPOST(req);
    expect(res.status).toBe(403);
  });

  it("rejects non-admin week list request", async () => {
    const req = makeTraderRequest("/api/admin/weeks");
    const res = await weeksGET(req);
    expect(res.status).toBe(403);
  });

  it("rejects non-admin create week request", async () => {
    const req = makeTraderRequest("/api/admin/weeks", { season: 2099, week: 1, startsAt: new Date().toISOString(), endsAt: new Date().toISOString() });
    const res = await weeksPOST(req);
    expect(res.status).toBe(403);
  });
});

// ── API integration tests ──────────────────────────────────────────────────────

describe("Weeks API", () => {
  it("admin can list weeks", async () => {
    const req = makeAdminRequest("/api/admin/weeks");
    const res = await weeksGET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { weeks: unknown[] };
    expect(Array.isArray(body.weeks)).toBe(true);
  });

  it("admin can create a week", async () => {
    const body = { season: TEST_SEASON, week: TEST_WEEK, startsAt: "2097-09-01T00:00:00.000Z", endsAt: "2097-09-07T23:59:59.000Z" };
    const cookie = adminSessionCookie;
    const req = new Request("http://localhost/api/admin/weeks", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "x-csrf-token": csrfTokenForRequest(new Request("http://localhost", { headers: { cookie } })) ?? "" },
      body: JSON.stringify(body)
    });
    const res = await weeksPOST(req);
    expect(res.status).toBe(201);
    const resBody = await res.json() as { week: { id: string } };
    expect(resBody.week.id).toBe(weekId);
  });

  it("admin can generate markets", async () => {
    await prisma.nflWeek.upsert({
      where: { id: weekId },
      create: { id: weekId, season: TEST_SEASON, week: TEST_WEEK, startsAt: new Date("2097-09-01T00:00:00Z"), endsAt: new Date("2097-09-07T23:59:59Z"), status: "SCHEDULED" },
      update: {}
    });
    const req = makeAdminRequest("/api/admin/markets/generate", { weekId, playerIds: [testPlayerId] });
    const res = await generatePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { result: { marketsCreated: number } };
    expect(typeof body.result.marketsCreated).toBe("number");
  });
});
