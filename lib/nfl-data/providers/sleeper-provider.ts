import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type {
  NflTeam,
  NflPlayerRecord,
  NflGameRecord,
  NflWeekRecord,
  NflSlateRecord,
  NflPlayerStatus
} from "@/lib/nfl-data/types";

const BASE = "https://api.sleeper.app/v1";
const FETCH_TIMEOUT_MS = 15_000;

async function sleeperFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { "User-Agent": "FantasyX/1.0" }
    });
    if (!res.ok) {
      throw new Error(`Sleeper API error ${res.status}: ${path}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string | null;
  status?: string | null;
  injury_status?: string | null;
  active?: boolean;
  fantasy_positions?: string[];
}

interface SleeperNflState {
  week: number;
  season: number;
  season_type: string;
  display_week: number;
  leg: number;
}

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

function mapPlayerStatus(sleeperStatus?: string | null, injuryStatus?: string | null): NflPlayerStatus {
  const combined = (sleeperStatus ?? "Active").toLowerCase();
  if (injuryStatus) {
    if (injuryStatus === "Out")        return "OUT";
    if (injuryStatus === "Doubtful")   return "DOUBTFUL";
    if (injuryStatus === "Questionable") return "QUESTIONABLE";
  }
  if (combined === "inactive" || combined === "cut" || combined === "suspended") return "OUT";
  return "ACTIVE";
}

// Static NFL teams (Sleeper doesn't expose a teams endpoint)
const NFL_TEAMS: NflTeam[] = [
  { abbreviation: "KC",  city: "Kansas City",   name: "Chiefs",     conference: "AFC", division: "West"  },
  { abbreviation: "LAC", city: "Los Angeles",   name: "Chargers",   conference: "AFC", division: "West"  },
  { abbreviation: "LV",  city: "Las Vegas",     name: "Raiders",    conference: "AFC", division: "West"  },
  { abbreviation: "DEN", city: "Denver",        name: "Broncos",    conference: "AFC", division: "West"  },
  { abbreviation: "BUF", city: "Buffalo",       name: "Bills",      conference: "AFC", division: "East"  },
  { abbreviation: "MIA", city: "Miami",         name: "Dolphins",   conference: "AFC", division: "East"  },
  { abbreviation: "NE",  city: "New England",   name: "Patriots",   conference: "AFC", division: "East"  },
  { abbreviation: "NYJ", city: "New York",      name: "Jets",       conference: "AFC", division: "East"  },
  { abbreviation: "BAL", city: "Baltimore",     name: "Ravens",     conference: "AFC", division: "North" },
  { abbreviation: "CLE", city: "Cleveland",     name: "Browns",     conference: "AFC", division: "North" },
  { abbreviation: "CIN", city: "Cincinnati",    name: "Bengals",    conference: "AFC", division: "North" },
  { abbreviation: "PIT", city: "Pittsburgh",    name: "Steelers",   conference: "AFC", division: "North" },
  { abbreviation: "HOU", city: "Houston",       name: "Texans",     conference: "AFC", division: "South" },
  { abbreviation: "IND", city: "Indianapolis",  name: "Colts",      conference: "AFC", division: "South" },
  { abbreviation: "JAX", city: "Jacksonville",  name: "Jaguars",    conference: "AFC", division: "South" },
  { abbreviation: "TEN", city: "Tennessee",     name: "Titans",     conference: "AFC", division: "South" },
  { abbreviation: "PHI", city: "Philadelphia",  name: "Eagles",     conference: "NFC", division: "East"  },
  { abbreviation: "DAL", city: "Dallas",        name: "Cowboys",    conference: "NFC", division: "East"  },
  { abbreviation: "NYG", city: "New York",      name: "Giants",     conference: "NFC", division: "East"  },
  { abbreviation: "WAS", city: "Washington",    name: "Commanders", conference: "NFC", division: "East"  },
  { abbreviation: "ATL", city: "Atlanta",       name: "Falcons",    conference: "NFC", division: "South" },
  { abbreviation: "CAR", city: "Carolina",      name: "Panthers",   conference: "NFC", division: "South" },
  { abbreviation: "NO",  city: "New Orleans",   name: "Saints",     conference: "NFC", division: "South" },
  { abbreviation: "TB",  city: "Tampa Bay",     name: "Buccaneers", conference: "NFC", division: "South" },
  { abbreviation: "CHI", city: "Chicago",       name: "Bears",      conference: "NFC", division: "North" },
  { abbreviation: "DET", city: "Detroit",       name: "Lions",      conference: "NFC", division: "North" },
  { abbreviation: "GB",  city: "Green Bay",     name: "Packers",    conference: "NFC", division: "North" },
  { abbreviation: "MIN", city: "Minnesota",     name: "Vikings",    conference: "NFC", division: "North" },
  { abbreviation: "ARI", city: "Arizona",       name: "Cardinals",  conference: "NFC", division: "West"  },
  { abbreviation: "LAR", city: "Los Angeles",   name: "Rams",       conference: "NFC", division: "West"  },
  { abbreviation: "SEA", city: "Seattle",       name: "Seahawks",   conference: "NFC", division: "West"  },
  { abbreviation: "SF",  city: "San Francisco", name: "49ers",      conference: "NFC", division: "West"  },
];

export class SleeperNflDataProvider implements INflDataProvider {
  readonly name = "Sleeper";

  async getTeams(): Promise<NflTeam[]> {
    // Sleeper doesn't expose a teams API; use the static list
    return NFL_TEAMS;
  }

  async getPlayers(): Promise<NflPlayerRecord[]> {
    const raw = await sleeperFetch<Record<string, SleeperPlayer>>("/players/nfl");
    const records: NflPlayerRecord[] = [];

    for (const player of Object.values(raw)) {
      if (!player.active) continue;
      const pos = player.position ?? "";
      if (!VALID_POSITIONS.has(pos)) continue;
      const team = player.team ?? "FA";

      records.push({
        externalId: player.player_id,
        name: player.full_name ?? `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim(),
        teamAbbreviation: team,
        position: pos as "QB" | "RB" | "WR" | "TE",
        status: mapPlayerStatus(player.status, player.injury_status)
      });
    }

    return records;
  }

  async getGames(_season: number, _week: number): Promise<NflGameRecord[]> {
    // Sleeper doesn't expose a schedule endpoint with kickoff times.
    // Kickoff times must be managed manually or from another source.
    // Return empty array — games/kickoffs are managed through the week management UI.
    return [];
  }

  async getWeeks(season: number): Promise<NflWeekRecord[]> {
    const state = await sleeperFetch<SleeperNflState>("/state/nfl");

    // Build a reasonable date range for the current week
    const seasonYear = state.season ?? season;
    const week = state.week ?? 1;

    // Approximate: regular season starts first Thursday of September
    // Use a generic Mon-Mon window for the sync week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return [{
      season: seasonYear,
      week,
      startsAt: weekStart.toISOString(),
      endsAt: weekEnd.toISOString()
    }];
  }

  async getSlate(season: number, week: number): Promise<NflSlateRecord> {
    // Sleeper doesn't expose per-week slate with projections in a simple endpoint.
    // Return minimal slate — player syncing handles the player upserts.
    return { season, week, players: [] };
  }
}
