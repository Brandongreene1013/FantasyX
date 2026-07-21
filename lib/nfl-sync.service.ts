import { prisma } from "@/lib/prisma";
import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type { NflSyncResult } from "@/lib/nfl-data/types";

const THRESHOLDS = ["TOP_3", "TOP_5", "TOP_10"] as const;

export async function syncNflData(
  provider: INflDataProvider,
  season: number,
  week: number
): Promise<NflSyncResult> {
  const result: NflSyncResult = {
    provider: provider.name,
    season,
    week,
    weeks:   { created: 0, updated: 0 },
    teams:   { total: 0 },
    players: { created: 0, updated: 0 },
    games:   { created: 0, updated: 0 },
    markets: { created: 0, skipped: 0 },
  };

  const [teams, weekRecords, gameRecords, playerRecords, slateRecord] = await Promise.all([
    provider.getTeams(),
    provider.getWeeks(season),
    provider.getGames(season, week),
    provider.getPlayers(),
    provider.getSlate(season, week),
  ]);

  result.teams.total = teams.length;

  // ── 1. Upsert NflWeeks ────────────────────────────────────────────────────
  for (const wr of weekRecords) {
    const weekId = `nfl_${wr.season}_w${wr.week}`;
    const existing = await prisma.nflWeek.findUnique({ where: { id: weekId } });
    if (existing) {
      await prisma.nflWeek.update({
        where: { id: weekId },
        data: { startsAt: new Date(wr.startsAt), endsAt: new Date(wr.endsAt) },
      });
      result.weeks.updated++;
    } else {
      await prisma.nflWeek.create({
        data: {
          id: weekId,
          season: wr.season,
          week: wr.week,
          startsAt: new Date(wr.startsAt),
          endsAt: new Date(wr.endsAt),
          status: "SCHEDULED",
        },
      });
      result.weeks.created++;
    }
  }

  // ── 2. Upsert Games ───────────────────────────────────────────────────────
  const weekId = `nfl_${season}_w${week}`;
  const gameIdMap = new Map<string, string>(); // externalId → DB id

  for (const gr of gameRecords) {
    // Natural key: homeTeam + awayTeam within the same week
    const existing = await prisma.game.findFirst({
      where: { weekId, homeTeam: gr.homeTeam, awayTeam: gr.awayTeam },
    });

    if (existing) {
      await prisma.game.update({
        where: { id: existing.id },
        data: {
          kickoffTime: new Date(gr.kickoffTime),
          externalProviderId: gr.externalId,
          providerStatus: gr.status,
          homeScore: gr.homeScore,
          awayScore: gr.awayScore,
          period: gr.period,
          gameClock: gr.clock,
          possession: gr.possession,
          scoreProvider: hasLiveGameData(gr) ? provider.name : undefined,
          scoreUpdatedAt: hasLiveGameData(gr) ? new Date() : undefined,
        },
      });
      gameIdMap.set(gr.externalId, existing.id);
      result.games.updated++;
    } else {
      const weekExists = await prisma.nflWeek.findUnique({ where: { id: weekId } });
      if (!weekExists) continue; // skip games for weeks that weren't synced

      const created = await prisma.game.create({
        data: {
          weekId,
          homeTeam: gr.homeTeam,
          awayTeam: gr.awayTeam,
          kickoffTime: new Date(gr.kickoffTime),
          externalProviderId: gr.externalId,
          providerStatus: gr.status,
          homeScore: gr.homeScore,
          awayScore: gr.awayScore,
          period: gr.period,
          gameClock: gr.clock,
          possession: gr.possession,
          scoreProvider: hasLiveGameData(gr) ? provider.name : undefined,
          scoreUpdatedAt: hasLiveGameData(gr) ? new Date() : undefined,
        },
      });
      gameIdMap.set(gr.externalId, created.id);
      result.games.created++;
    }
  }

  // ── 3. Upsert Players ────────────────────────────────────────────────────
  const playerIdMap = new Map<string, string>(); // externalId → DB id

  for (const pr of playerRecords) {
    // Try by externalProviderId first, then by (name, team)
    let existing = await prisma.player.findFirst({
      where: { externalProviderId: pr.externalId },
    });

    if (!existing) {
      existing = await prisma.player.findFirst({
        where: { name: pr.name, team: pr.teamAbbreviation },
      });
    }

    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          status: pr.status,
          externalProviderId: pr.externalId,
        },
      });
      playerIdMap.set(pr.externalId, existing.id);
      result.players.updated++;
    } else {
      const created = await prisma.player.create({
        data: {
          id: crypto.randomUUID(),
          name: pr.name,
          team: pr.teamAbbreviation,
          position: pr.position,
          status: pr.status,
          externalProviderId: pr.externalId,
        },
      });
      playerIdMap.set(pr.externalId, created.id);
      result.players.created++;
    }
  }

  // ── 4. Create missing Markets (never overwrite existing) ─────────────────
  for (const entry of slateRecord.players) {
    const dbPlayerId = playerIdMap.get(entry.playerExternalId);
    const dbGameId   = gameIdMap.get(entry.gameExternalId);

    if (!dbPlayerId) continue;

    const player = await prisma.player.findUnique({ where: { id: dbPlayerId } });
    if (!player) continue;

    const game = dbGameId ? await prisma.game.findUnique({ where: { id: dbGameId } }) : null;
    const kickoffTime = game?.kickoffTime ?? new Date();

    for (const threshold of THRESHOLDS) {
      const marketId = `m_${dbPlayerId}_${threshold.toLowerCase()}`;

      const existingMarket = await prisma.market.findUnique({ where: { id: marketId } });
      if (existingMarket) {
        result.markets.skipped++;
        continue;
      }

      // Also check unique constraint (playerId, weekId, thresholdType)
      const byUniqueKey = await prisma.market.findFirst({
        where: { playerId: dbPlayerId, weekId, thresholdType: threshold },
      });
      if (byUniqueKey) {
        result.markets.skipped++;
        continue;
      }

      const yesPrice = calcInitialYesPrice(entry.projection, threshold);
      const noPrice  = 1 - yesPrice;
      const totalPool = 500;

      await prisma.market.create({
        data: {
          id: marketId,
          playerId: dbPlayerId,
          weekId,
          gameId: dbGameId ?? null,
          position: player.position,
          thresholdType: threshold,
          yesPrice,
          noPrice,
          openingPrice: yesPrice,
          yesPool: totalPool * noPrice,
          noPool:  totalPool * yesPrice,
          volume: 0,
          openInterest: 0,
          status: "OPEN",
          kickoffTime,
        },
      });

      await prisma.marketEvent.create({
        data: {
          marketId,
          type: "ADMIN_NOTE",
          priceAfter: yesPrice,
          liquidity: totalPool,
          volume: 0,
          openInterest: 0,
          note: `Market created by ${provider.name} data sync`,
        },
      });

      result.markets.created++;
    }
  }

  return result;
}

function hasLiveGameData(game: { status?: string; homeScore?: number | null; awayScore?: number | null }) {
  return game.status !== undefined || game.homeScore !== undefined || game.awayScore !== undefined;
}

function calcInitialYesPrice(projection: number, threshold: (typeof THRESHOLDS)[number]): number {
  const base = threshold === "TOP_3" ? 0.22 : threshold === "TOP_5" ? 0.36 : 0.55;
  const boost = Math.min(0.15, Math.max(-0.08, (projection - 15) / 100));
  const raw = Math.min(0.82, Math.max(0.08, base + boost));
  return Math.round(raw * 1_000_000) / 1_000_000;
}
