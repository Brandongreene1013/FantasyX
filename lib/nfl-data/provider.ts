import type { NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord } from "./types";

export interface INflDataProvider {
  readonly name: string;
  getTeams(): Promise<NflTeam[]>;
  getPlayers(): Promise<NflPlayerRecord[]>;
  getGames(season: number, week: number): Promise<NflGameRecord[]>;
  getWeeks(season: number): Promise<NflWeekRecord[]>;
  getSlate(season: number, week: number): Promise<NflSlateRecord>;
}
