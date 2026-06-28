import type { INflDataProvider } from "./provider";
import type { NflTeam, NflPlayerRecord, NflGameRecord, NflWeekRecord, NflSlateRecord } from "./types";

const DEMO_SEASON = 2026;
const DEMO_WEEK = 1;

const DEMO_TEAMS: NflTeam[] = [
  { abbreviation: "KC",  city: "Kansas City",   name: "Chiefs",     conference: "AFC", division: "West"  },
  { abbreviation: "LAC", city: "Los Angeles",   name: "Chargers",   conference: "AFC", division: "West"  },
  { abbreviation: "BUF", city: "Buffalo",       name: "Bills",      conference: "AFC", division: "East"  },
  { abbreviation: "NYJ", city: "New York",      name: "Jets",       conference: "AFC", division: "East"  },
  { abbreviation: "BAL", city: "Baltimore",     name: "Ravens",     conference: "AFC", division: "North" },
  { abbreviation: "CLE", city: "Cleveland",     name: "Browns",     conference: "AFC", division: "North" },
  { abbreviation: "CIN", city: "Cincinnati",    name: "Bengals",    conference: "AFC", division: "North" },
  { abbreviation: "PIT", city: "Pittsburgh",    name: "Steelers",   conference: "AFC", division: "North" },
  { abbreviation: "PHI", city: "Philadelphia",  name: "Eagles",     conference: "NFC", division: "East"  },
  { abbreviation: "DAL", city: "Dallas",        name: "Cowboys",    conference: "NFC", division: "East"  },
  { abbreviation: "ATL", city: "Atlanta",       name: "Falcons",    conference: "NFC", division: "South" },
  { abbreviation: "CAR", city: "Carolina",      name: "Panthers",   conference: "NFC", division: "South" },
  { abbreviation: "SF",  city: "San Francisco", name: "49ers",      conference: "NFC", division: "West"  },
  { abbreviation: "SEA", city: "Seattle",       name: "Seahawks",   conference: "NFC", division: "West"  },
  { abbreviation: "MIN", city: "Minnesota",     name: "Vikings",    conference: "NFC", division: "North" },
  { abbreviation: "CHI", city: "Chicago",       name: "Bears",      conference: "NFC", division: "North" },
  { abbreviation: "DET", city: "Detroit",       name: "Lions",      conference: "NFC", division: "North" },
  { abbreviation: "GB",  city: "Green Bay",     name: "Packers",    conference: "NFC", division: "North" },
  { abbreviation: "ARI", city: "Arizona",       name: "Cardinals",  conference: "NFC", division: "West"  },
  { abbreviation: "LV",  city: "Las Vegas",     name: "Raiders",    conference: "AFC", division: "West"  },
];

