import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { EnvConfigError, validateServerEnv } from "@/lib/env";

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
});
