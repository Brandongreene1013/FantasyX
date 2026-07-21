export type GameStatus = "LIVE" | "HALFTIME" | "UPCOMING" | "FINAL" | "DELAYED" | "POSTPONED" | "CANCELED" | "UNKNOWN";

export type LiveGameSummary = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  possession: string | null;
  lastUpdatedAt: string | null;
  isDataStale: boolean;
  dataSource: string | null;
  marketIds: string[];
  playerIds: string[];
};

type GameMarketRecord = {
  id: string;
  playerId: string;
  gameId?: string | null;
  kickoffTime: Date;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  game?: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    providerStatus?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    period?: string | null;
    gameClock?: string | null;
    possession?: string | null;
    scoreProvider?: string | null;
    scoreUpdatedAt?: Date | null;
  } | null;
};

export function summarizeGames(markets: GameMarketRecord[], now = new Date()): LiveGameSummary[] {
  const grouped = new Map<string, GameMarketRecord[]>();
  for (const market of markets) {
    const id = market.game?.id ?? market.gameId;
    if (!id) continue;
    const existing = grouped.get(id);
    if (existing) existing.push(market); else grouped.set(id, [market]);
  }

  return Array.from(grouped.entries()).map(([id, gameMarkets]) => {
    const first = gameMarkets[0];
    const kickoff = first.game?.kickoffTime ?? first.kickoffTime;
    const statuses = new Set(gameMarkets.map((market) => market.status));
    const isFinal = Array.from(statuses).every((status) => status === "SETTLED" || status === "VOID");
    const providerStatus = normalizeProviderStatus(first.game?.providerStatus, kickoff, now);
    const status: GameStatus = isFinal ? "FINAL" : providerStatus ?? (kickoff.getTime() > now.getTime() ? "UPCOMING" : "LIVE");
    const updatedAt = first.game?.scoreUpdatedAt ?? null;
    const isLiveState = status === "LIVE" || status === "HALFTIME";
    const isDataStale = isLiveState && Boolean(first.game?.scoreProvider) && (!updatedAt || now.getTime() - updatedAt.getTime() > 90_000);
    return {
      id,
      homeTeam: first.game?.homeTeam ?? "TBD",
      awayTeam: first.game?.awayTeam ?? "TBD",
      kickoffTime: kickoff.toISOString(),
      status,
      homeScore: first.game?.homeScore ?? null,
      awayScore: first.game?.awayScore ?? null,
      period: first.game?.period ?? null,
      clock: first.game?.gameClock ?? null,
      possession: first.game?.possession ?? null,
      lastUpdatedAt: updatedAt?.toISOString() ?? null,
      isDataStale,
      dataSource: first.game?.scoreProvider ?? null,
      marketIds: gameMarkets.map((market) => market.id),
      playerIds: Array.from(new Set(gameMarkets.map((market) => market.playerId)))
    };
  }).sort((a, b) => gameStatusOrder(a.status) - gameStatusOrder(b.status) || a.kickoffTime.localeCompare(b.kickoffTime));
}

function gameStatusOrder(status: GameStatus) {
  if (status === "LIVE" || status === "HALFTIME") return 0;
  if (status === "UPCOMING" || status === "DELAYED" || status === "POSTPONED" || status === "CANCELED") return 1;
  if (status === "FINAL") return 2;
  return 3;
}

function normalizeProviderStatus(value: string | null | undefined, kickoff: Date, now: Date): GameStatus | null {
  if (!value) return null;
  const status = value.toUpperCase();
  if (status === "SCHEDULED") return kickoff.getTime() > now.getTime() ? "UPCOMING" : "UNKNOWN";
  if (["LIVE", "HALFTIME", "FINAL", "DELAYED", "POSTPONED", "CANCELED", "UNKNOWN"].includes(status)) return status as GameStatus;
  return "UNKNOWN";
}
