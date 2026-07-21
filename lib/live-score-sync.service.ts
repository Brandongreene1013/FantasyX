import { prisma } from "@/lib/prisma";
import type { INflDataProvider } from "@/lib/nfl-data/provider";
import type { NflGameRecord } from "@/lib/nfl-data/types";

export type LiveScoreSyncResult = {
  provider: string;
  season: number;
  week: number;
  received: number;
  updated: number;
  skipped: number;
};

export async function syncLiveGameScores(provider: INflDataProvider, season: number, week: number): Promise<LiveScoreSyncResult> {
  const records = await provider.getGames(season, week);
  const result: LiveScoreSyncResult = { provider: provider.name, season, week, received: records.length, updated: 0, skipped: 0 };
  const weekId = `nfl_${season}_w${week}`;

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

  return result;
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
