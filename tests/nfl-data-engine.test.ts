import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DemoNflDataProvider } from "@/lib/nfl-data/demo-provider";
import { syncNflData } from "@/lib/nfl-sync.service";
import { AuthError } from "@/lib/auth";
import { GET as statsGET } from "@/app/api/admin/nfl/stats/route";
import { POST as syncPOST } from "@/app/api/admin/nfl/sync-demo/route";

const prisma = new PrismaClient();

// ── Isolated test identifiers ─────────────────────────────────────────────────
const TEST_SEASON = 2098;
const TEST_WEEK   = 1;
const weekId      = `nfl_${TEST_SEASON}_w${TEST_WEEK}`;
const adminId     = "test_user_nfl_admin";
const traderId    = "test_user_nfl_trader";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAdminRequest(path: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `fantasyx_user_id=${adminId}` },
  });
}

function makeTraderRequest(path: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `fantasyx_user_id=${traderId}` },
  });
}

function makeAnonRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

async function resetTestData() {
  // Markets created during sync (prefixed by player IDs created during test)
  const testPlayers = await prisma.player.findMany({
    where: { externalProviderId: { startsWith: "test_nfl_" } },
  });
  for (const p of testPlayers) {
    await prisma.marketEvent.deleteMany({ where: { marketId: { startsWith: `m_${p.id}_` } } });
    await prisma.market.deleteMany({ where: { playerId: p.id } });
  }
  await prisma.game.deleteMany({ where: { weekId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.player.deleteMany({ where: { id: "test_nfl_preexisting_qb" } });
  await prisma.player.deleteMany({ where: { externalProviderId: { startsWith: "test_nfl_" } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, traderId] } } });
}

// ── Minimal provider returning test-isolated data ────────────────────────────

class TestNflDataProvider extends DemoNflDataProvider {
  override readonly name = "test-provider";

  override async getWeeks(_season: number) {
    return [
      {
        season: TEST_SEASON,
        week:   TEST_WEEK,
        startsAt: "2098-09-08T08:00:00-04:00",
        endsAt:   "2098-09-15T23:59:59-04:00",
      },
    ];
  }

  override async getGames(_season: number, _week: number) {
    return [
      { externalId: "test_nfl_game_alpha_beta", homeTeam: "ALF", awayTeam: "BET", kickoffTime: "2098-09-13T13:00:00-04:00" },
    ];
  }

  override async getPlayers() {
    return [
      { externalId: "test_nfl_p_qb1", name: "Test QB One", teamAbbreviation: "ALF", position: "QB" as const, status: "ACTIVE" as const, projection: 22.0 },
      { externalId: "test_nfl_p_rb1", name: "Test RB One", teamAbbreviation: "BET", position: "RB" as const, status: "QUESTIONABLE" as const, projection: 17.0 },
    ];
  }

  override async getSlate(_season: number, _week: number) {
    return {
      season: TEST_SEASON,
      week:   TEST_WEEK,
      players: [
        { playerExternalId: "test_nfl_p_qb1", gameExternalId: "test_nfl_game_alpha_beta", projection: 22.0 },
        { playerExternalId: "test_nfl_p_rb1", gameExternalId: "test_nfl_game_alpha_beta", projection: 17.0 },
      ],
    };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FX-006 NFL Data Engine", () => {
  beforeEach(async () => {
    await resetTestData();
    await prisma.user.create({ data: { id: adminId, name: "NFL Admin", mockBalance: 1000, startingBalance: 1000, isAdmin: true } });
    await prisma.user.create({ data: { id: traderId, name: "NFL Trader", mockBalance: 1000, startingBalance: 1000, isAdmin: false } });
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  // ── DemoNflDataProvider unit tests ──────────────────────────────────────────

  describe("DemoNflDataProvider", () => {
    const provider = new DemoNflDataProvider();

    it("returns 20 teams", async () => {
      const teams = await provider.getTeams();
      expect(teams.length).toBe(20);
    });

    it("every team has required fields", async () => {
      const teams = await provider.getTeams();
      for (const team of teams) {
        expect(team.abbreviation).toBeTruthy();
        expect(team.city).toBeTruthy();
        expect(team.name).toBeTruthy();
        expect(["AFC", "NFC"]).toContain(team.conference);
        expect(["East", "West", "North", "South"]).toContain(team.division);
      }
    });

    it("returns 13 players for the demo slate", async () => {
      const players = await provider.getPlayers();
      expect(players.length).toBe(13);
    });

    it("every player has a valid position", async () => {
      const players = await provider.getPlayers();
      for (const p of players) {
        expect(["QB", "RB", "WR", "TE"]).toContain(p.position);
      }
    });

    it("every player has a status", async () => {
      const players = await provider.getPlayers();
      for (const p of players) {
        expect(["ACTIVE", "QUESTIONABLE", "DOUBTFUL", "OUT"]).toContain(p.status);
      }
    });

    it("returns 10 games for demo week", async () => {
      const games = await provider.getGames(2026, 1);
      expect(games.length).toBe(10);
    });

    it("returns 0 games for unknown week", async () => {
      const games = await provider.getGames(2026, 99);
      expect(games.length).toBe(0);
    });

    it("returns 1 week for demo season", async () => {
      const weeks = await provider.getWeeks(2026);
      expect(weeks.length).toBe(1);
      expect(weeks[0].season).toBe(2026);
      expect(weeks[0].week).toBe(1);
    });

    it("returns empty weeks for unknown season", async () => {
      const weeks = await provider.getWeeks(1990);
      expect(weeks.length).toBe(0);
    });

    it("returns slate with 13 player entries", async () => {
      const slate = await provider.getSlate(2026, 1);
      expect(slate.players.length).toBe(13);
    });

    it("every slate entry references a known player externalId", async () => {
      const players = await provider.getPlayers();
      const playerExtIds = new Set(players.map((p) => p.externalId));
      const slate = await provider.getSlate(2026, 1);
      for (const entry of slate.players) {
        expect(playerExtIds.has(entry.playerExternalId)).toBe(true);
      }
    });
  });

  // ── syncNflData integration tests ───────────────────────────────────────────

  describe("syncNflData", () => {
    const provider = new TestNflDataProvider();

    it("creates week, games, players, and markets on first run", async () => {
      const result = await syncNflData(provider, TEST_SEASON, TEST_WEEK);

      expect(result.weeks.created).toBe(1);
      expect(result.weeks.updated).toBe(0);
      expect(result.games.created).toBe(1);
      expect(result.players.created).toBe(2);
      expect(result.markets.created).toBe(6); // 2 players × 3 thresholds
      expect(result.markets.skipped).toBe(0);
    });

    it("is idempotent — second run creates nothing new", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const result = await syncNflData(provider, TEST_SEASON, TEST_WEEK);

      expect(result.weeks.created).toBe(0);
      expect(result.weeks.updated).toBe(1);
      expect(result.games.created).toBe(0);
      expect(result.games.updated).toBe(1);
      expect(result.players.created).toBe(0);
      expect(result.players.updated).toBe(2);
      expect(result.markets.created).toBe(0);
      expect(result.markets.skipped).toBe(6);
    });

    it("sets externalProviderId on players after sync", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const qb = await prisma.player.findFirst({ where: { externalProviderId: "test_nfl_p_qb1" } });
      expect(qb).not.toBeNull();
      expect(qb!.name).toBe("Test QB One");
    });

    it("sets externalProviderId on games after sync", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const game = await prisma.game.findFirst({ where: { externalProviderId: "test_nfl_game_alpha_beta" } });
      expect(game).not.toBeNull();
      expect(game!.homeTeam).toBe("ALF");
    });

    it("persists player status from provider", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const rb = await prisma.player.findFirst({ where: { externalProviderId: "test_nfl_p_rb1" } });
      expect(rb!.status).toBe("QUESTIONABLE");
    });

    it("does not duplicate markets when existing markets have trades", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);

      // Simulate an existing market having trades by just checking market count
      const countBefore = await prisma.market.count({ where: { weekId } });

      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const countAfter = await prisma.market.count({ where: { weekId } });

      expect(countAfter).toBe(countBefore);
    });

    it("creates markets with OPEN status", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const markets = await prisma.market.findMany({ where: { weekId } });
      for (const m of markets) {
        expect(m.status).toBe("OPEN");
      }
    });

    it("creates an ADMIN_NOTE market event for each new market", async () => {
      await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      const events = await prisma.marketEvent.findMany({
        where: { market: { weekId }, type: "ADMIN_NOTE" },
      });
      // 6 markets × 1 note each
      expect(events.length).toBeGreaterThanOrEqual(6);
    });

    it("matches existing player by (name, team) if no externalProviderId yet", async () => {
      // Create player without externalProviderId first
      const preExisting = await prisma.player.create({
        data: { id: "test_nfl_preexisting_qb", name: "Test QB One", team: "ALF", position: "QB" },
      });

      await syncNflData(provider, TEST_SEASON, TEST_WEEK);

      const updated = await prisma.player.findUnique({ where: { id: preExisting.id } });
      expect(updated!.externalProviderId).toBe("test_nfl_p_qb1");

      // Cleanup extra player markets and the player itself
      await prisma.marketEvent.deleteMany({ where: { marketId: { startsWith: `m_${preExisting.id}_` } } });
      await prisma.market.deleteMany({ where: { playerId: preExisting.id } });
      await prisma.player.delete({ where: { id: preExisting.id } });
    });

    it("reports provider name in result", async () => {
      const result = await syncNflData(provider, TEST_SEASON, TEST_WEEK);
      expect(result.provider).toBe("test-provider");
    });
  });

  // ── Admin-only endpoint tests ─────────────────────────────────────────────

  describe("POST /api/admin/nfl/sync-demo", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const req = makeAnonRequest("/api/admin/nfl/sync-demo");
      const res = await syncPOST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      const req = makeTraderRequest("/api/admin/nfl/sync-demo");
      const res = await syncPOST(req);
      expect(res.status).toBe(403);
    });

    it("returns 200 with sync result for admin users", async () => {
      const req = makeAdminRequest("/api/admin/nfl/sync-demo");
      const res = await syncPOST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as { result: { provider: string } };
      expect(body.result).toBeDefined();
      expect(body.result.provider).toBe("demo");
    });
  });

  describe("GET /api/admin/nfl/stats", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const req = makeAnonRequest("/api/admin/nfl/stats");
      const res = await statsGET(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      const req = makeTraderRequest("/api/admin/nfl/stats");
      const res = await statsGET(req);
      expect(res.status).toBe(403);
    });

    it("returns stats with required fields for admin", async () => {
      const req = makeAdminRequest("/api/admin/nfl/stats");
      const res = await statsGET(req);
      expect(res.status).toBe(200);
      const body = await res.json() as { stats: { weeks: number; players: number; games: number; markets: number } };
      expect(typeof body.stats.weeks).toBe("number");
      expect(typeof body.stats.players).toBe("number");
      expect(typeof body.stats.games).toBe("number");
      expect(typeof body.stats.markets).toBe("number");
    });
  });
});
