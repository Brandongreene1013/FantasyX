import { prisma } from "@/lib/prisma";
import type { MarketStatus, AdminAuditAction } from "@prisma/client";
import { getTemplatesForPosition } from "@/lib/market-template.service";

export type GenerateMarketsOptions = {
  weekId: string;
  adminId: string;
  initialStatus?: Extract<MarketStatus, "DRAFT" | "OPEN">;
  templateIds?: string[];
  playerIds?: string[];
};

export type GenerateMarketsResult = {
  playersProcessed: number;
  marketsCreated: number;
  marketsSkipped: number;
  errors: Array<{ playerId: string; playerName: string; error: string }>;
};

export async function generateMarketsForWeek(
  options: GenerateMarketsOptions
): Promise<GenerateMarketsResult> {
  const { weekId, adminId, initialStatus = "OPEN" as const, templateIds, playerIds } = options;

  const week = await prisma.nflWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error(`Week not found: ${weekId}`);

  const players = await prisma.player.findMany({
    where: { status: "ACTIVE", ...(playerIds ? { id: { in: playerIds } } : {}) },
    include: {
      markets: {
        where: { weekId },
        select: { thresholdType: true }
      }
    }
  });

  const games = await prisma.game.findMany({ where: { weekId } });

  const result: GenerateMarketsResult = {
    playersProcessed: 0,
    marketsCreated: 0,
    marketsSkipped: 0,
    errors: []
  };

  for (const player of players) {
    result.playersProcessed++;
    const templates = getTemplatesForPosition(player.position);
    const filtered = templateIds
      ? templates.filter((t) => templateIds.includes(t.id))
      : templates;

    const existingThresholds = new Set(player.markets.map((m) => m.thresholdType));

    for (const template of filtered) {
      if (existingThresholds.has(template.thresholdType)) {
        result.marketsSkipped++;
        continue;
      }

      try {
        const game = games.find(
          (g) =>
            g.homeTeam === player.team ||
            g.awayTeam === player.team
        );
        const kickoffTime = game?.kickoffTime ?? week.startsAt;

        const yesPrice = calcInitialYesPrice(template.thresholdType);
        const noPrice = 1 - yesPrice;
        const totalPool = 500;
        const marketId = `m_${player.id}_${weekId}_${template.thresholdType.toLowerCase()}`;

        const existing = await prisma.market.findUnique({ where: { id: marketId } });
        if (existing) {
          result.marketsSkipped++;
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.market.create({
            data: {
              id: marketId,
              playerId: player.id,
              weekId,
              gameId: game?.id ?? null,
              position: player.position,
              thresholdType: template.thresholdType,
              yesPrice,
              noPrice,
              openingPrice: yesPrice,
              yesPool: totalPool * noPrice,
              noPool: totalPool * yesPrice,
              volume: 0,
              openInterest: 0,
              status: initialStatus,
              kickoffTime
            }
          });

          await tx.marketEvent.create({
            data: {
              marketId,
              type: "ADMIN_NOTE",
              priceAfter: yesPrice,
              liquidity: totalPool,
              volume: 0,
              openInterest: 0,
              note: `Market created via FX-011 weekly slate generator (status: ${initialStatus})`
            }
          });
        });

        await prisma.adminAuditLog.create({
          data: {
            actorId: adminId,
            action: "MARKET_CREATE" as AdminAuditAction,
            marketId,
            weekId,
            playerId: player.id,
            nextState: initialStatus,
            reason: `Generated via weekly slate builder for ${weekId}`
          }
        });

        result.marketsCreated++;
      } catch (err) {
        result.errors.push({
          playerId: player.id,
          playerName: player.name,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
  }

  return result;
}

function calcInitialYesPrice(threshold: string): number {
  const base = threshold === "TOP_3" ? 0.22 : threshold === "TOP_5" ? 0.36 : 0.55;
  return Math.round(base * 1_000_000) / 1_000_000;
}

export type BulkActionType = "OPEN" | "LOCK" | "VOID" | "ARCHIVE";

export type BulkActionResult = {
  affected: number;
  skipped: number;
  action: BulkActionType;
};

export async function bulkMarketAction(
  weekId: string,
  action: BulkActionType,
  adminId: string,
  reason?: string
): Promise<BulkActionResult> {
  const week = await prisma.nflWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error(`Week not found: ${weekId}`);

  const markets = await prisma.market.findMany({ where: { weekId } });
  let affected = 0;
  let skipped = 0;

  for (const market of markets) {
    const eligible = isEligibleForBulkAction(market.status, action);
    if (!eligible) {
      skipped++;
      continue;
    }

    const newStatus = bulkActionStatus(action);

    await prisma.market.update({
      where: { id: market.id },
      data: { status: newStatus as MarketStatus }
    });

    await prisma.marketEvent.create({
      data: {
        marketId: market.id,
        type: action === "OPEN" ? "UNLOCK" : action === "LOCK" ? "LOCK" : "VOID",
        note: reason ?? `Bulk ${action} for week ${weekId}`,
        priceAfter: market.yesPrice,
        liquidity: market.yesPool.toNumber() + market.noPool.toNumber(),
        volume: market.volume,
        openInterest: market.openInterest
      }
    });

    affected++;
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: adminId,
      action: (action === "OPEN" ? "BULK_OPEN" : action === "LOCK" ? "BULK_LOCK" : action === "VOID" ? "BULK_VOID" : "WEEK_ARCHIVE") as AdminAuditAction,
      weekId,
      reason: reason ?? `Bulk ${action} for week ${weekId}`,
      previousState: "MIXED",
      nextState: bulkActionStatus(action)
    }
  });

  return { affected, skipped, action };
}

function isEligibleForBulkAction(status: string, action: BulkActionType): boolean {
  if (action === "OPEN")    return status === "DRAFT" || status === "SCHEDULED" || status === "LOCKED";
  if (action === "LOCK")    return status === "DRAFT" || status === "SCHEDULED" || status === "OPEN";
  if (action === "VOID")    return status !== "SETTLED" && status !== "VOID";
  if (action === "ARCHIVE") return status !== "SETTLED" && status !== "VOID";
  return false;
}

function bulkActionStatus(action: BulkActionType): string {
  if (action === "OPEN")    return "OPEN";
  if (action === "LOCK")    return "LOCKED";
  if (action === "VOID")    return "VOID";
  if (action === "ARCHIVE") return "VOID";
  return "OPEN";
}
