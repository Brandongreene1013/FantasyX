import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const seedSource = readFileSync(path.join(process.cwd(), "prisma", "seed.ts"), "utf8");

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
});
