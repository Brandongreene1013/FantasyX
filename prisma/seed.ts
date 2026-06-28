import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const season = 2026;
const weekId = "nfl_2026_w1";

const users = [
  { id: "user_demo", name: "Demo Coach", mockBalance: 1000, startingBalance: 1000, isAdmin: true },
  { id: "user_gridiron_quant", name: "GridironQuant", mockBalance: 1143.2, startingBalance: 1000 },
  { id: "user_waiver_wired", name: "WaiverWired", mockBalance: 1088.5, startingBalance: 1000 },
  { id: "user_half_ppr_hero", name: "HalfPprHero", mockBalance: 1042.75, startingBalance: 1000 }
];

const games = [
  { id: "game_kc_lac", homeTeam: "LAC", awayTeam: "KC", kickoffTime: "2026-09-10T20:20:00-04:00" },
  { id: "game_buf_nyj", homeTeam: "BUF", awayTeam: "NYJ", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_bal_cle", homeTeam: "BAL", awayTeam: "CLE", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_phi_dal", homeTeam: "PHI", awayTeam: "DAL", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { id: "game_atl_car", homeTeam: "ATL", awayTeam: "CAR", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_sf_sea", homeTeam: "SF", awayTeam: "SEA", kickoffTime: "2026-09-13T16:25:00-04:00" },
  { id: "game_cin_pit", homeTeam: "CIN", awayTeam: "PIT", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_min_chi", homeTeam: "MIN", awayTeam: "CHI", kickoffTime: "2026-09-13T13:00:00-04:00" },
  { id: "game_det_gb", homeTeam: "DET", awayTeam: "GB", kickoffTime: "2026-09-14T20:15:00-04:00" },
  { id: "game_ari_lv", homeTeam: "ARI", awayTeam: "LV", kickoffTime: "2026-09-13T16:05:00-04:00" }
] as const;

const players = [
  { id: "p_josh_allen", name: "Josh Allen", team: "BUF", position: "QB", gameId: "game_buf_nyj", projection: 24.2 },
  { id: "p_patrick_mahomes", name: "Patrick Mahomes", team: "KC", position: "QB", gameId: "game_kc_lac", projection: 22.8 },
  { id: "p_lamar_jackson", name: "Lamar Jackson", team: "BAL", position: "QB", gameId: "game_bal_cle", projection: 23.5 },
  { id: "p_saquon_barkley", name: "Saquon Barkley", team: "PHI", position: "RB", gameId: "game_phi_dal", projection: 18.9 },
  { id: "p_bijan_robinson", name: "Bijan Robinson", team: "ATL", position: "RB", gameId: "game_atl_car", projection: 18.6 },
  { id: "p_christian_mccaffrey", name: "Christian McCaffrey", team: "SF", position: "RB", gameId: "game_sf_sea", projection: 19.4 },
  { id: "p_jamarr_chase", name: "Ja'Marr Chase", team: "CIN", position: "WR", gameId: "game_cin_pit", projection: 18.2 },
  { id: "p_justin_jefferson", name: "Justin Jefferson", team: "MIN", position: "WR", gameId: "game_min_chi", projection: 17.8 },
  { id: "p_cee_dee_lamb", name: "CeeDee Lamb", team: "DAL", position: "WR", gameId: "game_phi_dal", projection: 17.4 },
  { id: "p_amon_ra_st_brown", name: "Amon-Ra St. Brown", team: "DET", position: "WR", gameId: "game_det_gb", projection: 16.9 },
  { id: "p_travis_kelce", name: "Travis Kelce", team: "KC", position: "TE", gameId: "game_kc_lac", projection: 12.5 },
  { id: "p_sam_laporta", name: "Sam LaPorta", team: "DET", position: "TE", gameId: "game_det_gb", projection: 11.9 },
  { id: "p_trey_mcbride", name: "Trey McBride", team: "ARI", position: "TE", gameId: "game_ari_lv", projection: 12.2 }
] as const;

const thresholds = ["TOP_3", "TOP_5", "TOP_10"] as const;

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "account_ledger_entries", "admin_audit_logs", "market_events" CASCADE');
  await prisma.settlement.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.market.deleteMany();
  await prisma.player.deleteMany();
  await prisma.game.deleteMany();
  await prisma.nflWeek.deleteMany();
  await prisma.user.deleteMany();

  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season,
      week: 1,
      startsAt: new Date("2026-09-08T08:00:00-04:00"),
      endsAt: new Date("2026-09-15T23:59:59-04:00"),
      status: "OPEN"
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: users });

    await tx.accountLedgerEntry.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: "SEED_GRANT",
        amount: user.mockBalance,
        balanceAfter: user.mockBalance,
        reason: "Initial demo mock-credit grant",
        idempotencyKey: `seed_grant:${user.id}:${weekId}`,
        metadata: { weekId, source: "seed" }
      }))
    });
  });

  await prisma.game.createMany({
    data: games.map((game) => ({
      id: game.id,
      weekId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      kickoffTime: new Date(game.kickoffTime)
    }))
  });

  await prisma.player.createMany({
    data: players.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position
    }))
  });

  for (const player of players) {
    const game = games.find((item) => item.id === player.gameId);
    if (!game) {
      throw new Error(`Missing game for ${player.name}`);
    }

    for (const threshold of thresholds) {
      const yesPrice = getInitialYesPrice(player.projection, threshold);
      const noPrice = 1 - yesPrice;
      const totalPool = 500;

      await prisma.market.create({
        data: {
          id: `m_${player.id}_${threshold.toLowerCase()}`,
          playerId: player.id,
          weekId,
          gameId: player.gameId,
          position: player.position,
          thresholdType: threshold,
          yesPrice,
          noPrice,
          openingPrice: yesPrice,
          yesPool: totalPool * noPrice,
          noPool: totalPool * yesPrice,
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
          liquidity: totalPool,
          volume: 0,
          openInterest: 0,
          note: "Market opened with seeded liquidity"
        }
      });
    }
  }

  await prisma.leaderboardEntry.createMany({
    data: [
      { userId: "user_gridiron_quant", weekId, pnl: 143.2, rank: 1 },
      { userId: "user_waiver_wired", weekId, pnl: 88.5, rank: 2 },
      { userId: "user_half_ppr_hero", weekId, pnl: 42.75, rank: 3 },
      { userId: "user_demo", weekId, pnl: 0, rank: 4 }
    ]
  });
}

function getInitialYesPrice(projection: number, threshold: (typeof thresholds)[number]) {
  const base = threshold === "TOP_3" ? 0.22 : threshold === "TOP_5" ? 0.36 : 0.55;
  const projectionBoost = Math.min(0.15, Math.max(-0.08, (projection - 15) / 100));
  return roundPrice(Math.min(0.82, Math.max(0.08, base + projectionBoost)));
}

function roundPrice(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
