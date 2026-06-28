import type { Market, Player } from "@/lib/types";

type DbMarket = {
  id: string;
  playerId: string;
  weekId: string;
  position: "QB" | "RB" | "WR" | "TE";
  thresholdType: "TOP_3" | "TOP_5" | "TOP_10";
  yesPrice: unknown;
  noPrice: unknown;
  openingPrice?: unknown;
  yesPool: unknown;
  noPool: unknown;
  volume?: unknown;
  openInterest?: unknown;
  status: "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  result: "YES" | "NO" | null;
  kickoffTime: Date;
  player?: {
    id: string;
    name: string;
    team: string;
    position: "QB" | "RB" | "WR" | "TE";
  };
  game?: {
    homeTeam: string;
    awayTeam: string;
  } | null;
};

export function serializeMarket(market: DbMarket): Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number } {
  return {
    id: market.id,
    playerId: market.playerId,
    weekId: market.weekId,
    week: Number(market.weekId.match(/w(\d+)$/)?.[1] ?? 1),
    position: market.position,
    threshold: market.thresholdType,
    yesPrice: toNumber(market.yesPrice),
    noPrice: toNumber(market.noPrice),
    openingPrice: toNumber(market.openingPrice ?? market.yesPrice),
    yesPool: toNumber(market.yesPool),
    noPool: toNumber(market.noPool),
    volume: toNumber(market.volume ?? 0),
    openInterest: toNumber(market.openInterest ?? 0),
    liquidity: toNumber(market.yesPool) + toNumber(market.noPool),
    status: market.status,
    result: market.result,
    kickoffTime: market.kickoffTime.toISOString()
  };
}

export function serializePlayerFromMarket(market: DbMarket): Player | null {
  if (!market.player) {
    return null;
  }

  const opponent =
    market.game?.homeTeam === market.player.team
      ? market.game.awayTeam
      : market.game?.awayTeam === market.player.team
        ? market.game.homeTeam
        : market.game?.homeTeam ?? "TBD";

  return {
    id: market.player.id,
    name: market.player.name,
    team: market.player.team,
    opponent,
    position: market.player.position,
    kickoff: market.kickoffTime.toISOString(),
    projection: 0
  };
}

export function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber() as number;
  }
  return Number(value);
}
