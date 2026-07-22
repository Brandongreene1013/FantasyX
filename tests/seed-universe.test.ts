import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calcOpeningYesPrice, type Position, type ThresholdType } from "@/lib/opening-price-model";

const seedSource = readFileSync(path.join(process.cwd(), "prisma", "seed.ts"), "utf8");
const thresholds: ThresholdType[] = ["TOP_3", "TOP_5", "TOP_10"];

type SeededPlayer = {
  id: string;
  name: string;
  position: Position;
  projection: number;
  adpRank?: number;
  matchupAdjustment?: number;
};

function countSeededPlayersByPosition() {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const positionPattern = /\{\s*id:\s*"[^"]+",\s*name:\s*"[^"]+"[\s\S]*?position:\s*"(QB|RB|WR|TE)"/g;
  let match: RegExpExecArray | null;

  while ((match = positionPattern.exec(seedSource)) !== null) {
    counts[match[1] as keyof typeof counts] += 1;
  }

  return counts;
}

function seededPlayerIds() {
  return [...seedSource.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function seededPlayers(): SeededPlayer[] {
  const rowPattern = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)"[\s\S]*?position:\s*"(QB|RB|WR|TE)"[\s\S]*?projection:\s*([0-9.]+)([\s\S]*?)\}/g;
  return [...seedSource.matchAll(rowPattern)].map((match) => {
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

describe("seed fantasy market universe", () => {
  it("keeps at least 30 seeded players at every fantasy position", () => {
    expect(countSeededPlayersByPosition()).toMatchObject({
      QB: expect.any(Number),
      RB: expect.any(Number),
      WR: expect.any(Number),
      TE: expect.any(Number)
    });

    const counts = countSeededPlayersByPosition();
    expect(counts.QB).toBeGreaterThanOrEqual(30);
    expect(counts.RB).toBeGreaterThanOrEqual(30);
    expect(counts.WR).toBeGreaterThanOrEqual(30);
    expect(counts.TE).toBeGreaterThanOrEqual(30);
  });

  it("does not duplicate seeded player ids", () => {
    const ids = seededPlayerIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prices seeded rank markets monotonically by threshold", () => {
    for (const player of seededPlayers()) {
      const prices = thresholds.map((threshold) =>
        calcOpeningYesPrice(player.projection, player.position, threshold, "ACTIVE", {
          adpRank: player.adpRank,
          matchupAdjustment: player.matchupAdjustment
        })
      );

      expect(prices[0]).toBeLessThanOrEqual(prices[1]);
      expect(prices[1]).toBeLessThanOrEqual(prices[2]);
    }
  });

  it("keeps wider thresholds strictly more expensive than harder thresholds", () => {
    for (const player of seededPlayers()) {
      const [top3, top5, top10] = thresholds.map((threshold) =>
        calcOpeningYesPrice(player.projection, player.position, threshold, "ACTIVE", {
          adpRank: player.adpRank,
          matchupAdjustment: player.matchupAdjustment
        })
      );

      expect(toBasisPoints(top5 - top3)).toBeGreaterThanOrEqual(200);
      expect(toBasisPoints(top10 - top5)).toBeGreaterThanOrEqual(250);
    }
  });

  it("prices elite projections above depth projections within each position", () => {
    const players = seededPlayers();

    for (const position of ["QB", "RB", "WR", "TE"] as Position[]) {
      const positionalPlayers = players.filter((player) => player.position === position);
      const elite = positionalPlayers.reduce((best, player) => player.projection > best.projection ? player : best);
      const depth = positionalPlayers.reduce((worst, player) => player.projection < worst.projection ? player : worst);

      const eliteTop10 = calcOpeningYesPrice(elite.projection, position, "TOP_10", "ACTIVE", {
        adpRank: elite.adpRank,
        matchupAdjustment: elite.matchupAdjustment
      });
      const depthTop10 = calcOpeningYesPrice(depth.projection, position, "TOP_10", "ACTIVE", {
        adpRank: depth.adpRank,
        matchupAdjustment: depth.matchupAdjustment
      });

      expect(eliteTop10).toBeGreaterThan(depthTop10);
    }
  });
});

function toBasisPoints(value: number) {
  return Math.round(value * 10_000);
}
