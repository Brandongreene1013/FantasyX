import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type {
  NflTeam,
  NflPlayerRecord,
  NflGameRecord,
  NflWeekRecord,
  NflSlateRecord,
  NflPlayerStatus,
  NflProviderGameStatus
} from "@/lib/nfl-data/types";

const BASE = "https://api.sportsdata.io/v3/nfl";
const FETCH_TIMEOUT_MS = 15_000;

async function sdFetch<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "User-Agent": "FantasyX/1.0"
      }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SportsData.io API error ${res.status} on ${path}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// SportsData.io shape references (partial — only fields we use)
interface SdTeam { Key: string; City: string; Name: string; Conference: string; Division: string }
interface SdPlayer {
  PlayerID: number;
  Name: string;
  Position: string;
  Team: string | null;
  Status: string;
  InjuryStatus: string | null;
  IsUndraftedFreeAgent: boolean;
}
interface SdGame {
  GameKey: string | number;
  HomeTeam: string;
  AwayTeam: string;
  Date: string;
  DateTimeUTC?: string | null;
  Status?: string | null;
  HomeScore?: number | null;
  AwayScore?: number | null;
  Quarter?: string | number | null;
  TimeRemaining?: string | null;
  Possession?: string | null;
  LastUpdated?: string | null;
}
interface SdWeek { Week: number; Season: number; SeasonType: number }

function mapStatus(status: string, injuryStatus: string | null): NflPlayerStatus {
  if (injuryStatus === "Out")          return "OUT";
  if (injuryStatus === "Doubtful")     return "DOUBTFUL";
  if (injuryStatus === "Questionable") return "QUESTIONABLE";
  if (status === "Inactive")           return "OUT";
  return "ACTIVE";
}

const VALID_POS = new Set(["QB", "RB", "WR", "TE"]);

export function mapSportsDataGameStatus(status: string | null | undefined, period: string | number | null | undefined): NflProviderGameStatus {
  const normalized = status?.trim().toLowerCase();
  const normalizedPeriod = String(period ?? "").trim().toLowerCase();
  if (normalized === "final" || normalized === "f/ot" || normalized === "forfeit") return "FINAL";
  if (normalized === "suspended" || normalized === "delayed") return "DELAYED";
  if (normalized === "postponed") return "POSTPONED";
  if (normalized === "canceled" || normalized === "cancelled") return "CANCELED";
  if (normalized === "inprogress" || normalized === "in progress") {
    return normalizedPeriod === "half" || normalizedPeriod === "halftime" ? "HALFTIME" : "LIVE";
  }
  if (normalized === "scheduled") return "SCHEDULED";
  return "UNKNOWN";
}

/**
 * SportsData.io NFL provider (requires NFL_DATA_API_KEY).
 * API docs: https://sportsdata.io/developers/api-documentation/nfl
 */
export class SportsDataIoProvider implements INflDataProvider {
  readonly name = "SportsData.io";

  constructor(private readonly apiKey: string) {}

  async getTeams(): Promise<NflTeam[]> {
    const raw = await sdFetch<SdTeam[]>("/scores/json/Teams", this.apiKey);
    return raw.map((t) => ({
      abbreviation: t.Key,
      city: t.City,
      name: t.Name,
      conference: t.Conference as "AFC" | "NFC",
      division: t.Division as "East" | "West" | "North" | "South"
    }));
  }

  async getPlayers(): Promise<NflPlayerRecord[]> {
    const raw = await sdFetch<SdPlayer[]>("/scores/json/Players", this.apiKey);
    return raw
      .filter((p) => VALID_POS.has(p.Position) && p.Team && !p.IsUndraftedFreeAgent)
      .map((p) => ({
        externalId: String(p.PlayerID),
        name: p.Name,
        teamAbbreviation: p.Team ?? "FA",
        position: p.Position as "QB" | "RB" | "WR" | "TE",
        status: mapStatus(p.Status, p.InjuryStatus)
      }));
  }

  async getGames(season: number, week: number): Promise<NflGameRecord[]> {
    const raw = await sdFetch<SdGame[]>(`/scores/json/ScoresByWeek/${season}/${week}`, this.apiKey);
    return raw.map((g) => ({
      externalId: String(g.GameKey),
      homeTeam: g.HomeTeam,
      awayTeam: g.AwayTeam,
      kickoffTime: g.DateTimeUTC ?? g.Date,
      status: g.Status === null || g.Status === undefined ? undefined : mapSportsDataGameStatus(g.Status, g.Quarter),
      homeScore: g.HomeScore ?? null,
      awayScore: g.AwayScore ?? null,
      period: g.Quarter === null || g.Quarter === undefined ? null : String(g.Quarter),
      clock: g.TimeRemaining ?? null,
      possession: g.Possession ?? null,
      updatedAt: g.LastUpdated ?? null
    }));
  }

  async getWeeks(season: number): Promise<NflWeekRecord[]> {
    const raw = await sdFetch<SdWeek[]>(`/scores/json/Schedules/${season}`, this.apiKey);
    const weeks = new Map<number, NflWeekRecord>();

    for (const entry of raw) {
      if (entry.SeasonType !== 1) continue; // regular season only
      if (!weeks.has(entry.Week)) {
        // Approximate date ranges; SportsData doesn't expose week start/end directly
        const approxStart = new Date(`${season}-09-01`);
        approxStart.setDate(approxStart.getDate() + (entry.Week - 1) * 7);
        const approxEnd = new Date(approxStart);
        approxEnd.setDate(approxStart.getDate() + 6);
        weeks.set(entry.Week, {
          season: entry.Season,
          week: entry.Week,
          startsAt: approxStart.toISOString(),
          endsAt: approxEnd.toISOString()
        });
      }
    }

    return Array.from(weeks.values()).sort((a, b) => a.week - b.week);
  }

  async getSlate(season: number, week: number): Promise<NflSlateRecord> {
    // Slate (player-to-game mapping) is not directly available in a single endpoint.
    // Game-level player stats require the PlayerGameStatsByWeek endpoint.
    // For now return a minimal slate — use getGames() + getPlayers() for full sync.
    return { season, week, players: [] };
  }
}
