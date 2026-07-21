import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tradeSchema } from "@/lib/api-validation";
import { summarizeGames } from "@/lib/live-games";
import { marketsViewUrl, resolveMarketView } from "@/lib/market-view";
import { assertQuoteFresh } from "@/lib/trade.service";

describe("unified markets and live experience", () => {
  it("lets an explicit query override the saved view and handles invalid values", () => {
    expect(resolveMarketView("board", "market")).toBe("board");
    expect(resolveMarketView(null, "board")).toBe("board");
    expect(resolveMarketView("invalid", "also-invalid")).toBe("market");
    expect(marketsViewUrl("board", "position=QB&view=market")).toBe("/markets?position=QB&view=board");
  });

  it("groups markets into honest game states without manufacturing scores", () => {
    const now = new Date("2026-09-10T18:00:00.000Z");
    const games = summarizeGames([
      market("live-1", "game-live", "2026-09-10T17:00:00.000Z", "OPEN"),
      market("upcoming-1", "game-upcoming", "2026-09-10T20:00:00.000Z", "OPEN"),
      market("final-1", "game-final", "2026-09-09T20:00:00.000Z", "SETTLED")
    ], now);

    expect(games.map((game) => game.status)).toEqual(["LIVE", "UPCOMING", "FINAL"]);
    expect(games.every((game) => game.homeScore === null && game.awayScore === null)).toBe(true);
  });

  it("validates a bounded client quote for stale-price protection", () => {
    const result = tradeSchema.parse({
      action: "BUY",
      marketId: "market-1",
      side: "YES",
      spend: 10,
      expectedPrice: 0.55,
      maxSlippageBps: 150
    });
    expect(result.expectedPrice).toBe(0.55);
    expect(result.maxSlippageBps).toBe(150);
    expect(() => tradeSchema.parse({ ...result, maxSlippageBps: 1001 })).toThrow();
    expect(() => assertQuoteFresh({ yesPrice: 0.6, noPrice: 0.4 }, "YES", 0.55, 200)).toThrowError(
      expect.objectContaining({ code: "STALE_QUOTE", status: 409 })
    );
    expect(() => assertQuoteFresh({ yesPrice: 0.56, noPrice: 0.44 }, "YES", 0.55, 200)).not.toThrow();
  });

  it("keeps one live data owner and exposes both unified market views", () => {
    const markets = source("app", "markets", "page.tsx");
    const redirect = source("app", "markets", "board", "page.tsx");
    expect(markets).toContain("MARKET_VIEW_STORAGE_KEY");
    expect(markets).toContain("MarketBoardView");
    expect(markets.match(/useLiveExchange\(/g)).toHaveLength(1);
    expect(redirect).toContain('redirect("/markets?view=board")');
  });

  it("keeps primary navigation focused and trade tickets action-aware", () => {
    const siteNav = source("components", "site-nav.tsx");
    const bottomNav = source("components", "bottom-nav.tsx");
    const tradePanel = source("components", "trade-panel.tsx");
    expect(siteNav).not.toContain('href: "/markets/board"');
    expect(bottomNav).not.toContain('href: "/markets/board"');
    for (const label of ["Markets", "Live", "Portfolio", "Leaderboard"]) {
      expect(siteNav).toContain(`label: "${label}"`);
      expect(bottomNav).toContain(`label: "${label}"`);
    }
    expect(tradePanel).toContain("initialAction");
    expect(tradePanel).toContain("expectedPrice");
    expect(tradePanel).toContain("fantasyx:data-changed");
  });
});

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function market(id: string, gameId: string, kickoffTime: string, status: "OPEN" | "SETTLED") {
  return {
    id,
    playerId: `player-${id}`,
    gameId,
    kickoffTime: new Date(kickoffTime),
    status,
    game: { id: gameId, homeTeam: "HOME", awayTeam: "AWAY", kickoffTime: new Date(kickoffTime) }
  };
}
