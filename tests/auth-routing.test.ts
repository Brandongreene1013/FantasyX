import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";
import { safeInternalPath } from "@/lib/redirects";
import { sessionCookieName } from "@/lib/session";

describe("FX009.5 auth routing", () => {
  it("redirects logged-out protected routes to login with a safe next path", () => {
    const response = middleware(new NextRequest("http://localhost/account?tab=summary"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Faccount%3Ftab%3Dsummary");
  });

  it("allows protected routes when a session cookie is present", () => {
    const response = middleware(new NextRequest("http://localhost/settings", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects logged-in users away from login and signup", () => {
    const loginResponse = middleware(new NextRequest("http://localhost/login", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));
    const signupResponse = middleware(new NextRequest("http://localhost/signup", {
      headers: { cookie: `${sessionCookieName}=signed-session-token` }
    }));

    expect(loginResponse.headers.get("location")).toBe("http://localhost/markets");
    expect(signupResponse.headers.get("location")).toBe("http://localhost/markets");
  });

  it("rejects external and protocol-relative next redirects", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/markets");
    expect(safeInternalPath("//evil.example/phish")).toBe("/markets");
    expect(safeInternalPath("/portfolio?view=open")).toBe("/portfolio?view=open");
  });

  it("includes account and settings in the middleware matcher", () => {
    expect(config.matcher).toContain("/live");
    expect(config.matcher).toContain("/account");
    expect(config.matcher).toContain("/settings");
    expect(config.matcher).toContain("/login");
    expect(config.matcher).toContain("/signup");
  });

  it("protects Live Sunday mode for logged-in users", () => {
    const response = middleware(new NextRequest("http://localhost/live"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Flive");
  });
});