const DEMO_GAMES: NflGameRecord[] = [
  { externalId: "demo_game_kc_lac",  homeTeam: "LAC", awayTeam: "KC",  kickoffTime: "2026-09-10T20:20:00-04:00" },
  { externalId: "demo_game_buf_nyj", homeTeam: "BUF", awayTeam: "NYJ", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { externalId: "demo_game_bal_cle", homeTeam: "BAL", awayTeam: "CLE", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { externalId: "demo_game_phi_dal", homeTeam: "PHI", awayTeam: "DAL", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { externalId: "demo_game_atl_car", homeTeam: "ATL", awayTeam: "CAR", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { externalId: "demo_game_sf_sea",  homeTeam: "SF",  awayTeam: "SEA", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { externalId: "demo_game_cin_pit", homeTeam: "CIN", awayTeam: "PIT", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { externalId: "demo_game_min_chi", homeTeam: "MIN", awayTeam: "CHI", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { externalId: "demo_game_det_gb",  homeTeam: "DET", awayTeam: "GB",  kickoffTime: "2026-09-14T20:15:00-04:00" },
  { externalId: "demo_game_ari_lv",  homeTeam: "ARI", awayTeam: "LV",  kickoffTime: "2026-09-13T16:05:00-04:00" },
];

const DEMO_PLAYERS: NflPlayerRecord[] = [
  { externalId: "demo_josh_allen",          name: "Josh Allen",          teamAbbreviation: "BUF", position: "QB", status: "ACTIVE", projection: 24.2 },
  { externalId: "demo_patrick_mahomes",     name: "Patrick Mahomes",     teamAbbreviation: "KC",  position: "QB", status: "ACTIVE", projection: 22.8 },
  { externalId: "demo_lamar_jackson",       name: "Lamar Jackson",       teamAbbreviation: "BAL", position: "QB", status: "ACTIVE", projection: 23.5 },
  { externalId: "demo_saquon_barkley",      name: "Saquon Barkley",      teamAbbreviation: "PHI", position: "RB", status: "ACTIVE", projection: 18.9 },
  { externalId: "demo_bijan_robinson",      name: "Bijan Robinson",      teamAbbreviation: "ATL", position: "RB", status: "ACTIVE", projection: 18.6 },
  { externalId: "demo_christian_mccaffrey", name: "Christian McCaffrey", teamAbbreviation: "SF",  position: "RB", status: "ACTIVE", projection: 19.4 },
  { externalId: "demo_jamarr_chase",        name: "Ja'Marr Chase",       teamAbbreviation: "CIN", position: "WR", status: "ACTIVE", projection: 18.2 },
  { externalId: "demo_justin_jefferson",    name: "Justin Jefferson",    teamAbbreviation: "MIN", position: "WR", status: "ACTIVE", projection: 17.8 },
  { externalId: "demo_cee_dee_lamb",        name: "CeeDee Lamb",         teamAbbreviation: "DAL", position: "WR", status: "ACTIVE", projection: 17.4 },
  { externalId: "demo_amon_ra_st_brown",    name: "Amon-Ra St. Brown",   teamAbbreviation: "DET", position: "WR", status: "ACTIVE", projection: 16.9 },
  { externalId: "demo_travis_kelce",        name: "Travis Kelce",        teamAbbreviation: "KC",  position: "TE", status: "ACTIVE", projection: 12.5 },
  { externalId: "demo_sam_laporta",         name: "Sam LaPorta",         teamAbbreviation: "DET", position: "TE", status: "ACTIVE", projection: 11.9 },
  { externalId: "demo_trey_mcbride",        name: "Trey McBride",        teamAbbreviation: "ARI", position: "TE", status: "ACTIVE", projection: 12.2 },
];

const DEMO_SLATE: NflSlateRecord = {
  season: DEMO_SEASON,
  week: DEMO_WEEK,
  players: [
    { playerExternalId: "demo_josh_allen",          gameExternalId: "demo_game_buf_nyj", projection: 24.2 },
    { playerExternalId: "demo_patrick_mahomes",     gameExternalId: "demo_game_kc_lac",  projection: 22.8 },
    { playerExternalId: "demo_lamar_jackson",       gameExternalId: "demo_game_bal_cle", projection: 23.5 },
    { playerExternalId: "demo_saquon_barkley",      gameExternalId: "demo_game_phi_dal", projection: 18.9 },
    { playerExternalId: "demo_bijan_robinson",      gameExternalId: "demo_game_atl_car", projection: 18.6 },
    { playerExternalId: "demo_christian_mccaffrey", gameExternalId: "demo_game_sf_sea",  projection: 19.4 },
    { playerExternalId: "demo_jamarr_chase",        gameExternalId: "demo_game_cin_pit", projection: 18.2 },
    { playerExternalId: "demo_justin_jefferson",    gameExternalId: "demo_game_min_chi", projection: 17.8 },
    { playerExternalId: "demo_cee_dee_lamb",        gameExternalId: "demo_game_phi_dal", projection: 17.4 },
    { playerExternalId: "demo_amon_ra_st_brown",    gameExternalId: "demo_game_det_gb",  projection: 16.9 },
    { playerExternalId: "demo_travis_kelce",        gameExternalId: "demo_game_kc_lac",  projection: 12.5 },
    { playerExternalId: "demo_sam_laporta",         gameExternalId: "demo_game_det_gb",  projection: 11.9 },
    { playerExternalId: "demo_trey_mcbride",        gameExternalId: "demo_game_ari_lv",  projection: 12.2 },
  ],
};

export class DemoNflDataProvider implements INflDataProvider {
  readonly name: string = "demo";

  async getTeams(): Promise<NflTeam[]> {
    return DEMO_TEAMS;
  }

  async getPlayers(): Promise<NflPlayerRecord[]> {
    return DEMO_PLAYERS;
  }

  async getGames(season: number, week: number): Promise<NflGameRecord[]> {
    if (season === DEMO_SEASON && week === DEMO_WEEK) return DEMO_GAMES;
    return [];
  }

  async getWeeks(season: number): Promise<NflWeekRecord[]> {
    if (season !== DEMO_SEASON) return [];
    return [
      {
        season: DEMO_SEASON,
        week: DEMO_WEEK,
        startsAt: "2026-09-08T08:00:00-04:00",
        endsAt: "2026-09-15T23:59:59-04:00",
      },
    ];
  }

  async getSlate(season: number, week: number): Promise<NflSlateRecord> {
    if (season === DEMO_SEASON && week === DEMO_WEEK) return DEMO_SLATE;
    return { season, week, players: [] };
  }
}
