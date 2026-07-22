import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { calcInitialPools, calcOpeningYesPrice, type Position, type ThresholdType } from "@/lib/opening-price-model";

const prisma = new PrismaClient();
const thresholds: ThresholdType[] = ["TOP_3", "TOP_5", "TOP_10"];

type SeededPlayer = {
  id: string;
  name: string;
  position: Position;
  projection: number;
  adpRank?: number;
  matchupAdjustment?: number;
};

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

function shouldApply() {
  return process.argv.includes("--apply");
}

async function main() {
  const apply = shouldApply();
  let checked = 0;
  let changed = 0;
  let skipped = 0;

  for (const player of seededPlayers()) {
    for (const threshold of thresholds) {
      const id = marketId(player.id, threshold);
      const market = await prisma.market.findUnique({ where: { id } });
      if (!market) {
        skipped++;
        continue;
      }
      if (market.status === "SETTLED" || market.status === "VOID") {
        skipped++;
        continue;
      }

      checked++;
      const targetYesPrice = calcOpeningYesPrice(player.projection, player.position, threshold, "ACTIVE", {
        adpRank: player.adpRank,
        matchupAdjustment: player.matchupAdjustment
      });
      const currentYesPrice = market.yesPrice.toNumber();
      if (Math.abs(currentYesPrice - targetYesPrice) < 0.000001) continue;

      const liquidity = market.yesPool.toNumber() + market.noPool.toNumber();
      const { noPrice, yesPool, noPool } = calcInitialPools(targetYesPrice, liquidity);
      changed++;

      console.log(`${apply ? "UPDATE" : "DRY"} ${id} ${player.name} ${threshold}: ${(currentYesPrice * 100).toFixed(1)}% -> ${(targetYesPrice * 100).toFixed(1)}%`);

      if (!apply) continue;

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

  console.log(`${apply ? "Applied" : "Dry run"} complete: ${checked} checked, ${changed} changed, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
