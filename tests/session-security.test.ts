import { describe, expect, it } from "vitest";
import { readSessionCookie, signSessionToken, verifySessionToken } from "@/lib/session-store";
import { sessionCookieName } from "@/lib/session";
import { POST as postTrade } from "@/app/api/trades/route";

describe("session input hardening", () => {
  it("ignores malformed percent-encoded cookies so guest routes keep working", () => {
    const request = new Request("http://localhost/api/session", {
      headers: { cookie: `${sessionCookieName}=%E0%A4%A; theme=dark` }
    });

    expect(() => readSessionCookie(request)).not.toThrow();
    expect(readSessionCookie(request)).toBeNull();
  });

  it("rejects signed tokens with trailing fields", () => {
    const signed = signSessionToken("test-session-token");
    expect(verifySessionToken(signed)).toBe("test-session-token");
    expect(verifySessionToken(`${signed}.attacker-controlled`)).toBeNull();
  });

  it("rejects unauthenticated trades before parsing attacker-controlled JSON", async () => {
    const response = await postTrade(new Request("http://localhost/api/trades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json"
    }));

    expect(response.status).toBe(401);
  });
});
