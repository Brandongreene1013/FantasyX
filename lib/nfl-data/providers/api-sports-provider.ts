import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type {
  NflGameRecord,
  NflPlayerGameStats,
  NflPlayerRecord,
  NflProviderGameStatus,
  NflSlateRecord,
  NflTeam,
  NflWeekRecord
} from "@/lib/nfl-data/types";

const BASE = "https://v1.american-football.api-sports.io";
const NFL_LEAGUE_ID = 1;
const FETCH_TIMEOUT_MS = 15_000;
const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

type ApiEnvelope<T> = {
  errors?: unknown[] | Record<string, string>;
  response: T;
};

type ApiTeam = { id: number; name: string; code: string | null; city: string | null };
type ApiPlayer = { id: number; name: string; position: string | null };
type ApiGame = {
  game: {
    id: number;
    week: string | number | null;
    date: { timestamp?: number | null; date?: string | null; time?: string | null };
    status: { short?: string | null; long?: string | null; timer?: string | number | null };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  scores?: {
    home?: { total?: number | null };
    away?: { total?: number | null };
  };
};
type ApiPlayerStatsTeam = {
  team: { id: number; name: string };
  groups: Array<{
    name: string;
    players: Array<{
      player: { id: number; name: string };
      statistics: Array<{ name: string; value: string | number | null }>;
    }>;
  }>;
};

const TEAM_META: Record<string, Pick<NflTeam, "conference" | "division">> = {
  BUF: { conference: "AFC", division: "East" }, MIA: { conference: "AFC", division: "East" }, NE: { conference: "AFC", division: "East" }, NYJ: { conference: "AFC", division: "East" },
  BAL: { conference: "AFC", division: "North" }, CIN: { conference: "AFC", division: "North" }, CLE: { conference: "AFC", division: "North" }, PIT: { conference: "AFC", division: "North" },
  HOU: { conference: "AFC", division: "South" }, IND: { conference: "AFC", division: "South" }, JAX: { conference: "AFC", division: "South" }, TEN: { conference: "AFC", division: "South" },
  DEN: { conference: "AFC", division: "West" }, KC: { conference: "AFC", division: "West" }, LV: { conference: "AFC", division: "West" }, LAC: { conference: "AFC", division: "West" },
  DAL: { conference: "NFC", division: "East" }, NYG: { conference: "NFC", division: "East" }, PHI: { conference: "NFC", division: "East" }, WAS: { conference: "NFC", division: "East" }, WSH: { conference: "NFC", division: "East" },
  CHI: { conference: "NFC", division: "North" }, DET: { conference: "NFC", division: "North" }, GB: { conference: "NFC", division: "North" }, MIN: { conference: "NFC", division: "North" },
  ATL: { conference: "NFC", division: "South" }, CAR: { conference: "NFC", division: "South" }, NO: { conference: "NFC", division: "South" }, TB: { conference: "NFC", division: "South" },
  ARI: { conference: "NFC", division: "West" }, LAR: { conference: "NFC", division: "West" }, SF: { conference: "NFC", division: "West" }, SEA: { conference: "NFC", division: "West" }
};

async function apiFetch<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { "x-apisports-key": apiKey }
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`API-Sports error ${response.status} on ${path}: ${body.slice(0, 200)}`);
    }
    const payload = await response.json() as ApiEnvelope<T>;
    if (hasApiErrors(payload.errors)) {
      throw new Error(`API-Sports returned an error on ${path}`);
    }
    return payload.response;
  } finally {
    clearTimeout(timer);
  }
}

function hasApiErrors(errors: ApiEnvelope<unknown>["errors"]) {
  if (!errors) return false;
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
}

function normalizeTeamCode(code: string | null | undefined, name: string) {
  const normalized = code?.trim().toUpperCase();
  if (normalized === "JAC") return "JAX";
  if (normalized === "WSH") return "WAS";
  if (normalized && TEAM_META[normalized]) return normalized;
  const byName: Record<string, string> = {
    "Washington Commanders": "WAS",
    "Los Angeles Rams": "LAR",
    "Los Angeles Chargers": "LAC",
    "Las Vegas Raiders": "LV"
  };
  return byName[name] ?? normalized ?? name.slice(0, 3).toUpperCase();
}

