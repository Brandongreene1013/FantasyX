import { PrismaClient } from "@prisma/client";
import { validateIdentityEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { executeDbBuy } from "@/lib/trade.service";
import { settleDbMarket } from "@/lib/settlement.service";
import { calcOpeningYesPrice, calcInitialPools } from "@/lib/opening-price-model";

const prisma = new PrismaClient();
validateIdentityEnv();

const season = 2026;
const weekId = "nfl_2026_w1";

const adminEmail     = process.env.ADMIN_EMAIL      ?? "admin@fantasyx.test";
const adminPassword  = process.env.ADMIN_PASSWORD   ?? "ChangeMeAdminPassword123!";
const adminFirstName = process.env.ADMIN_FIRST_NAME ?? "FantasyX";
const adminLastName  = process.env.ADMIN_LAST_NAME  ?? "Admin";

const userSeeds = [
  { id: "user_admin",          firstName: adminFirstName, lastName: adminLastName,  displayName: `${adminFirstName} ${adminLastName}`.trim(), email: adminEmail.toLowerCase(),               mockBalance: 10000, startingBalance: 10000, role: "ADMIN"  as const, isAdmin: true,  password: adminPassword },
  { id: "user_gridiron_quant", firstName: "Gridiron",    lastName: "Quant",        displayName: "GridironQuant",  email: "gridiron.quant@fantasyx.test",  mockBalance: 8500,  startingBalance: 8500,  role: "TRADER" as const, isAdmin: false, password: "DevTraderPassword123!" },
  { id: "user_waiver_wired",   firstName: "Waiver",      lastName: "Wired",        displayName: "WaiverWired",    email: "waiver.wired@fantasyx.test",    mockBalance: 7200,  startingBalance: 7200,  role: "TRADER" as const, isAdmin: false, password: "DevTraderPassword123!" },
  { id: "user_half_ppr_hero",  firstName: "Half",        lastName: "PPR Hero",     displayName: "HalfPprHero",    email: "half.ppr.hero@fantasyx.test",   mockBalance: 9100,  startingBalance: 9100,  role: "TRADER" as const, isAdmin: false, password: "DevTraderPassword123!" },
  { id: "user_sharp_money",    firstName: "Sharp",       lastName: "Money",        displayName: "SharpMoney",     email: "sharp.money@fantasyx.test",     mockBalance: 6800,  startingBalance: 6800,  role: "TRADER" as const, isAdmin: false, password: "DevTraderPassword123!" },
  { id: "user_tape_watcher",   firstName: "Tape",        lastName: "Watcher",      displayName: "TapeWatcher",    email: "tape.watcher@fantasyx.test",    mockBalance: 7600,  startingBalance: 7600,  role: "TRADER" as const, isAdmin: false, password: "DevTraderPassword123!" },
];

const games = [
  { id: "game_kc_lac",  homeTeam: "LAC", awayTeam: "KC",  kickoffTime: "2026-09-10T20:20:00-04:00" },
  { id: "game_buf_nyj", homeTeam: "BUF", awayTeam: "NYJ", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_bal_cle", homeTeam: "BAL", awayTeam: "CLE", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_phi_dal", homeTeam: "PHI", awayTeam: "DAL", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { id: "game_atl_car", homeTeam: "ATL", awayTeam: "CAR", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_sf_sea",  homeTeam: "SF",  awayTeam: "SEA", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { id: "game_cin_pit", homeTeam: "CIN", awayTeam: "PIT", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_min_chi", homeTeam: "MIN", awayTeam: "CHI", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_det_gb",  homeTeam: "DET", awayTeam: "GB",  kickoffTime: "2026-09-14T20:15:00-04:00" },
  { id: "game_ari_lv",  homeTeam: "ARI", awayTeam: "LV",  kickoffTime: "2026-09-13T16:05:00-04:00" },
  { id: "game_mia_ne",  homeTeam: "MIA", awayTeam: "NE",  kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_was_nyg", homeTeam: "WAS", awayTeam: "NYG", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_no_tb",   homeTeam: "NO",  awayTeam: "TB",  kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_hou_jax", homeTeam: "HOU", awayTeam: "JAX", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_ind_ten", homeTeam: "IND", awayTeam: "TEN", kickoffTime: "2026-09-13T16:05:00-04:00" },
  { id: "game_lar_den", homeTeam: "LAR", awayTeam: "DEN", kickoffTime: "2026-09-13T16:25:00-04:00" },
] as const;

type GameId = typeof games[number]["id"];

const players: Array<{
  id: string; name: string; team: string; position: "QB"|"RB"|"WR"|"TE";
  gameId: GameId; projection: number;
}> = [
  // QBs
  { id: "p_josh_allen",         name: "Josh Allen",          team: "BUF", position: "QB", gameId: "game_buf_nyj", projection: 27.4 },
  { id: "p_lamar_jackson",      name: "Lamar Jackson",       team: "BAL", position: "QB", gameId: "game_bal_cle", projection: 26.1 },
  { id: "p_jalen_hurts",        name: "Jalen Hurts",         team: "PHI", position: "QB", gameId: "game_phi_dal", projection: 24.8 },
  { id: "p_patrick_mahomes",    name: "Patrick Mahomes",     team: "KC",  position: "QB", gameId: "game_kc_lac",  projection: 24.2 },
  { id: "p_joe_burrow",         name: "Joe Burrow",          team: "CIN", position: "QB", gameId: "game_cin_pit", projection: 23.5 },
  { id: "p_cj_stroud",          name: "C.J. Stroud",         team: "HOU", position: "QB", gameId: "game_hou_jax", projection: 22.6 },
  { id: "p_anthony_richardson", name: "Anthony Richardson",  team: "IND", position: "QB", gameId: "game_ind_ten", projection: 21.8 },
  { id: "p_dak_prescott",       name: "Dak Prescott",        team: "DAL", position: "QB", gameId: "game_phi_dal", projection: 21.4 },
  { id: "p_justin_herbert",     name: "Justin Herbert",      team: "LAC", position: "QB", gameId: "game_kc_lac",  projection: 21.0 },
  { id: "p_jordan_love",        name: "Jordan Love",         team: "GB",  position: "QB", gameId: "game_det_gb",  projection: 20.6 },
  { id: "p_brock_purdy",        name: "Brock Purdy",         team: "SF",  position: "QB", gameId: "game_sf_sea",  projection: 20.2 },
  { id: "p_kyler_murray",       name: "Kyler Murray",        team: "ARI", position: "QB", gameId: "game_ari_lv",  projection: 19.8 },
  { id: "p_tua_tagovailoa",     name: "Tua Tagovailoa",      team: "MIA", position: "QB", gameId: "game_mia_ne",  projection: 19.4 },
  { id: "p_caleb_williams",     name: "Caleb Williams",      team: "CHI", position: "QB", gameId: "game_min_chi", projection: 19.0 },
  { id: "p_jayden_daniels",     name: "Jayden Daniels",      team: "WAS", position: "QB", gameId: "game_was_nyg", projection: 18.8 },
  { id: "p_trevor_lawrence",    name: "Trevor Lawrence",     team: "JAX", position: "QB", gameId: "game_hou_jax", projection: 18.4 },
  { id: "p_jared_goff",         name: "Jared Goff",          team: "DET", position: "QB", gameId: "game_det_gb",  projection: 18.0 },
  { id: "p_matthew_stafford",   name: "Matthew Stafford",    team: "LAR", position: "QB", gameId: "game_lar_den", projection: 17.6 },
  { id: "p_baker_mayfield",     name: "Baker Mayfield",      team: "TB",  position: "QB", gameId: "game_no_tb",   projection: 17.2 },
  { id: "p_bo_nix",             name: "Bo Nix",              team: "DEN", position: "QB", gameId: "game_lar_den", projection: 16.8 },
  // RBs
  { id: "p_christian_mccaffrey",name: "Christian McCaffrey", team: "SF",  position: "RB", gameId: "game_sf_sea",  projection: 22.4 },
  { id: "p_bijan_robinson",     name: "Bijan Robinson",      team: "ATL", position: "RB", gameId: "game_atl_car", projection: 19.8 },
  { id: "p_breece_hall",        name: "Breece Hall",         team: "NYJ", position: "RB", gameId: "game_buf_nyj", projection: 19.2 },
  { id: "p_jahmyr_gibbs",       name: "Jahmyr Gibbs",        team: "DET", position: "RB", gameId: "game_det_gb",  projection: 18.8 },
  { id: "p_saquon_barkley",     name: "Saquon Barkley",      team: "PHI", position: "RB", gameId: "game_phi_dal", projection: 18.4 },
  { id: "p_jonathan_taylor",    name: "Jonathan Taylor",     team: "IND", position: "RB", gameId: "game_ind_ten", projection: 17.8 },
  { id: "p_derrick_henry",      name: "Derrick Henry",       team: "KC",  position: "RB", gameId: "game_kc_lac",  projection: 17.4 },
  { id: "p_josh_jacobs",        name: "Josh Jacobs",         team: "GB",  position: "RB", gameId: "game_det_gb",  projection: 17.0 },
  { id: "p_kyren_williams",     name: "Kyren Williams",      team: "LAR", position: "RB", gameId: "game_lar_den", projection: 16.8 },
  { id: "p_devon_achane",       name: "De'Von Achane",       team: "MIA", position: "RB", gameId: "game_mia_ne",  projection: 16.6 },
  { id: "p_travis_etienne",     name: "Travis Etienne",      team: "JAX", position: "RB", gameId: "game_hou_jax", projection: 16.2 },
  { id: "p_james_cook",         name: "James Cook",          team: "BUF", position: "RB", gameId: "game_buf_nyj", projection: 16.0 },
  { id: "p_kenneth_walker",     name: "Kenneth Walker",      team: "SEA", position: "RB", gameId: "game_sf_sea",  projection: 15.6 },
  { id: "p_joe_mixon",          name: "Joe Mixon",           team: "HOU", position: "RB", gameId: "game_hou_jax", projection: 15.4 },
  { id: "p_rachaad_white",      name: "Rachaad White",       team: "TB",  position: "RB", gameId: "game_no_tb",   projection: 15.0 },
  { id: "p_isiah_pacheco",      name: "Isiah Pacheco",       team: "KC",  position: "RB", gameId: "game_kc_lac",  projection: 14.8 },
  { id: "p_alvin_kamara",       name: "Alvin Kamara",        team: "NO",  position: "RB", gameId: "game_no_tb",   projection: 14.4 },
  { id: "p_david_montgomery",   name: "David Montgomery",    team: "DET", position: "RB", gameId: "game_det_gb",  projection: 13.8 },
  { id: "p_aaron_jones",        name: "Aaron Jones",         team: "MIN", position: "RB", gameId: "game_min_chi", projection: 13.4 },
  { id: "p_najee_harris",       name: "Najee Harris",        team: "PIT", position: "RB", gameId: "game_cin_pit", projection: 13.0 },
  { id: "p_tony_pollard",       name: "Tony Pollard",        team: "TEN", position: "RB", gameId: "game_ind_ten", projection: 12.6 },
  { id: "p_brian_robinson",     name: "Brian Robinson",      team: "WAS", position: "RB", gameId: "game_was_nyg", projection: 12.4 },
  { id: "p_rhamondre_stevenson",name: "Rhamondre Stevenson", team: "NE",  position: "RB", gameId: "game_mia_ne",  projection: 12.0 },
  { id: "p_zamir_white",        name: "Zamir White",         team: "LV",  position: "RB", gameId: "game_ari_lv",  projection: 11.8 },
  { id: "p_dandre_swift",       name: "D'Andre Swift",       team: "CHI", position: "RB", gameId: "game_min_chi", projection: 11.6 },
  { id: "p_javonte_williams",   name: "Javonte Williams",    team: "DEN", position: "RB", gameId: "game_lar_den", projection: 11.4 },
  { id: "p_chase_brown",        name: "Chase Brown",         team: "CIN", position: "RB", gameId: "game_cin_pit", projection: 11.0 },
  { id: "p_blake_corum",        name: "Blake Corum",         team: "LAR", position: "RB", gameId: "game_lar_den", projection: 10.8 },
  { id: "p_tyjae_spears",       name: "Tyjae Spears",        team: "TEN", position: "RB", gameId: "game_ind_ten", projection: 10.6 },
  { id: "p_jaylen_warren",      name: "Jaylen Warren",       team: "PIT", position: "RB", gameId: "game_cin_pit", projection: 10.2 },
  // WRs
  { id: "p_justin_jefferson",   name: "Justin Jefferson",    team: "MIN", position: "WR", gameId: "game_min_chi", projection: 22.8 },
  { id: "p_jamarr_chase",       name: "Ja'Marr Chase",       team: "CIN", position: "WR", gameId: "game_cin_pit", projection: 21.6 },
  { id: "p_cee_dee_lamb",       name: "CeeDee Lamb",         team: "DAL", position: "WR", gameId: "game_phi_dal", projection: 20.8 },
  { id: "p_amon_ra_st_brown",   name: "Amon-Ra St. Brown",   team: "DET", position: "WR", gameId: "game_det_gb",  projection: 19.6 },
  { id: "p_tyreek_hill",        name: "Tyreek Hill",         team: "MIA", position: "WR", gameId: "game_mia_ne",  projection: 19.2 },
  { id: "p_aj_brown",           name: "A.J. Brown",          team: "PHI", position: "WR", gameId: "game_phi_dal", projection: 18.8 },
  { id: "p_puka_nacua",         name: "Puka Nacua",          team: "LAR", position: "WR", gameId: "game_lar_den", projection: 18.4 },
  { id: "p_garrett_wilson",     name: "Garrett Wilson",      team: "NYJ", position: "WR", gameId: "game_buf_nyj", projection: 18.0 },
  { id: "p_marvin_harrison_jr", name: "Marvin Harrison Jr.", team: "ARI", position: "WR", gameId: "game_ari_lv",  projection: 17.6 },
  { id: "p_drake_london",       name: "Drake London",        team: "ATL", position: "WR", gameId: "game_atl_car", projection: 17.2 },
  { id: "p_chris_olave",        name: "Chris Olave",         team: "NO",  position: "WR", gameId: "game_no_tb",   projection: 16.8 },
  { id: "p_mike_evans",         name: "Mike Evans",          team: "TB",  position: "WR", gameId: "game_no_tb",   projection: 16.4 },
  { id: "p_deebo_samuel",       name: "Deebo Samuel",        team: "SF",  position: "WR", gameId: "game_sf_sea",  projection: 16.0 },
  { id: "p_brandon_aiyuk",      name: "Brandon Aiyuk",       team: "SF",  position: "WR", gameId: "game_sf_sea",  projection: 15.8 },
  { id: "p_nico_collins",       name: "Nico Collins",        team: "HOU", position: "WR", gameId: "game_hou_jax", projection: 15.6 },
  { id: "p_stefon_diggs",       name: "Stefon Diggs",        team: "NE",  position: "WR", gameId: "game_mia_ne",  projection: 15.2 },
  { id: "p_davante_adams",      name: "Davante Adams",       team: "LV",  position: "WR", gameId: "game_ari_lv",  projection: 14.8 },
  { id: "p_dk_metcalf",         name: "DK Metcalf",          team: "SEA", position: "WR", gameId: "game_sf_sea",  projection: 14.6 },
  { id: "p_jaylen_waddle",      name: "Jaylen Waddle",       team: "MIA", position: "WR", gameId: "game_mia_ne",  projection: 14.4 },
  { id: "p_devonta_smith",      name: "DeVonta Smith",       team: "PHI", position: "WR", gameId: "game_phi_dal", projection: 14.0 },
  { id: "p_tee_higgins",        name: "Tee Higgins",         team: "CIN", position: "WR", gameId: "game_cin_pit", projection: 13.8 },
  { id: "p_dj_moore",           name: "DJ Moore",            team: "CHI", position: "WR", gameId: "game_min_chi", projection: 13.6 },
  { id: "p_keenan_allen",       name: "Keenan Allen",        team: "CHI", position: "WR", gameId: "game_min_chi", projection: 13.4 },
  { id: "p_michael_pittman",    name: "Michael Pittman",     team: "IND", position: "WR", gameId: "game_ind_ten", projection: 13.2 },
  { id: "p_cooper_kupp",        name: "Cooper Kupp",         team: "LAR", position: "WR", gameId: "game_lar_den", projection: 13.0 },
  { id: "p_malik_nabers",       name: "Malik Nabers",        team: "NYG", position: "WR", gameId: "game_was_nyg", projection: 12.8 },
  { id: "p_rome_odunze",        name: "Rome Odunze",         team: "CHI", position: "WR", gameId: "game_min_chi", projection: 12.6 },
  { id: "p_tank_dell",          name: "Tank Dell",           team: "HOU", position: "WR", gameId: "game_hou_jax", projection: 12.4 },
  { id: "p_zay_flowers",        name: "Zay Flowers",         team: "BAL", position: "WR", gameId: "game_bal_cle", projection: 12.0 },
  { id: "p_george_pickens",     name: "George Pickens",      team: "PIT", position: "WR", gameId: "game_cin_pit", projection: 11.8 },
  { id: "p_christian_kirk",     name: "Christian Kirk",      team: "JAX", position: "WR", gameId: "game_hou_jax", projection: 11.6 },
  { id: "p_terry_mclaurin",     name: "Terry McLaurin",      team: "WAS", position: "WR", gameId: "game_was_nyg", projection: 11.4 },
  { id: "p_amari_cooper",       name: "Amari Cooper",        team: "CLE", position: "WR", gameId: "game_bal_cle", projection: 11.2 },
  { id: "p_calvin_ridley",      name: "Calvin Ridley",       team: "TEN", position: "WR", gameId: "game_ind_ten", projection: 11.0 },
  { id: "p_courtland_sutton",   name: "Courtland Sutton",    team: "DEN", position: "WR", gameId: "game_lar_den", projection: 10.8 },
  { id: "p_jordan_addison",     name: "Jordan Addison",      team: "MIN", position: "WR", gameId: "game_min_chi", projection: 10.6 },
  { id: "p_chris_godwin",       name: "Chris Godwin",        team: "TB",  position: "WR", gameId: "game_no_tb",   projection: 10.4 },
  { id: "p_rashee_rice",        name: "Rashee Rice",         team: "KC",  position: "WR", gameId: "game_kc_lac",  projection: 10.2 },
  { id: "p_xavier_worthy",      name: "Xavier Worthy",       team: "KC",  position: "WR", gameId: "game_kc_lac",  projection: 10.0 },
  { id: "p_jaxon_smith_njigba", name: "Jaxon Smith-Njigba",  team: "SEA", position: "WR", gameId: "game_sf_sea",  projection: 9.8  },
  // TEs
  { id: "p_travis_kelce",       name: "Travis Kelce",        team: "KC",  position: "TE", gameId: "game_kc_lac",  projection: 15.2 },
  { id: "p_sam_laporta",        name: "Sam LaPorta",         team: "DET", position: "TE", gameId: "game_det_gb",  projection: 13.6 },
  { id: "p_mark_andrews",       name: "Mark Andrews",        team: "BAL", position: "TE", gameId: "game_bal_cle", projection: 13.4 },
  { id: "p_trey_mcbride",       name: "Trey McBride",        team: "ARI", position: "TE", gameId: "game_ari_lv",  projection: 13.2 },
  { id: "p_george_kittle",      name: "George Kittle",       team: "SF",  position: "TE", gameId: "game_sf_sea",  projection: 12.8 },
  { id: "p_dalton_kincaid",     name: "Dalton Kincaid",      team: "BUF", position: "TE", gameId: "game_buf_nyj", projection: 12.0 },
  { id: "p_evan_engram",        name: "Evan Engram",         team: "JAX", position: "TE", gameId: "game_hou_jax", projection: 11.6 },
  { id: "p_kyle_pitts",         name: "Kyle Pitts",          team: "ATL", position: "TE", gameId: "game_atl_car", projection: 11.4 },
  { id: "p_jake_ferguson",      name: "Jake Ferguson",       team: "DAL", position: "TE", gameId: "game_phi_dal", projection: 11.0 },
  { id: "p_brock_bowers",       name: "Brock Bowers",        team: "LV",  position: "TE", gameId: "game_ari_lv",  projection: 10.8 },
  { id: "p_dallas_goedert",     name: "Dallas Goedert",      team: "PHI", position: "TE", gameId: "game_phi_dal", projection: 10.6 },
  { id: "p_david_njoku",        name: "David Njoku",         team: "CLE", position: "TE", gameId: "game_bal_cle", projection: 10.2 },
  { id: "p_cole_kmet",          name: "Cole Kmet",           team: "CHI", position: "TE", gameId: "game_min_chi", projection: 9.8  },
  { id: "p_pat_freiermuth",     name: "Pat Freiermuth",      team: "PIT", position: "TE", gameId: "game_cin_pit", projection: 9.6  },
  { id: "p_tj_hockenson",       name: "T.J. Hockenson",      team: "MIN", position: "TE", gameId: "game_min_chi", projection: 9.4  },
];

const thresholds = ["TOP_3", "TOP_5", "TOP_10"] as const;

const demoTrades = [
  // Elite buys — high conviction
  { userId: "user_gridiron_quant", marketId: "m_p_josh_allen_top_3",          side: "YES", spend: 200 },
  { userId: "user_gridiron_quant", marketId: "m_p_justin_jefferson_top_5",    side: "YES", spend: 180 },
  { userId: "user_gridiron_quant", marketId: "m_p_travis_kelce_top_3",        side: "YES", spend: 150 },
  { userId: "user_gridiron_quant", marketId: "m_p_christian_mccaffrey_top_5", side: "YES", spend: 140 },
  { userId: "user_gridiron_quant", marketId: "m_p_lamar_jackson_top_3",       side: "YES", spend: 120 },
  { userId: "user_gridiron_quant", marketId: "m_p_tyreek_hill_top_10",        side: "YES", spend: 100 },
  { userId: "user_gridiron_quant", marketId: "m_p_bijan_robinson_top_10",     side: "YES", spend: 85 },
  { userId: "user_gridiron_quant", marketId: "m_p_cee_dee_lamb_top_5",        side: "YES", spend: 110 },
  // Fades / NO bets
  { userId: "user_waiver_wired",   marketId: "m_p_bo_nix_top_3",              side: "NO",  spend: 160 },
  { userId: "user_waiver_wired",   marketId: "m_p_najee_harris_top_5",        side: "NO",  spend: 130 },
  { userId: "user_waiver_wired",   marketId: "m_p_zamir_white_top_5",         side: "NO",  spend: 110 },
  { userId: "user_waiver_wired",   marketId: "m_p_christian_mccaffrey_top_5", side: "YES", spend: 95  },
  { userId: "user_waiver_wired",   marketId: "m_p_jamarr_chase_top_5",        side: "YES", spend: 140 },
  { userId: "user_waiver_wired",   marketId: "m_p_amon_ra_st_brown_top_10",   side: "YES", spend: 90  },
  { userId: "user_waiver_wired",   marketId: "m_p_patrick_mahomes_top_3",     side: "NO",  spend: 80  },
  // Contrarian / value plays
  { userId: "user_half_ppr_hero",  marketId: "m_p_jayden_daniels_top_5",      side: "YES", spend: 175 },
  { userId: "user_half_ppr_hero",  marketId: "m_p_puka_nacua_top_10",         side: "YES", spend: 120 },
  { userId: "user_half_ppr_hero",  marketId: "m_p_lamar_jackson_top_3",       side: "YES", spend: 200 },
  { userId: "user_half_ppr_hero",  marketId: "m_p_marvin_harrison_jr_top_5",  side: "YES", spend: 90  },
  { userId: "user_half_ppr_hero",  marketId: "m_p_kyle_pitts_top_5",          side: "YES", spend: 70  },
  { userId: "user_half_ppr_hero",  marketId: "m_p_cj_stroud_top_5",           side: "YES", spend: 110 },
  { userId: "user_half_ppr_hero",  marketId: "m_p_justin_jefferson_top_3",    side: "YES", spend: 150 },
  // SharpMoney edge plays
  { userId: "user_sharp_money",    marketId: "m_p_josh_allen_top_3",          side: "YES", spend: 250 },
  { userId: "user_sharp_money",    marketId: "m_p_breece_hall_top_10",        side: "YES", spend: 130 },
  { userId: "user_sharp_money",    marketId: "m_p_george_kittle_top_3",       side: "YES", spend: 95  },
  { userId: "user_sharp_money",    marketId: "m_p_jahmyr_gibbs_top_5",        side: "YES", spend: 110 },
  { userId: "user_sharp_money",    marketId: "m_p_davante_adams_top_10",      side: "NO",  spend: 80  },
  { userId: "user_sharp_money",    marketId: "m_p_tua_tagovailoa_top_3",      side: "NO",  spend: 160 },
  { userId: "user_sharp_money",    marketId: "m_p_jalen_hurts_top_3",         side: "YES", spend: 200 },
  // TapeWatcher volume plays
  { userId: "user_tape_watcher",   marketId: "m_p_saquon_barkley_top_5",      side: "YES", spend: 120 },
  { userId: "user_tape_watcher",   marketId: "m_p_garrett_wilson_top_10",     side: "YES", spend: 100 },
  { userId: "user_tape_watcher",   marketId: "m_p_travis_etienne_top_10",     side: "YES", spend: 85  },
  { userId: "user_tape_watcher",   marketId: "m_p_george_pickens_top_10",     side: "YES", spend: 75  },
  { userId: "user_tape_watcher",   marketId: "m_p_brock_bowers_top_5",        side: "YES", spend: 90  },
  { userId: "user_tape_watcher",   marketId: "m_p_jonathan_taylor_top_5",     side: "YES", spend: 110 },
  { userId: "user_tape_watcher",   marketId: "m_p_josh_allen_top_5",          side: "YES", spend: 150 },
  { userId: "user_tape_watcher",   marketId: "m_p_dj_moore_top_10",           side: "NO",  spend: 65  },
  // Admin market making
  { userId: "user_admin",          marketId: "m_p_travis_kelce_top_3",        side: "YES", spend: 120 },
  { userId: "user_admin",          marketId: "m_p_jamarr_chase_top_10",       side: "YES", spend: 80  },
  { userId: "user_admin",          marketId: "m_p_josh_allen_top_5",          side: "YES", spend: 65  },
  { userId: "user_admin",          marketId: "m_p_devonta_smith_top_10",      side: "YES", spend: 70  },
] as const;

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "account_ledger_entries", "admin_audit_logs", "market_events" CASCADE');
  await prisma.settlement.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.session.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.market.deleteMany();
  await prisma.player.deleteMany();
  await prisma.game.deleteMany();
  await prisma.nflWeek.deleteMany();
  await prisma.user.deleteMany();

  await prisma.nflWeek.create({
    data: {
      id: weekId, season, week: 1,
      startsAt: new Date("2026-09-08T08:00:00-04:00"),
      endsAt:   new Date("2026-09-15T23:59:59-04:00"),
      status: "OPEN"
    }
  });

  await prisma.$transaction(async (tx) => {
    const users = await Promise.all(userSeeds.map(async (u) => ({
      id: u.id, name: u.displayName, firstName: u.firstName, lastName: u.lastName,
      displayName: u.displayName, email: u.email,
      passwordHash: await hashPassword(u.password),
      role: u.role, isAdmin: u.isAdmin,
      mockBalance: u.mockBalance, startingBalance: u.startingBalance
    })));
    await tx.user.createMany({ data: users });
    await tx.accountLedgerEntry.createMany({
      data: users.map((u) => ({
        userId: u.id, type: "SEED_GRANT", amount: u.mockBalance, balanceAfter: u.mockBalance,
        reason: "Initial mock-credit grant",
        idempotencyKey: `seed_grant:${u.id}:${weekId}`,
        metadata: { weekId, source: "seed" }
      }))
    });
  });

  await prisma.game.createMany({
    data: games.map((g) => ({
      id: g.id, weekId, homeTeam: g.homeTeam, awayTeam: g.awayTeam,
      kickoffTime: new Date(g.kickoffTime)
    }))
  });

  await prisma.player.createMany({
    data: players.map((p) => ({
      id: p.id, name: p.name, team: p.team, position: p.position
    }))
  });

  for (const player of players) {
    const game = games.find((g) => g.id === player.gameId);
    if (!game) throw new Error(`Missing game for ${player.name}`);

    for (const threshold of thresholds) {
      const yesPrice = calcOpeningYesPrice(player.projection, player.position, threshold);
      const { noPrice, yesPool, noPool } = calcInitialPools(yesPrice, 500);

      await prisma.market.create({
        data: {
          id: `m_${player.id}_${threshold.toLowerCase()}`,
          playerId: player.id,
          weekId,
          gameId: game.id,
          position: player.position,
          thresholdType: threshold,
          yesPrice,
          noPrice,
          openingPrice: yesPrice,
          yesPool,
          noPool,
          volume: 0,
          openInterest: 0,
          status: "OPEN",
          result: null,
          kickoffTime: new Date(game.kickoffTime)
        }
      });

      await prisma.marketEvent.create({
        data: {
          marketId: `m_${player.id}_${threshold.toLowerCase()}`,
          type: "ADMIN_NOTE",
          priceAfter: yesPrice,
          liquidity: 500,
          volume: 0,
          openInterest: 0,
          note: "Market opened with model-priced liquidity"
        }
      });
    }
  }

  for (const trade of demoTrades) {
    try {
      await prisma.$transaction((tx) =>
        executeDbBuy(tx, { userId: trade.userId, marketId: trade.marketId, side: trade.side, spend: trade.spend })
      );
    } catch {
      // skip markets that may not exist (e.g. if a player was skipped)
    }
  }

  await prisma.$transaction((tx) =>
    settleDbMarket(tx, {
      marketId: "m_p_josh_allen_top_5",
      result: "YES",
      settledById: "user_admin",
      fantasyPoints: 29.8,
      positionalRank: 1,
      reason: "Demo settlement — Josh Allen QB1 Week 1"
    })
  );

  await prisma.leaderboardEntry.updateMany({
    where: { weekId },
    data: { updatedAt: new Date() }
  });
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
