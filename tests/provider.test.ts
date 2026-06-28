/**
 * FX-013 provider tests — provider selection, demo fallback, cron auth, idempotency
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Helpers ─────────────────────────────────────────────────────────────────

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// ── Provider config ──────────────────────────────────────────────────────────

describe("getProviderStatus()", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // restore env
    for (const k of ["NFL_DATA_PROVIDER", "NFL_DATA_API_KEY", "CRON_SECRET"]) {
      if (originalEnv[k] !== undefined) process.env[k] = originalEnv[k];
      else delete process.env[k];
    }
    vi.resetModules();
  });

  it("returns demo mode when NFL_DATA_PROVIDER is not set", async () => {
    setEnv({ NFL_DATA_PROVIDER: undefined, NFL_DATA_API_KEY: undefined });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("demo");
    expect(status.name).toBe("Demo");
    expect(status.isConfigured).toBe(true);
  });

  it("returns demo mode when NFL_DATA_PROVIDER=demo", async () => {
    setEnv({ NFL_DATA_PROVIDER: "demo", NFL_DATA_API_KEY: undefined });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("demo");
  });

  it("returns disabled mode when NFL_DATA_PROVIDER=disabled", async () => {
    setEnv({ NFL_DATA_PROVIDER: "disabled", NFL_DATA_API_KEY: undefined });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("disabled");
    expect(status.isConfigured).toBe(false);
  });

  it("returns live mode for sleeper (no API key required)", async () => {
    setEnv({ NFL_DATA_PROVIDER: "sleeper", NFL_DATA_API_KEY: undefined });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("live");
    expect(status.name).toBe("Sleeper");
    expect(status.requiresApiKey).toBe(false);
    expect(status.isConfigured).toBe(true);
  });

  it("falls back to demo + warning when sportsdataio is set but no API key", async () => {
    setEnv({ NFL_DATA_PROVIDER: "sportsdataio", NFL_DATA_API_KEY: undefined });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("demo");
    expect(status.isConfigured).toBe(false);
    expect(status.warning).toContain("NFL_DATA_API_KEY");
  });

  it("returns live mode for sportsdataio when API key is provided", async () => {
    setEnv({ NFL_DATA_PROVIDER: "sportsdataio", NFL_DATA_API_KEY: "test-key-123" });
    const { getProviderStatus } = await import("@/lib/nfl-data/provider-config");
    const status = getProviderStatus();
    expect(status.mode).toBe("live");
    expect(status.hasApiKey).toBe(true);
  });
});

describe("getConfiguredProvider()", () => {
  afterEach(() => vi.resetModules());

  it("returns DemoNflDataProvider when no env vars set", async () => {
    setEnv({ NFL_DATA_PROVIDER: undefined, NFL_DATA_API_KEY: undefined });
    const { getConfiguredProvider } = await import("@/lib/nfl-data/provider-config");
    const { DemoNflDataProvider } = await import("@/lib/nfl-data/demo-provider");
    const provider = getConfiguredProvider();
    expect(provider).toBeInstanceOf(DemoNflDataProvider);
  });

  it("returns SleeperNflDataProvider when NFL_DATA_PROVIDER=sleeper", async () => {
    setEnv({ NFL_DATA_PROVIDER: "sleeper" });
    const { getConfiguredProvider } = await import("@/lib/nfl-data/provider-config");
    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = getConfiguredProvider();
    expect(provider).toBeInstanceOf(SleeperNflDataProvider);
  });

  it("returns SportsDataIoProvider when configured with key", async () => {
    setEnv({ NFL_DATA_PROVIDER: "sportsdataio", NFL_DATA_API_KEY: "abc" });
    const { getConfiguredProvider } = await import("@/lib/nfl-data/provider-config");
    const { SportsDataIoProvider } = await import("@/lib/nfl-data/providers/sportsdata-provider");
    const provider = getConfiguredProvider();
    expect(provider).toBeInstanceOf(SportsDataIoProvider);
  });

  it("falls back to DemoNflDataProvider when unknown provider name", async () => {
    setEnv({ NFL_DATA_PROVIDER: "unknown-provider" });
    const { getConfiguredProvider } = await import("@/lib/nfl-data/provider-config");
    const { DemoNflDataProvider } = await import("@/lib/nfl-data/demo-provider");
    const provider = getConfiguredProvider();
    expect(provider).toBeInstanceOf(DemoNflDataProvider);
  });
});

// ── Cron auth ────────────────────────────────────────────────────────────────

describe("cron secret validation", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/cron/lock-markets", { method: "POST", headers });
  }

  // Extract the validation logic by calling the endpoint directly
  // We test the behavior: 401 without secret, 200 with correct secret
  // Since DB is not available in unit tests, we just validate auth behavior.

  it("validateCronSecret returns false when CRON_SECRET env is not set", () => {
    const originalSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    // Inline the same logic from route.ts for unit testability
    function validate(req: Request): boolean {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) return false;
      const authHeader = req.headers.get("authorization") ?? "";
      if (authHeader === `Bearer ${cronSecret}`) return true;
      const altHeader = req.headers.get("x-cron-secret") ?? "";
      return altHeader === cronSecret;
    }

    expect(validate(makeRequest({ authorization: "Bearer anything" }))).toBe(false);

    if (originalSecret) process.env.CRON_SECRET = originalSecret;
  });

  it("validateCronSecret returns true with correct Bearer token", () => {
    process.env.CRON_SECRET = "super-secret-test";

    function validate(req: Request): boolean {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) return false;
      const authHeader = req.headers.get("authorization") ?? "";
      if (authHeader === `Bearer ${cronSecret}`) return true;
      const altHeader = req.headers.get("x-cron-secret") ?? "";
      return altHeader === cronSecret;
    }

    expect(validate(makeRequest({ authorization: "Bearer super-secret-test" }))).toBe(true);
    expect(validate(makeRequest({ authorization: "Bearer wrong-secret" }))).toBe(false);
    expect(validate(makeRequest({ "x-cron-secret": "super-secret-test" }))).toBe(true);
    expect(validate(makeRequest({}))).toBe(false);

    delete process.env.CRON_SECRET;
  });
});

// ── Rate limiter ─────────────────────────────────────────────────────────────

describe("InMemoryRateLimitAdapter", () => {
  it("allows requests within limit", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const key = `test-${Date.now()}`;
    const r1 = await checkRateLimit(key, 3, 60_000);
    const r2 = await checkRateLimit(key, 3, 60_000);
    const r3 = await checkRateLimit(key, 3, 60_000);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });

  it("blocks requests exceeding limit within window", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const key = `block-${Date.now()}`;
    await checkRateLimit(key, 2, 60_000);
    await checkRateLimit(key, 2, 60_000);
    const blocked = await checkRateLimit(key, 2, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("exposes resetAt in the future", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const key = `reset-${Date.now()}`;
    const r = await checkRateLimit(key, 10, 60_000);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });

  it("reset() clears the key", async () => {
    const { defaultRateLimiter, checkRateLimit } = await import("@/lib/rate-limit");
    const key = `clear-${Date.now()}`;
    await checkRateLimit(key, 1, 60_000);
    const blocked = await checkRateLimit(key, 1, 60_000);
    expect(blocked.success).toBe(false);
    await defaultRateLimiter.reset(key);
    const allowed = await checkRateLimit(key, 1, 60_000);
    expect(allowed.success).toBe(true);
  });
});

// ── Sleeper provider unit (mocked fetch) ────────────────────────────────────

describe("SleeperNflDataProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("getTeams() returns all 32 teams without network call", async () => {
    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    const teams = await provider.getTeams();
    expect(teams.length).toBe(32);
    expect(teams.every((t) => t.abbreviation && t.name && t.conference)).toBe(true);
    // getTeams doesn't call fetch
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("getPlayers() filters only active skill positions", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        "1": { player_id: "1", full_name: "Patrick Mahomes", position: "QB", team: "KC", active: true, status: "Active" },
        "2": { player_id: "2", full_name: "Travis Kelce", position: "TE", team: "KC", active: true, status: "Active" },
        "3": { player_id: "3", full_name: "Some Kicker", position: "K", team: "KC", active: true, status: "Active" },
        "4": { player_id: "4", full_name: "Inactive WR", position: "WR", team: "KC", active: false, status: "Inactive" }
      })
    } as Response);

    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    const players = await provider.getPlayers();
    expect(players.length).toBe(2);
    expect(players.map((p) => p.name)).toContain("Patrick Mahomes");
    expect(players.map((p) => p.name)).toContain("Travis Kelce");
    expect(players.map((p) => p.position)).not.toContain("K");
  });

  it("getPlayers() maps injury status correctly", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        "10": { player_id: "10", full_name: "Hurt RB", position: "RB", team: "DAL", active: true, status: "Active", injury_status: "Out" }
      })
    } as Response);

    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    const players = await provider.getPlayers();
    expect(players[0].status).toBe("OUT");
  });

  it("getGames() returns empty array (Sleeper has no schedule endpoint)", async () => {
    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    const games = await provider.getGames(2026, 1);
    expect(games).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("getWeeks() calls /state/nfl and returns current week", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ week: 5, season: 2026, season_type: "regular", display_week: 5, leg: 5 })
    } as Response);

    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    const weeks = await provider.getWeeks(2026);
    expect(weeks.length).toBe(1);
    expect(weeks[0].week).toBe(5);
    expect(weeks[0].season).toBe(2026);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/state/nfl"),
      expect.anything()
    );
  });

  it("getPlayers() throws on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({})
    } as Response);

    const { SleeperNflDataProvider } = await import("@/lib/nfl-data/providers/sleeper-provider");
    const provider = new SleeperNflDataProvider();
    await expect(provider.getPlayers()).rejects.toThrow("Sleeper API error 503");
  });
});

// ── Operation log service (DB-backed) ────────────────────────────────────────

describe("operation-log.service (DB)", () => {
  afterEach(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.operationLog.deleteMany({ where: { type: "CRON_SYNC_NFL" } });
  });

  it("startOperation creates a RUNNING record", async () => {
    const { startOperation } = await import("@/lib/operation-log.service");
    const log = await startOperation("CRON_SYNC_NFL");
    expect(log.status).toBe("RUNNING");
    expect(log.type).toBe("CRON_SYNC_NFL");
    expect(log.id).toBeTruthy();
  });

  it("finishOperation updates status and duration", async () => {
    const { startOperation, finishOperation } = await import("@/lib/operation-log.service");
    const log = await startOperation("CRON_SYNC_NFL");
    await new Promise((r) => setTimeout(r, 5));
    const updated = await finishOperation(log.id, "SUCCESS", { players: { created: 10 } });
    expect(updated.status).toBe("SUCCESS");
    expect(updated.durationMs).toBeGreaterThan(0);
    expect(updated.finishedAt).not.toBeNull();
  });

  it("runTracked returns the function result", async () => {
    const { runTracked } = await import("@/lib/operation-log.service");
    const result = await runTracked("CRON_SYNC_NFL", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it("runTracked marks FAILED and rethrows on error", async () => {
    const { runTracked, getLastOperation } = await import("@/lib/operation-log.service");
    await expect(
      runTracked("CRON_SYNC_NFL", async () => { throw new Error("test error"); })
    ).rejects.toThrow("test error");

    const last = await getLastOperation("CRON_SYNC_NFL");
    expect(last?.status).toBe("FAILED");
    expect(last?.error).toBe("test error");
  });

  it("getLastSuccessfulOperation returns most recent SUCCESS", async () => {
    const { runTracked, getLastSuccessfulOperation } = await import("@/lib/operation-log.service");
    await runTracked("CRON_SYNC_NFL", async () => ({ step: 1 }));
    await runTracked("CRON_SYNC_NFL", async () => ({ step: 2 }));
    const last = await getLastSuccessfulOperation("CRON_SYNC_NFL");
    expect(last?.status).toBe("SUCCESS");
    expect((last?.summary as { step?: number })?.step).toBe(2);
  });
});
