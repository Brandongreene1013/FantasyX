import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { EnvConfigError, validateServerEnv } from "@/lib/env";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { GET as getHealth } from "@/app/api/health/route";
import { securityHeaders } from "@/next.config";

describe("FX-008 production readiness", () => {
  it("validates required server environment variables", () => {
    expect(() => validateServerEnv({ DATABASE_URL: "postgresql://example" })).not.toThrow();
    expect(() => validateServerEnv({ DATABASE_URL: "" })).toThrow(EnvConfigError);
  });

  it("returns production-safe fallback errors for unknown exceptions", async () => {
    const response = apiError(new Error("database password leaked"), "Could not load data");
    const body = await response.json() as { error: string; requestId: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Could not load data");
    expect(body.error).not.toContain("password");
    expect(body.requestId).toBeTruthy();
  });

  it("adds request IDs to API error responses", () => {
    const response = apiError(new Error("boom"), "Request failed") as NextResponse;
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("applies baseline browser security headers", () => {
    expect(securityHeaders).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(securityHeaders).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(securityHeaders).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload"
    });
  });

  it("validates cron credentials without accepting partial values", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-test-secret-value";
    try {
      expect(hasValidCronSecret(new Request("http://localhost", {
        headers: { authorization: "Bearer cron-test-secret-value" }
      }))).toBe(true);
      expect(hasValidCronSecret(new Request("http://localhost", {
        headers: { authorization: "Bearer cron-test-secret" }
      }))).toBe(false);
    } finally {
      process.env.CRON_SECRET = previous;
    }
  });

  it("exposes a cache-free shallow health check without dependency details", async () => {
    const response = await getHealth(new Request("http://localhost/api/health"));
    const body = await response.json() as { status: string; checks?: unknown };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.checks).toBeUndefined();
  });
});
