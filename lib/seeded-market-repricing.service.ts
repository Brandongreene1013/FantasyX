import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { calcInitialPools, calcOpeningYesPrice, type Position, type ThresholdType } from "@/lib/opening-price-model";

const thresholds: ThresholdType[] = ["TOP_3", "TOP_5", "TOP_10"];

type SeededPlayer = {
  id: string;
  name: string;
  position: Position;
  projection: number;
  adpRank?: number;
  matchupAdjustment?: number;
};

export type RepriceSeededMarketsResult = {
  checked: number;
  changed: number;
  skipped: number;
  updates: Array<{ marketId: string; playerName: string; threshold: ThresholdType; before: number; after: number }>;
};

export type EnforceThresholdOrderingResult = {
  checkedPlayers: number;
  changedMarkets: number;
  skippedPlayers: number;
  updates: Array<{ marketId: string; before: number; after: number }>;
};

export async function repriceSeededMarkets(
  prisma: PrismaClient,
  options: { apply: boolean; log?: (message: string) => void }
): Promise<RepriceSeededMarketsResult> {
  const result: RepriceSeededMarketsResult = { checked: 0, changed: 0, skipped: 0, updates: [] };

  for (const player of seededPlayers()) {
    for (const threshold of thresholds) {
      const id = marketId(player.id, threshold);
      const market = await prisma.market.findUnique({ where: { id } });
      if (!market) {
        result.skipped++;
        continue;
      }
      if (market.status === "SETTLED" || market.status === "VOID") {
        result.skipped++;
        continue;
      }

      result.checked++;
      const targetYesPrice = calcOpeningYesPrice(player.projection, player.position, threshold, "ACTIVE", {
        adpRank: player.adpRank,
        matchupAdjustment: player.matchupAdjustment
      });
      const currentYesPrice = market.yesPrice.toNumber();
      if (Math.abs(currentYesPrice - targetYesPrice) < 0.000001) continue;

      const liquidity = market.yesPool.toNumber() + market.noPool.toNumber();
      const { noPrice, yesPool, noPool } = calcInitialPools(targetYesPrice, liquidity);
      result.changed++;
      result.updates.push({ marketId: id, playerName: player.name, threshold, before: currentYesPrice, after: targetYesPrice });
      options.log?.(`${options.apply ? "UPDATE" : "DRY"} ${id} ${player.name} ${threshold}: ${(currentYesPrice * 100).toFixed(1)}% -> ${(targetYesPrice * 100).toFixed(1)}%`);

      if (!options.apply) continue;

      await prisma.$transaction(async (tx) => {
        await tx.market.update({
          where: { id },
          data: {
            yesPrice: targetYesPrice,
            noPrice,
            openingPrice: targetYesPrice,
            yesPool,
            noPool
          }
        });
        await tx.marketEvent.create({
          data: {
            marketId: id,
            type: "ADMIN_NOTE",
            priceBefore: currentYesPrice,
            priceAfter: targetYesPrice,
            liquidity,
            volume: market.volume,
            openInterest: market.openInterest,
            note: "Repriced with threshold-aware projection model to prevent dominated rank markets"
          }
        });
      });
    }
  }

  return result;
}

export async function enforceThresholdOrdering(prisma: PrismaClient): Promise<EnforceThresholdOrderingResult> {
  const markets = await prisma.market.findMany({
    where: { status: { notIn: ["SETTLED", "VOID"] } },
    orderBy: [{ playerId: "asc" }, { thresholdType: "asc" }]
  });
  const grouped = new Map<string, typeof markets>();
  for (const market of markets) {
    grouped.set(market.playerId, [...(grouped.get(market.playerId) ?? []), market]);
  }

  const result: EnforceThresholdOrderingResult = {
    checkedPlayers: 0,
    changedMarkets: 0,
    skippedPlayers: 0,
    updates: []
  };

  for (const playerMarkets of grouped.values()) {
    const top3 = playerMarkets.find((market) => market.thresholdType === "TOP_3");
    const top5 = playerMarkets.find((market) => market.thresholdType === "TOP_5");
    const top10 = playerMarkets.find((market) => market.thresholdType === "TOP_10");
    if (!top3 || !top5 || !top10) {
      result.skippedPlayers++;
      continue;
    }

    result.checkedPlayers++;
    let targetTop3 = top3.yesPrice.toNumber();
    let targetTop5 = top5.yesPrice.toNumber();
    let targetTop10 = top10.yesPrice.toNumber();

    if (targetTop3 > 0.935) targetTop3 = 0.935;
    if (targetTop5 > 0.955) targetTop5 = 0.955;
    if (targetTop10 > 0.98) targetTop10 = 0.98;

    targetTop5 = Math.max(targetTop5, targetTop3 + 0.02);
    if (targetTop5 > 0.955) {
      targetTop5 = 0.955;
      targetTop3 = Math.min(targetTop3, 0.935);
    }

    targetTop10 = Math.max(targetTop10, targetTop5 + 0.025);
    if (targetTop10 > 0.98) {
      targetTop10 = 0.98;
      targetTop5 = Math.min(targetTop5, 0.955);
      targetTop3 = Math.min(targetTop3, 0.935);
    }

    for (const [market, targetYesPrice] of [[top3, targetTop3], [top5, targetTop5], [top10, targetTop10]] as const) {
      const currentYesPrice = market.yesPrice.toNumber();
      const roundedTarget = round6(targetYesPrice);
      if (Math.abs(currentYesPrice - roundedTarget) < 0.000001) continue;

      const liquidity = market.yesPool.toNumber() + market.noPool.toNumber();
      const { noPrice, yesPool, noPool } = calcInitialPools(roundedTarget, liquidity);
      await prisma.$transaction(async (tx) => {
        await tx.market.update({
          where: { id: market.id },
          data: {
            yesPrice: roundedTarget,
            noPrice,
            yesPool,
            noPool
          }
        });
        await tx.marketEvent.create({
          data: {
            marketId: market.id,
            type: "ADMIN_NOTE",
            priceBefore: currentYesPrice,
            priceAfter: roundedTarget,
            liquidity,
            volume: market.volume,
            openInterest: market.openInterest,
            note: "Adjusted threshold ladder to prevent dominated rank contracts"
          }
        });
      });
      result.changedMarkets++;
      result.updates.push({ marketId: market.id, before: currentYesPrice, after: roundedTarget });
    }
  }

  return result;
}

function seededPlayers(): SeededPlayer[] {
  const source = readFileSync(path.join(process.cwd(), "prisma", "seed.ts"), "utf8");
  const rowPattern = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)"[\s\S]*?position:\s*"(QB|RB|WR|TE)"[\s\S]*?projection:\s*([0-9.]+)([\s\S]*?)\}/g;

  return [...source.matchAll(rowPattern)].map((match) => {
    const tail = match[5];
    const adpRank = tail.match(/adpRank:\s*([0-9.]+)/);
    const matchupAdjustment = tail.match(/matchupAdjustment:\s*(-?[0-9.]+)/);

    return {
      id: match[1],
      name: match[2],
      position: match[3] as Position,
      projection: Number(match[4]),
      adpRank: adpRank ? Number(adpRank[1]) : undefined,
      matchupAdjustment: matchupAdjustment ? Number(matchupAdjustment[1]) : undefined
    };
  });
}

function marketId(playerId: string, threshold: ThresholdType) {
  return `m_${playerId}_${threshold.toLowerCase()}`;
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