export function mapApiSportsGameStatus(status: string | null | undefined): NflProviderGameStatus {
  switch (status?.trim().toUpperCase()) {
    case "NS": return "SCHEDULED";
    case "Q1": case "Q2": case "Q3": case "Q4": case "OT": return "LIVE";
    case "HT": return "HALFTIME";
    case "FT": case "AOT": return "FINAL";
    case "PST": return "POSTPONED";
    case "CANC": return "CANCELED";
    default: return "UNKNOWN";
  }
}

function weekNumber(value: string | number | null) {
  const normalized = String(value ?? "").trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const match = normalized.match(/(?:week|regular season)\s*-?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function currentNflSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() < 2 ? year - 1 : year;
}

function kickoffIso(game: ApiGame["game"]) {
  if (game.date.timestamp) return new Date(game.date.timestamp * 1000).toISOString();
  const candidate = `${game.date.date ?? ""}T${game.date.time ?? "00:00"}:00Z`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function numeric(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyStats(): NflPlayerGameStats["stats"] {
  return { passYards: 0, passTDs: 0, interceptions: 0, rushYards: 0, rushTDs: 0, receptions: 0, recYards: 0, recTDs: 0, fumbles: 0, twoPointConv: 0 };
}

export function normalizeApiSportsPlayerStats(gameExternalId: string, teams: ApiPlayerStatsTeam[], teamCodes: Map<number, string>) {
  const players = new Map<string, NflPlayerGameStats>();
  for (const team of teams) {
    for (const group of team.groups ?? []) {
      const groupName = group.name.trim().toLowerCase();
      for (const entry of group.players ?? []) {
        const key = String(entry.player.id);
        const record = players.get(key) ?? {
          gameExternalId,
          playerExternalId: key,
          playerName: entry.player.name,
          teamAbbreviation: teamCodes.get(team.team.id) ?? normalizeTeamCode(null, team.team.name),
          stats: emptyStats()
        };
        for (const statistic of entry.statistics ?? []) {
          const name = statistic.name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
          const value = numeric(statistic.value);
          if (groupName === "passing" && name === "yards") record.stats.passYards = value;
          else if (groupName === "passing" && name.includes("touch down")) record.stats.passTDs = value;
          else if (groupName === "passing" && name === "interceptions") record.stats.interceptions = value;
          else if (groupName === "rushing" && name === "yards") record.stats.rushYards = value;
          else if (groupName === "rushing" && name.includes("touch down")) record.stats.rushTDs = value;
          else if (groupName === "receiving" && name === "receptions") record.stats.receptions = value;
          else if (groupName === "receiving" && name === "yards") record.stats.recYards = value;
          else if (groupName === "receiving" && name.includes("touch down")) record.stats.recTDs = value;
          else if (groupName === "fumbles" && name.includes("lost")) record.stats.fumbles = value;
          else if (name === "two pt" || name.includes("two point")) record.stats.twoPointConv += value;
        }
        players.set(key, record);
      }
    }
  }
  return Array.from(players.values());
}

export class ApiSportsNflProvider implements INflDataProvider {
  readonly name = "API-Sports (Beta)";
  private teamPromise?: Promise<ApiTeam[]>;
  private gamePromises = new Map<number, Promise<ApiGame[]>>();
  private playerPromise?: Promise<NflPlayerRecord[]>;

  constructor(private readonly apiKey: string, private readonly season = currentNflSeason()) {}

  private rawTeams() {
    this.teamPromise ??= apiFetch<ApiTeam[]>(`/teams?league=${NFL_LEAGUE_ID}&season=${this.season}`, this.apiKey);
    return this.teamPromise;
  }

  private rawGames(season: number) {
    const existing = this.gamePromises.get(season);
    if (existing) return existing;
    const request = apiFetch<ApiGame[]>(`/games?league=${NFL_LEAGUE_ID}&season=${season}&timezone=UTC`, this.apiKey);
    this.gamePromises.set(season, request);
    return request;
  }

  async getTeams(): Promise<NflTeam[]> {
    const teams = await this.rawTeams();
    return teams.map((team) => {
      const abbreviation = normalizeTeamCode(team.code, team.name);
      const meta = TEAM_META[abbreviation] ?? { conference: "AFC" as const, division: "East" as const };
      return { abbreviation, city: team.city ?? team.name.replace(/\s+\S+$/, ""), name: team.name, ...meta };
    });
  }

  async getPlayers(): Promise<NflPlayerRecord[]> {
    if (this.playerPromise) return this.playerPromise;
    this.playerPromise = (async () => {
      const teams = await this.rawTeams();
      const rosters: NflPlayerRecord[] = [];
      for (const team of teams) {
        const teamCode = normalizeTeamCode(team.code, team.name);
        const players = await apiFetch<ApiPlayer[]>(`/players?team=${team.id}&season=${this.season}`, this.apiKey);
        for (const player of players) {
          const position = player.position?.toUpperCase();
          if (!position || !VALID_POSITIONS.has(position)) continue;
          rosters.push({
            externalId: String(player.id),
            name: player.name,
            teamAbbreviation: teamCode,
            position: position as NflPlayerRecord["position"],
            status: "ACTIVE"
          });
        }
      }
      return rosters;
    })();
    return this.playerPromise;
  }

  async getGames(season: number, week: number): Promise<NflGameRecord[]> {
    const [games, teams] = await Promise.all([this.rawGames(season), this.rawTeams()]);
    const teamCodes = new Map(teams.map((team) => [team.id, normalizeTeamCode(team.code, team.name)]));
    return games.filter((entry) => weekNumber(entry.game.week) === week).map((entry) => ({
      externalId: String(entry.game.id),
      homeTeam: teamCodes.get(entry.teams.home.id) ?? normalizeTeamCode(null, entry.teams.home.name),
      awayTeam: teamCodes.get(entry.teams.away.id) ?? normalizeTeamCode(null, entry.teams.away.name),
      kickoffTime: kickoffIso(entry.game),
      status: mapApiSportsGameStatus(entry.game.status.short),
      homeScore: entry.scores?.home?.total ?? null,
      awayScore: entry.scores?.away?.total ?? null,
      period: entry.game.status.short ?? null,
      clock: entry.game.status.timer === null || entry.game.status.timer === undefined ? null : String(entry.game.status.timer),
      possession: null,
      updatedAt: null
    }));
  }

  async getWeeks(season: number): Promise<NflWeekRecord[]> {
    const games = await this.rawGames(season);
    const grouped = new Map<number, number[]>();
    for (const entry of games) {
      const week = weekNumber(entry.game.week);
      const timestamp = entry.game.date.timestamp;
      if (!week || !timestamp) continue;
      const values = grouped.get(week) ?? [];
      values.push(timestamp * 1000);
      grouped.set(week, values);
    }
    return Array.from(grouped.entries()).map(([week, timestamps]) => ({
      season,
      week,
      startsAt: new Date(Math.min(...timestamps)).toISOString(),
      endsAt: new Date(Math.max(...timestamps) + 24 * 60 * 60 * 1000).toISOString()
    })).sort((a, b) => a.week - b.week);
  }

  async getSlate(season: number, week: number): Promise<NflSlateRecord> {
    const [games, players] = await Promise.all([this.getGames(season, week), this.getPlayers()]);
    const gameByTeam = new Map<string, string>();
    for (const game of games) {
      gameByTeam.set(game.homeTeam, game.externalId);
      gameByTeam.set(game.awayTeam, game.externalId);
    }
    return {
      season,
      week,
      players: players.flatMap((player) => {
        const gameExternalId = gameByTeam.get(player.teamAbbreviation);
        return gameExternalId ? [{ playerExternalId: player.externalId, gameExternalId, projection: player.projection ?? 15 }] : [];
      })
    };
  }

  async getPlayerGameStats(gameExternalId: string): Promise<NflPlayerGameStats[]> {
    const [raw, teams] = await Promise.all([
      apiFetch<ApiPlayerStatsTeam[]>(`/games/statistics/players?id=${encodeURIComponent(gameExternalId)}`, this.apiKey),
      this.rawTeams()
    ]);
    const teamCodes = new Map(teams.map((team) => [team.id, normalizeTeamCode(team.code, team.name)]));
    return normalizeApiSportsPlayerStats(gameExternalId, raw, teamCodes);
  }
}
