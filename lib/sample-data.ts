import type { Account, LeaderboardRow, Market, Player } from "@/lib/types";

export const currentWeek = 1;

export const mockAccount: Account = {
  id: "acct_demo",
  name: "Demo Coach",
  balance: 1000,
  startingBalance: 1000
};

export const players: Player[] = [
  { id: "p_josh_allen", name: "Josh Allen", team: "BUF", opponent: "NYJ", position: "QB", kickoff: "2026-09-13T13:00:00-04:00", projection: 24.2 },
  { id: "p_mahomes", name: "Patrick Mahomes", team: "KC", opponent: "LAC", position: "QB", kickoff: "2026-09-10T20:20:00-04:00", projection: 22.8 },
  { id: "p_lamar", name: "Lamar Jackson", team: "BAL", opponent: "CLE", position: "QB", kickoff: "2026-09-13T13:00:00-04:00", projection: 23.5 },
  { id: "p_saquon", name: "Saquon Barkley", team: "PHI", opponent: "DAL", position: "RB", kickoff: "2026-09-13T16:25:00-04:00", projection: 18.9 },
  { id: "p_bijan", name: "Bijan Robinson", team: "ATL", opponent: "CAR", position: "RB", kickoff: "2026-09-13T13:00:00-04:00", projection: 18.6 },
  { id: "p_cmc", name: "Christian McCaffrey", team: "SF", opponent: "SEA", position: "RB", kickoff: "2026-09-13T16:25:00-04:00", projection: 19.4 },
  { id: "p_jefferson", name: "Justin Jefferson", team: "MIN", opponent: "CHI", position: "WR", kickoff: "2026-09-13T13:00:00-04:00", projection: 17.8 },
  { id: "p_chase", name: "Ja'Marr Chase", team: "CIN", opponent: "PIT", position: "WR", kickoff: "2026-09-13T13:00:00-04:00", projection: 18.2 },
  { id: "p_lamb", name: "CeeDee Lamb", team: "DAL", opponent: "PHI", position: "WR", kickoff: "2026-09-13T16:25:00-04:00", projection: 17.4 },
  { id: "p_amon_ra", name: "Amon-Ra St. Brown", team: "DET", opponent: "GB", position: "WR", kickoff: "2026-09-14T20:15:00-04:00", projection: 16.9 },
  { id: "p_kelce", name: "Travis Kelce", team: "KC", opponent: "LAC", position: "TE", kickoff: "2026-09-10T20:20:00-04:00", projection: 12.5 },
  { id: "p_laporta", name: "Sam LaPorta", team: "DET", opponent: "GB", position: "TE", kickoff: "2026-09-14T20:15:00-04:00", projection: 11.9 },
  { id: "p_mcbride", name: "Trey McBride", team: "ARI", opponent: "LV", position: "TE", kickoff: "2026-09-13T16:05:00-04:00", projection: 12.2 }
];

const thresholds = ["TOP_3", "TOP_5", "TOP_10"] as const;

export const markets: Market[] = players.flatMap((player) =>
  thresholds.map((threshold, index) => {
    const base = threshold === "TOP_3" ? 0.22 : threshold === "TOP_5" ? 0.36 : 0.55;
    const projectionBoost = Math.min(0.15, Math.max(-0.08, (player.projection - 15) / 100));
    const yesPrice = Math.min(0.82, Math.max(0.08, base + projectionBoost - index * 0.01));
    const poolSize = 500;
    return {
      id: `m_${player.id}_${threshold.toLowerCase()}`,
      playerId: player.id,
      week: currentWeek,
      position: player.position,
      threshold,
      yesPool: poolSize * (1 - yesPrice),
      noPool: poolSize * yesPrice,
      liquidity: poolSize,
      status: "OPEN",
      result: null
    };
  })
);

export const sampleLeaderboard: LeaderboardRow[] = [
  { id: "u_1", name: "GridironQuant", pnl: 143.2, balance: 1143.2 },
  { id: "u_2", name: "WaiverWired", pnl: 88.5, balance: 1088.5 },
  { id: "u_3", name: "HalfPprHero", pnl: 42.75, balance: 1042.75 },
  { id: "u_4", name: "RedZoneRiley", pnl: -31.1, balance: 968.9 }
];
