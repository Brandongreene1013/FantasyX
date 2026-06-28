import { prisma } from "@/lib/prisma";
import { settleDbPlayerMarkets } from "@/lib/settlement.service";
import type { AdminAuditAction } from "@prisma/client";

export interface SettlementPreviewItem {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  fantasyPoints: number;
  positionalRank: number;
  overallRank: number | null;
  markets: Array<{
    marketId: string;
    thresholdType: string;
    status: string;
    yesWins: boolean;
    totalPositions: number;
    totalPayout: number;
    volume: number;
  }>;
  warnings: string[];
}

export interface SettlementPreview {
  weekId: string;
  generatedAt: string;
  totalPlayers: number;
  totalMarkets: number;
  totalPositions: number;
  estimatedPayout: number;
  alreadySettled: number;
  items: SettlementPreviewItem[];
}

function thresholdToRank(threshold: string): number {
  if (threshold === "TOP_3") return 3;
  if (threshold === "TOP_5") return 5;
  return 10;
}

export async function generateSettlementPreview(weekId: string): Promise<SettlementPreview> {
  const [scores, markets] = await Promise.all([
    prisma.playerScore.findMany({
      where: { weekId },
      include: { player: { select: { id: true, name: true, team: true, position: true } } }
    }),
    prisma.market.findMany({
      where: { weekId },
      include: {
        positions: { select: { id: true, userId: true, yesShares: true, noShares: true, realizedPayout: true } }
      }
    })
  ]);

  const marketsByPlayer = new Map<string, typeof markets>();
  for (const m of markets) {
    if (!marketsByPlayer.has(m.playerId)) marketsByPlayer.set(m.playerId, []);
    marketsByPlayer.get(m.playerId)!.push(m);
  }

  const items: SettlementPreviewItem[] = [];
  let totalMarkets = 0;
  let totalPositions = 0;
  let estimatedPayout = 0;
  let alreadySettled = 0;

  for (const score of scores) {
    const playerMarkets = marketsByPlayer.get(score.playerId) ?? [];
    const warnings: string[] = [];

    if (playerMarkets.length === 0) {
      warnings.push("No markets found for this player in this week");
    }

    const marketItems = playerMarkets.map((m) => {
      const threshold = thresholdToRank(m.thresholdType);
      const yesWins = score.positionalRank <= threshold;

      if (m.status === "SETTLED") alreadySettled++;

      const posCount = m.positions.length;
      let payout = 0;
      for (const pos of m.positions) {
        const shares = yesWins
          ? Number(pos.yesShares)
          : Number(pos.noShares);
        payout += shares;
      }

      totalPositions += posCount;
      estimatedPayout += m.status !== "SETTLED" ? payout : 0;

      if (m.status === "SETTLED") {
        warnings.push(`Market ${m.id} is already settled`);
      }
      if (m.status === "VOID") {
        warnings.push(`Market ${m.id} is void and will be skipped`);
      }

      return {
        marketId: m.id,
        thresholdType: m.thresholdType,
        status: m.status,
        yesWins,
        totalPositions: posCount,
        totalPayout: payout,
        volume: Number(m.volume)
      };
    });

    totalMarkets += playerMarkets.length;

    items.push({
      playerId: score.playerId,
      playerName: score.player.name,
      team: score.player.team,
      position: score.player.position,
      fantasyPoints: Number(score.fantasyPoints),
      positionalRank: score.positionalRank,
      overallRank: score.overallRank,
      markets: marketItems,
      warnings
    });
  }

  // Players with markets but no scores
  for (const [playerId, playerMarkets] of marketsByPlayer) {
    if (scores.find((s) => s.playerId === playerId)) continue;
    const player = playerMarkets[0];
    items.push({
      playerId,
      playerName: player.playerId,
      team: "",
      position: player.position,
      fantasyPoints: 0,
      positionalRank: 0,
      overallRank: null,
      markets: [],
      warnings: ["No score imported for this player — markets will NOT be settled"]
    });
  }

  return {
    weekId,
    generatedAt: new Date().toISOString(),
    totalPlayers: scores.length,
    totalMarkets,
    totalPositions,
    estimatedPayout,
    alreadySettled,
    items
  };
}

export interface BatchSettlementResult {
  weekId: string;
  playersSettled: number;
  marketsSettled: number;
  skipped: number;
  errors: Array<{ playerId: string; message: string }>;
}

export async function approveBatchSettlement(input: {
  weekId: string;
  adminId: string;
}): Promise<BatchSettlementResult> {
  const scores = await prisma.playerScore.findMany({
    where: { weekId: input.weekId },
    include: { player: { select: { id: true, name: true } } }
  });

  if (scores.length === 0) {
    throw new Error("No scores imported for this week. Import scores before approving settlement.");
  }

  let playersSettled = 0;
  let marketsSettled = 0;
  let skipped = 0;
  const errors: Array<{ playerId: string; message: string }> = [];

  for (const score of scores) {
    try {
      const settled = await prisma.$transaction(async (tx) => {
        return settleDbPlayerMarkets(tx, {
          playerId: score.playerId,
          weekId: input.weekId,
          rank: score.positionalRank,
          settledById: input.adminId,
          fantasyPoints: Number(score.fantasyPoints),
          reason: `Batch settlement — Half-PPR rank ${score.positionalRank}, ${score.fantasyPoints} pts`
        });
      });

      if (settled.length === 0) {
        skipped++;
      } else {
        playersSettled++;
        marketsSettled += settled.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "No markets" is expected for players with scores but no markets
      if (msg.includes("No markets found")) {
        skipped++;
      } else {
        errors.push({ playerId: score.playerId, message: msg });
      }
    }
  }

  // Write a single audit record for the batch
  await prisma.adminAuditLog.create({
    data: {
      actorId: input.adminId,
      action: "SETTLEMENT_BATCH" as AdminAuditAction,
      weekId: input.weekId,
      reason: `Batch settlement approved: ${playersSettled} players, ${marketsSettled} markets`,
      nextState: `SETTLED`
    }
  });

  return { weekId: input.weekId, playersSettled, marketsSettled, skipped, errors };
}
