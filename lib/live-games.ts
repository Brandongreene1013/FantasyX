export type GameStatus = "LIVE" | "UPCOMING" | "FINAL" | "DELAYED" | "POSTPONED" | "UNKNOWN";

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
  marketIds: string[];
  playerIds: string[];
};

type GameMarketRecord = {
  id: string;
  playerId: string;
  gameId?: string | null;
  kickoffTime: Date;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  game?: { id: string; homeTeam: string; awayTeam: string; kickoffTime: Date } | null;
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
    const status: GameStatus = isFinal ? "FINAL" : kickoff.getTime() > now.getTime() ? "UPCOMING" : "LIVE";
    return {
      id,
      homeTeam: first.game?.homeTeam ?? "TBD",
      awayTeam: first.game?.awayTeam ?? "TBD",
      kickoffTime: kickoff.toISOString(),
      status,
      homeScore: null,
      awayScore: null,
      period: null,
      clock: null,
      possession: null,
      marketIds: gameMarkets.map((market) => market.id),
      playerIds: Array.from(new Set(gameMarkets.map((market) => market.playerId)))
    };
  }).sort((a, b) => gameStatusOrder(a.status) - gameStatusOrder(b.status) || a.kickoffTime.localeCompare(b.kickoffTime));
}

function gameStatusOrder(status: GameStatus) {
  if (status === "LIVE") return 0;
  if (status === "UPCOMING" || status === "DELAYED" || status === "POSTPONED") return 1;
  if (status === "FINAL") return 2;
  return 3;
}
