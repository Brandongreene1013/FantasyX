import { describe, expect, it } from "vitest";
import {
  isProtocolMarketSolvent,
  requiredProtocolBacking,
  type ProtocolSolvencySnapshot
} from "@/packages/blockchain-domain/src";

function snapshot(input: Partial<ProtocolSolvencySnapshot>): ProtocolSolvencySnapshot {
  return {
    status: "TRADING",
    result: "UNRESOLVED",
    yesLiability: BigInt(0),
    noLiability: BigInt(0),
    collateralEscrowed: BigInt(0),
    feesAccrued: BigInt(0),
    ...input
  };
}

describe("protocol solvency invariants", () => {
  it("backs open binary markets by the larger outcome liability plus fees", () => {
    const market = snapshot({
      yesLiability: BigInt(500),
      noLiability: BigInt(300),
      feesAccrued: BigInt(5),
      collateralEscrowed: BigInt(505)
    });
    expect(requiredProtocolBacking(market)).toBe(BigInt(505));
    expect(isProtocolMarketSolvent(market)).toBe(true);
  });

  it("requires only the winning outcome after resolution", () => {
    const market = snapshot({
      status: "RESOLVED",
      result: "NO",
      yesLiability: BigInt(900),
      noLiability: BigInt(250),
      collateralEscrowed: BigInt(250)
    });
    expect(requiredProtocolBacking(market)).toBe(BigInt(250));
    expect(isProtocolMarketSolvent(market)).toBe(true);
  });

  it("requires both sides to be refundable when cancelled", () => {
    const market = snapshot({
      status: "CANCELLED",
      result: "CANCELLED",
      yesLiability: BigInt(500),
      noLiability: BigInt(300),
      collateralEscrowed: BigInt(799)
    });
    expect(requiredProtocolBacking(market)).toBe(BigInt(800));
    expect(isProtocolMarketSolvent(market)).toBe(false);
  });
});
