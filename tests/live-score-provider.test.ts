import { describe, expect, it } from "vitest";
import { mapSportsDataGameStatus } from "@/lib/nfl-data/providers/sportsdata-provider";
import { hasLiveGameData, parseDate } from "@/lib/live-score-sync.service";
import { summarizeGames } from "@/lib/live-games";
import { GET as syncLive } from "@/app/api/cron/sync-live/route";

describe("licensed live-score provider integration", () => {
  it("rejects unauthenticated live sync requests before provider or database work", async () => {
    const response = await syncLive(new Request("http://localhost/api/cron/sync-live"));
    expect(response.status).toBe(401);
  });

  it("normalizes SportsDataIO game states", () => {
    expect(mapSportsDataGameStatus("Scheduled", null)).toBe("SCHEDULED");
    expect(mapSportsDataGameStatus("InProgress", 3)).toBe("LIVE");
    expect(mapSportsDataGameStatus("InProgress", "Half")).toBe("HALFTIME");
    expect(mapSportsDataGameStatus("F/OT", "OT")).toBe("FINAL");
    expect(mapSportsDataGameStatus("Suspended", 2)).toBe("DELAYED");
    expect(mapSportsDataGameStatus("Postponed", null)).toBe("POSTPONED");
    expect(mapSportsDataGameStatus("Canceled", null)).toBe("CANCELED");
  });

  it("does not treat schedule-only providers as live score sources", () => {
    expect(hasLiveGameData({ externalId: "1", homeTeam: "BUF", awayTeam: "KC", kickoffTime: "2026-09-01T00:00:00Z" })).toBe(false);
    expect(hasLiveGameData({ externalId: "1", homeTeam: "BUF", awayTeam: "KC", kickoffTime: "2026-09-01T00:00:00Z", status: "LIVE" })).toBe(true);
    const fallback = new Date("2026-01-01T00:00:00Z");
    expect(parseDate("invalid", fallback)).toBe(fallback);
  });

  it("surfaces provider scores and marks stale live data", () => {
    const now = new Date("2026-09-10T18:05:00.000Z");
    const kickoff = new Date("2026-09-10T17:00:00.000Z");
    const games = summarizeGames([{
      id: "market-1",
      playerId: "player-1",
      gameId: "game-1",
      kickoffTime: kickoff,
      status: "OPEN",
      game: {
        id: "game-1",
        homeTeam: "BUF",
        awayTeam: "KC",
        kickoffTime: kickoff,
        providerStatus: "LIVE",
        homeScore: 14,
        awayScore: 10,
        period: "3",
        gameClock: "08:12",
        possession: "BUF",
        scoreProvider: "SportsData.io",
        scoreUpdatedAt: new Date("2026-09-10T18:02:00.000Z")
      }
    }], now);

    expect(games[0]).toMatchObject({
      status: "LIVE",
      homeScore: 14,
      awayScore: 10,
      period: "3",
      clock: "08:12",
      possession: "BUF",
      isDataStale: true,
      dataSource: "SportsData.io"
    });
  });
});
