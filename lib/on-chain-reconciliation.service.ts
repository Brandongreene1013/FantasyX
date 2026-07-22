import type { OnChainMarket, OnChainPosition, Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import {
  isProtocolMarketSolvent,
  requiredProtocolBacking,
  type ProtocolMarketResult,
  type ProtocolMarketStatus
} from "@/packages/blockchain-domain/src";

export type IndexedProtocolPosition = Pick<OnChainPosition, "yesShares" | "noShares" | "claimed">;

export type IndexedProtocolMarket = Pick<
  OnChainMarket,
  "status" | "result" | "yesLiability" | "noLiability" | "collateralEscrowed" | "feesAccrued"
>;

export function summarizeIndexedProtocolMarket(
  market: IndexedProtocolMarket,
  positions: IndexedProtocolPosition[]
) {
  const indexedYesShares = positions.reduce((total, position) => total + (position.claimed ? BigInt(0) : position.yesShares), BigInt(0));
  const indexedNoShares = positions.reduce((total, position) => total + (position.claimed ? BigInt(0) : position.noShares), BigInt(0));
  const requiredBacking = requiredProtocolBacking({
    status: market.status as ProtocolMarketStatus,
    result: market.result as ProtocolMarketResult,
    yesLiability: market.yesLiability,
    noLiability: market.noLiability,
    collateralEscrowed: market.collateralEscrowed,
    feesAccrued: market.feesAccrued
  });
  const isSolvent = isProtocolMarketSolvent({
    status: market.status as ProtocolMarketStatus,
    result: market.result as ProtocolMarketResult,
    yesLiability: market.yesLiability,
    noLiability: market.noLiability,
    collateralEscrowed: market.collateralEscrowed,
    feesAccrued: market.feesAccrued
  });

  return {
    indexedYesShares,
    indexedNoShares,
    storedYesLiability: market.yesLiability,
    storedNoLiability: market.noLiability,
    yesLiabilityMatches: indexedYesShares === market.yesLiability,
    noLiabilityMatches: indexedNoShares === market.noLiability,
    requiredBacking,
    collateralEscrowed: market.collateralEscrowed,
    isSolvent
  };
}

export async function reconcileIndexedProtocolMarket(tx: Prisma.TransactionClient, onChainMarketId: string) {
  const market = await tx.onChainMarket.findUniqueOrThrow({
    where: { id: onChainMarketId },
    include: { positions: true }
  });
  const summary = summarizeIndexedProtocolMarket(market, market.positions);
  const pass = summary.yesLiabilityMatches && summary.noLiabilityMatches && summary.isSolvent;

  return tx.onChainReconciliationRun.create({
    data: {
      onChainMarketId,
      cluster: market.cluster,
      status: pass ? "PASS" : "FAIL",
      summary: toJsonSummary(summary)
    }
  });
}

function toJsonSummary(summary: ReturnType<typeof summarizeIndexedProtocolMarket>): Prisma.InputJsonValue {
  return {
    indexedYesShares: summary.indexedYesShares.toString(),
    indexedNoShares: summary.indexedNoShares.toString(),
    storedYesLiability: summary.storedYesLiability.toString(),
    storedNoLiability: summary.storedNoLiability.toString(),
    yesLiabilityMatches: summary.yesLiabilityMatches,
    noLiabilityMatches: summary.noLiabilityMatches,
    requiredBacking: summary.requiredBacking.toString(),
    collateralEscrowed: summary.collateralEscrowed.toString(),
    isSolvent: summary.isSolvent
  } satisfies PrismaNamespace.InputJsonObject;
}
