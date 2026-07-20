import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("FX017 FantasyX OS PWA and Live Sunday", () => {
  it("ships an installable PWA manifest with standalone launch settings", () => {
    const manifestPath = join(process.cwd(), "public", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name: string;
      start_url: string;
      display: string;
      theme_color: string;
      icons: Array<{ src: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("FantasyX OS");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#00D46A");
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("registers a service worker with an offline app shell", () => {
    const serviceWorkerPath = join(process.cwd(), "public", "sw.js");
    const offlinePath = join(process.cwd(), "public", "offline.html");
    const shellSource = readFileSync(join(process.cwd(), "components", "pwa-shell.tsx"), "utf8");
    const workerSource = readFileSync(serviceWorkerPath, "utf8");

    expect(existsSync(serviceWorkerPath)).toBe(true);
    expect(existsSync(offlinePath)).toBe(true);
    expect(shellSource).toContain("navigator.serviceWorker");
    expect(shellSource).toContain(".register(\"/sw.js\"");
    expect(workerSource).toContain("/offline.html");
    expect(workerSource).toContain("/live");
    expect(workerSource).toContain("/markets");
    expect(workerSource).toContain('url.pathname.startsWith("/api/")');
    expect(workerSource).toContain("networkWithCacheFallback");
  });

  it("renders a Live Sunday command center with required sections", () => {
    const liveSource = readFileSync(join(process.cwd(), "app", "live", "page.tsx"), "utf8");

    expect(liveSource).toContain("Live Sunday Command Center");
    expect(liveSource).toContain("LIVE GAMES");
    expect(liveSource).toContain("LIVE MARKET BOARD");
    expect(liveSource).toContain("TRADING TAPE");
    expect(liveSource).toContain("PORTFOLIO");
    expect(liveSource).toContain("TOP GAINERS");
    expect(liveSource).toContain("TOP LOSERS");
    expect(liveSource).toContain("LEADERBOARD");
    expect(liveSource).toContain("PLAYER TRACKER");
    expect(liveSource).toContain("WATCHLIST 2.0");
  });

  it("exposes Live Sunday and notification settings in navigation and settings", () => {
    const siteNav = readFileSync(join(process.cwd(), "components", "site-nav.tsx"), "utf8");
    const bottomNav = readFileSync(join(process.cwd(), "components", "bottom-nav.tsx"), "utf8");
    const settings = readFileSync(join(process.cwd(), "app", "settings", "page.tsx"), "utf8");

    expect(siteNav).toContain("\"/live\"");
    expect(bottomNav).toContain("\"/live\"");
    expect(settings).toContain("Market Alerts");
    expect(settings).toContain("Portfolio Alerts");
    expect(settings).toContain("Leaderboard Alerts");
    expect(settings).toContain("Sunday Live Alerts");
    expect(settings).toContain("Future Push Notifications");
  });
});
