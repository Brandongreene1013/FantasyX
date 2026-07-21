import { prisma } from "@/lib/prisma";
import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type { NflGameRecord } from "@/lib/nfl-data/types";
import { calculateHalfPpr } from "@/lib/scoring.service";

export type LiveScoreSyncResult = {
  provider: string;
  season: number;
  week: number;
  received: number;
  updated: number;
  skipped: number;
  playerStats: {
    gamesFetched: number;
    received: number;
    updated: number;
    unknownPlayers: number;
  };
};

export async function syncLiveGameScores(provider: INflDataProvider, season: number, week: number): Promise<LiveScoreSyncResult> {
  const records = await provider.getGames(season, week);
  const result: LiveScoreSyncResult = {
    provider: provider.name,
    season,
    week,
    received: records.length,
    updated: 0,
    skipped: 0,
    playerStats: { gamesFetched: 0, received: 0, updated: 0, unknownPlayers: 0 }
  };
  const weekId = `nfl_${season}_w${week}`;
  const statCandidates: Array<{ record: NflGameRecord; gameId: string }> = [];

  for (const record of records) {
    if (!hasLiveGameData(record)) {
      result.skipped++;
      continue;
    }

    const game = await findGame(weekId, record);
    if (!game) {
      result.skipped++;
      continue;
    }

    if (shouldFetchPlayerStats(record.status, game.providerStatus)) {
      statCandidates.push({ record, gameId: game.id });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: {
        kickoffTime: parseDate(record.kickoffTime, game.kickoffTime),
        externalProviderId: record.externalId,
        providerStatus: record.status,
        homeScore: record.homeScore,
        awayScore: record.awayScore,
        period: record.period,
        gameClock: record.clock,
        possession: record.possession,
        scoreProvider: provider.name,
        scoreUpdatedAt: new Date()
      }
    });
    result.updated++;
  }


  if (provider.getPlayerGameStats) {
    for (const candidate of statCandidates) {
      const stats = await provider.getPlayerGameStats(candidate.record.externalId);
      result.playerStats.gamesFetched++;
      result.playerStats.received += stats.length;

      for (const playerStats of stats) {
        const player = await prisma.player.findFirst({
          where: {
            OR: [
              { externalProviderId: playerStats.playerExternalId },
              { name: playerStats.playerName, team: playerStats.teamAbbreviation }
            ]
          },
          select: { id: true }
        });
        if (!player) {
          result.playerStats.unknownPlayers++;
          continue;
        }

        const fantasyPoints = calculateHalfPpr(playerStats.stats);
        await prisma.livePlayerScore.upsert({
          where: { playerId_weekId: { playerId: player.id, weekId } },
          create: {
            playerId: player.id,
            weekId,
            gameId: candidate.gameId,
            source: provider.name,
            fantasyPoints,
            ...playerStats.stats
          },
          update: {
            gameId: candidate.gameId,
            source: provider.name,
            fantasyPoints,
            ...playerStats.stats
          }
        });
        result.playerStats.updated++;
      }
    }
  }

  return result;
}

export function shouldFetchPlayerStats(nextStatus: NflGameRecord["status"], previousStatus: string | null | undefined) {
  if (nextStatus === "LIVE" || nextStatus === "HALFTIME") return true;
  return nextStatus === "FINAL" && previousStatus !== "FINAL";
}

async function findGame(weekId: string, record: NflGameRecord) {
  const byProviderId = await prisma.game.findUnique({ where: { externalProviderId: record.externalId } });
  if (byProviderId) return byProviderId;
  return prisma.game.findFirst({ where: { weekId, homeTeam: record.homeTeam, awayTeam: record.awayTeam } });
}

export function hasLiveGameData(record: NflGameRecord) {
  return record.status !== undefined || record.homeScore !== undefined || record.awayScore !== undefined;
}

export function parseDate(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
