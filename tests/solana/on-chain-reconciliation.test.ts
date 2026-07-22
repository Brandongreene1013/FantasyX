import { describe, expect, it } from "vitest";
import { summarizeIndexedProtocolMarket } from "@/lib/on-chain-reconciliation.service";

describe("on-chain reconciliation summaries", () => {
  it("detects indexed liability mismatches", () => {
    const summary = summarizeIndexedProtocolMarket(
      {
        status: "TRADING",
        result: "UNRESOLVED",
        yesLiability: BigInt(20),
        noLiability: BigInt(10),
        collateralEscrowed: BigInt(20),
        feesAccrued: BigInt(0)
      },
      [
        { yesShares: BigInt(12), noShares: BigInt(0), claimed: false },
        { yesShares: BigInt(7), noShares: BigInt(10), claimed: false }
      ]
    );

    expect(summary.yesLiabilityMatches).toBe(false);
    expect(summary.noLiabilityMatches).toBe(true);
    expect(summary.isSolvent).toBe(true);
  });

  it("ignores claimed positions when comparing outstanding indexed shares", () => {
    const summary = summarizeIndexedProtocolMarket(
      {
        status: "RESOLVED",
        result: "YES",
        yesLiability: BigInt(12),
        noLiability: BigInt(0),
        collateralEscrowed: BigInt(12),
        feesAccrued: BigInt(0)
      },
      [
        { yesShares: BigInt(12), noShares: BigInt(0), claimed: false },
        { yesShares: BigInt(8), noShares: BigInt(0), claimed: true }
      ]
    );

    expect(summary.yesLiabilityMatches).toBe(true);
    expect(summary.requiredBacking).toBe(BigInt(12));
    expect(summary.isSolvent).toBe(true);
  });
});
