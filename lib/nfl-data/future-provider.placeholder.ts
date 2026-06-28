import type { INflDataProvider } from "./provider";
import type { NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord } from "./types";

/**
 * Placeholder for a future real sports-data provider (e.g. Sportradar, MySportsFeeds).
 *
 * To activate:
 * 1. Add API credentials to .env (SPORTS_DATA_API_KEY, SPORTS_DATA_BASE_URL)
 * 2. Implement each method against the provider's HTTP API
 * 3. Replace DemoNflDataProvider with FutureSportsDataProvider in the sync endpoint
 *
 * No real-money wagering, deposits, withdrawals, or mainnet crypto may be added.
 */
export class FutureSportsDataProvider implements INflDataProvider {
  readonly name = "future-sports-data";

  constructor(_apiKey: string) {
    // store credentials
  }

  async getTeams(): Promise<NflTeam[]> {
    throw new Error("FutureSportsDataProvider.getTeams() is not implemented yet.");
  }

  async getPlayers(): Promise<NflPlayerRecord[]> {
    throw new Error("FutureSportsDataProvider.getPlayers() is not implemented yet.");
  }

  async getGames(_season: number, _week: number): Promise<NflGameRecord[]> {
    throw new Error("FutureSportsDataProvider.getGames() is not implemented yet.");
  }

  async getWeeks(_season: number): Promise<NflWeekRecord[]> {
    throw new Error("FutureSportsDataProvider.getWeeks() is not implemented yet.");
  }

  async getSlate(_season: number, _week: number): Promise<NflSlateRecord> {
    throw new Error("FutureSportsDataProvider.getSlate() is not implemented yet.");
  }
}
