export type NflTeam = {
  abbreviation: string;
  city: string;
  name: string;
  conference: "AFC" | "NFC";
  division: "East" | "West" | "North" | "South";
};

export type NflPlayerStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT";

export type NflPlayerRecord = {
  externalId: string;
  name: string;
  teamAbbreviation: string;
  position: "QB" | "RB" | "WR" | "TE";
  status: NflPlayerStatus;
  projection?: number;
};

export type NflGameRecord = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
};

export type NflWeekRecord = {
  season: number;
  week: number;
  startsAt: string;
  endsAt: string;
};

export type NflPlayerSlateEntry = {
  playerExternalId: string;
  gameExternalId: string;
  projection: number;
};

export type NflSlateRecord = {
  season: number;
  week: number;
  players: NflPlayerSlateEntry[];
};

export type NflSyncResult = {
  provider: string;
  season: number;
  week: number;
  weeks: { created: number; updated: number };
  teams: { total: number };
  players: { created: number; updated: number };
  games: { created: number; updated: number };
  markets: { created: number; skipped: number };
};
