import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimitAdapter, RateLimitError } from "@/lib/rate-limit";
import { UpstashRateLimitAdapter } from "@/lib/rate-limit-upstash";
import {
  RATE_LIMITS,
  enforceRateLimit,
  getClientIp,
  getConfiguredRateLimiter,
  getRateLimiterStatus,
  resetRateLimiterForTests
} from "@/lib/rate-limit-config";

const REST_URL = "https://fake-db.upstash.io";
const REST_TOKEN = "fake-token-value";

function mockUpstashPipeline(count: number, ttlMs: number) {
  return vi.fn(async () =>
    new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: ttlMs }]), { status: 200 })
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetRateLimiterForTests();
});

describe("UpstashRateLimitAdapter", () => {
  it("allows requests under the limit and computes resetAt from PTTL", async () => {
    const fetchMock = mockUpstashPipeline(3, 42_000);
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UpstashRateLimitAdapter(REST_URL, REST_TOKEN);

    const before = Date.now();
    const result = await adapter.check("trade:user_1", 30, 60_000);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(27);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 42_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${REST_URL}/pipeline`);
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", "fx:rl:trade:user_1"],
      ["PEXPIRE", "fx:rl:trade:user_1", "60000", "NX"],
      ["PTTL", "fx:rl:trade:user_1"]
    ]);
  });

  it("rejects requests over the limit", async () => {
    vi.stubGlobal("fetch", mockUpstashPipeline(31, 30_000));
    const adapter = new UpstashRateLimitAdapter(REST_URL, REST_TOKEN);

    const result = await adapter.check("trade:user_1", 30, 60_000);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("starts a fresh window when the counter resets server-side", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ result: 11 }, { result: 1 }, { result: 500 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 60_000 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UpstashRateLimitAdapter(REST_URL, REST_TOKEN);

    const nearExpiry = await adapter.check("auth:1.2.3.4", 10, 60_000);
    const freshWindow = await adapter.check("auth:1.2.3.4", 10, 60_000);

    expect(nearExpiry.success).toBe(false);
    expect(freshWindow.success).toBe(true);
    expect(freshWindow.remaining).toBe(9);
  });

  it("fails open without leaking the token when Upstash is unreachable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const adapter = new UpstashRateLimitAdapter(REST_URL, REST_TOKEN);

    const result = await adapter.check("trade:user_1", 30, 60_000);

    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((call) => call.join(" ")).join(" ");
    expect(logged).not.toContain(REST_TOKEN);
  });

  it("fails open on a non-2xx Upstash response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const adapter = new UpstashRateLimitAdapter(REST_URL, REST_TOKEN);

    const result = await adapter.check("trade:user_1", 30, 60_000);

    expect(result.success).toBe(true);
  });
});

describe("rate limiter factory", () => {
  it("selects the Upstash adapter when env vars are present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", REST_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", REST_TOKEN);
    resetRateLimiterForTests();

    expect(getRateLimiterStatus().mode).toBe("durable");
    expect(getConfiguredRateLimiter()).toBeInstanceOf(UpstashRateLimitAdapter);
  });

  it("selects the Upstash adapter for Vercel KV integration credentials", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", REST_URL);
    vi.stubEnv("KV_REST_API_TOKEN", REST_TOKEN);
    resetRateLimiterForTests();

    expect(getRateLimiterStatus().mode).toBe("durable");
    expect(getConfiguredRateLimiter()).toBeInstanceOf(UpstashRateLimitAdapter);
  });

  it("falls back to the in-memory adapter with a single warning when env vars are absent", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRateLimiterForTests();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getRateLimiterStatus().mode).toBe("memory");
    expect(getConfiguredRateLimiter()).toBeInstanceOf(InMemoryRateLimitAdapter);
    getConfiguredRateLimiter();
    getConfiguredRateLimiter();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("enforceRateLimit", () => {
  it("allows requests under the limit and throws RateLimitError over it", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRateLimiterForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const route = { name: `test-${Date.now()}`, limit: 2, windowMs: 60_000 };
    await enforceRateLimit(route, "user_1");
    await enforceRateLimit(route, "user_1");

    await expect(enforceRateLimit(route, "user_1")).rejects.toBeInstanceOf(RateLimitError);
    // A different key is unaffected.
    await expect(enforceRateLimit(route, "user_2")).resolves.toBeUndefined();
  });

  it("maps RateLimitError to a 429 response with x-ratelimit headers via apiError", async () => {
    const { apiError } = await import("@/lib/api-response");
    const error = new RateLimitError(30, 0, Date.now() + 30_000);

    const response = apiError(error, "Trade failed");
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("x-ratelimit-limit")).toBe("30");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(Number(response.headers.get("x-ratelimit-reset"))).toBeGreaterThan(0);
  });
});

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for hop, then x-real-ip, then 'local'", () => {
    expect(getClientIp(new Request("http://test.local", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
    expect(getClientIp(new Request("http://test.local", { headers: { "x-real-ip": "8.8.8.8" } }))).toBe("8.8.8.8");
    expect(getClientIp(new Request("http://test.local"))).toBe("local");
  });
});

describe("route limit configuration", () => {
  it("keeps the agreed beta limits", () => {
    expect(RATE_LIMITS.trade).toMatchObject({ limit: 30, windowMs: 60_000 });
    expect(RATE_LIMITS.auth).toMatchObject({ limit: 10, windowMs: 60_000 });
    expect(RATE_LIMITS.betaEvents).toMatchObject({ limit: 60, windowMs: 60_000 });
  });
});
