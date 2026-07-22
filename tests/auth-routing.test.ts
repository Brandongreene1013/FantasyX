import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";
import { safeInternalPath } from "@/lib/redirects";
import { sessionCookieName } from "@/lib/session";

describe("FX009.5 auth routing", () => {
  it("redirects logged-out admin routes to login with a safe next path", () => {
    const response = middleware(new NextRequest("http://localhost/admin?tab=summary"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fadmin%3Ftab%3Dsummary");
  });

  it("allows protected routes when a session cookie is present", () => {
    const response = middleware(new NextRequest("http://localhost/settings", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps login and signup reachable when a stale or forged cookie is present", () => {
    const loginResponse = middleware(new NextRequest("http://localhost/login", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));
    const signupResponse = middleware(new NextRequest("http://localhost/signup", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));

    expect(loginResponse.status).toBe(200);
    expect(signupResponse.status).toBe(200);
    expect(loginResponse.headers.get("location")).toBeNull();
    expect(signupResponse.headers.get("location")).toBeNull();
  });

  it("rejects external and protocol-relative next redirects", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("https://evil.example/phish")).toBe("/");
    expect(safeInternalPath("//evil.example/phish")).toBe("/");
    expect(safeInternalPath("/portfolio?view=open")).toBe("/portfolio?view=open");
  });

  it("includes account and settings in the middleware matcher", () => {
    expect(config.matcher).toContain("/live");
    expect(config.matcher).toContain("/account");
    expect(config.matcher).toContain("/settings");
    expect(config.matcher).toContain("/login");
    expect(config.matcher).toContain("/signup");
  });

  it("allows guest exploration and personal-page login prompts", () => {
    for (const path of ["/live", "/markets", "/markets/board", "/players/p_josh_allen", "/account", "/portfolio", "/history", "/settings"]) {
      const response = middleware(new NextRequest(`http://localhost${path}`));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("keeps player discovery public while protecting account data", () => {
    const marketsResponse = middleware(new NextRequest("http://localhost/markets"));
    const playerResponse = middleware(new NextRequest("http://localhost/players/p_josh_allen?threshold=TOP_5"));

    expect(marketsResponse.status).toBe(200);
    expect(playerResponse.status).toBe(200);
  });
});
