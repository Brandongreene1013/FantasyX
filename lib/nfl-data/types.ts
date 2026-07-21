export type NflTeam = {
  abbreviation: string;
  city: string;
  name: string;
  conference: "AFC" | "NFC";
  division: "East" | "West" | "North" | "South";
};

export type NflPlayerStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT";
export type NflProviderGameStatus = "SCHEDULED" | "LIVE" | "HALFTIME" | "FINAL" | "DELAYED" | "POSTPONED" | "CANCELED" | "UNKNOWN";

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
  status?: NflProviderGameStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  period?: string | null;
  clock?: string | null;
  possession?: string | null;
  updatedAt?: string | null;
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

export type NflPlayerGameStats = {
  gameExternalId: string;
  playerExternalId: string;
  playerName: string;
  teamAbbreviation: string;
  stats: {
    passYards: number;
    passTDs: number;
    interceptions: number;
    rushYards: number;
    rushTDs: number;
    receptions: number;
    recYards: number;
    recTDs: number;
    fumbles: number;
    twoPointConv: number;
  };
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
