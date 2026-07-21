"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, ChevronRight, Radio, Trophy } from "lucide-react";
import { TradeLauncher } from "@/components/trade-launcher";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { apiGet, defaultWeekId, type PortfolioResponse } from "@/lib/client-api";
import { pct, thresholdLabel } from "@/lib/format";
import type { GameStatus, LiveGameSummary } from "@/lib/live-games";
import type { ExtendedMarket, TradeAction } from "@/lib/market-view";
import type { Player, Side } from "@/lib/types";

type Ticket = { market: ExtendedMarket; player: Player; side: Side; action: TradeAction };

export default function LivePage() {
  const live = useLiveExchange(defaultWeekId);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const loadPortfolio = useCallback(async () => {
    try {
      const nextPortfolio = await apiGet<PortfolioResponse>("/api/portfolio");
      setPortfolio(nextPortfolio);
      setIsAuthenticated(true);
    } catch {
      setPortfolio(null);
      setIsAuthenticated(false);
    }
  }, []);
  useEffect(() => { void loadPortfolio(); }, [loadPortfolio]);
  useEffect(() => {
    if (live.games.length === 0) return;
    if (!selectedGameId || !live.games.some((game) => game.id === selectedGameId)) setSelectedGameId(live.games[0].id);
  }, [live.games, selectedGameId]);

  const players = useMemo(() => new Map(live.players.map((player) => [player.id, player])), [live.players]);
  const liveScores = useMemo(() => new Map(live.liveScores.map((score) => [score.playerId, score])), [live.liveScores]);
  const positions = useMemo(() => new Map((portfolio?.positions ?? []).map((position) => [position.marketId, position])), [portfolio]);
  const selectedGame = live.games.find((game) => game.id === selectedGameId) ?? null;
  const featuredMarkets = useMemo(() => {
    if (!selectedGame) return [];
    const marketIds = new Set(selectedGame.marketIds);
    return (live.markets as ExtendedMarket[]).filter((market) => marketIds.has(market.id)).sort((a, b) => b.volume - a.volume).slice(0, 6);
  }, [live.markets, selectedGame]);

  const groups = [
    { label: "LIVE", statuses: ["LIVE", "HALFTIME"] as GameStatus[] },
    { label: "UPCOMING", statuses: ["UPCOMING", "DELAYED", "POSTPONED", "CANCELED", "UNKNOWN"] as GameStatus[] },
    { label: "FINAL", statuses: ["FINAL"] as GameStatus[] }
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-frost"><Radio className="h-5 w-5 text-neon" aria-hidden />Live Games <LiveBadge isLive={live.isConnected} /></h1>
          <p className="mt-1 text-sm font-semibold text-muted">NFL Week 1</p>
        </div>
        <Link href={"/markets" as Route} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rim bg-panel px-3 text-xs font-black text-frost hover:border-neon/40 hover:text-neon">
          Markets <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {live.games.length === 0 && live.markets.length === 0 ? <LoadingFeed count={4} /> : null}
      {live.games.length === 0 && live.markets.length > 0 ? <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No games available" description="The current slate has markets without linked game records." /> : null}

      {groups.map((group) => {
        const games = live.games.filter((game) => group.statuses.includes(game.status));
        if (!games.length) return null;
        return (
          <section key={group.label} aria-labelledby={`games-${group.label.toLowerCase()}`}>
            <div className="mb-2 flex items-center gap-2">
              <h2 id={`games-${group.label.toLowerCase()}`} className="font-mono text-xs font-black tracking-widest text-frost">{group.label}</h2>
              <span className="rounded bg-panel2 px-2 py-0.5 font-mono text-[9px] font-black text-muted">{games.length}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {games.map((game) => <GameCard key={game.id} game={game} selected={game.id === selectedGameId} onSelect={() => setSelectedGameId(game.id)} />)}
            </div>
          </section>
        );
      })}

      {selectedGame ? (
        <section className="border-t border-rim pt-5" aria-labelledby="featured-game-markets">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Selected game</p>
              <h2 id="featured-game-markets" className="mt-1 text-lg font-black text-frost">{selectedGame.awayTeam} at {selectedGame.homeTeam}</h2>
            </div>
            <StatusBadge status={selectedGame.status} />
          </div>

          {featuredMarkets.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {featuredMarkets.map((market) => {
                const player = players.get(market.playerId);
                if (!player) return null;
                const position = positions.get(market.id);
                const liveScore = liveScores.get(player.id);
                const sellSide: Side = (position?.yesShares ?? 0) > 0 ? "YES" : "NO";
                const hasShares = (position?.yesShares ?? 0) > 0 || (position?.noShares ?? 0) > 0;
                return (
                  <article key={market.id} className="rounded-lg border border-rim bg-panel p-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar name={player.name} team={player.team} position={player.position} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/players/${player.id}?threshold=${market.threshold}` as Route} className="block truncate text-sm font-black text-frost hover:text-neon">{player.name}</Link>
                        <p className="text-[10px] font-bold text-muted">{player.team} · {thresholdLabel(market.threshold)}</p>
                        {liveScore ? <p className="mt-1 font-mono text-[10px] font-black text-amber">{liveScore.fantasyPoints.toFixed(1)} PTS · BETA</p> : null}
                      </div>
                      <div className="text-right"><p className="font-mono text-base font-black text-neon">{pct(market.yesPrice)}</p><p className="text-[9px] text-muted">YES</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={market.status !== "OPEN"} onClick={() => setTicket({ market, player, side: "YES", action: "BUY" })}
                        className="min-h-10 rounded-md bg-neon/15 text-xs font-black text-neon hover:bg-neon/25 disabled:opacity-35">Buy</button>
                      <button type="button" disabled={market.status !== "OPEN" || (isAuthenticated && !hasShares)} onClick={() => setTicket({ market, player, side: sellSide, action: "SELL" })}
                        className="min-h-10 rounded-md border border-rim bg-panel2 text-xs font-black text-frost hover:border-neon/40 disabled:opacity-35">Sell</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="mt-3 rounded-lg border border-rim bg-panel p-4 text-sm font-semibold text-muted">No featured markets are linked to this game.</p>}
        </section>
      ) : null}

      {ticket ? <TradeLauncher market={ticket.market} player={ticket.player} initialSide={ticket.side} initialAction={ticket.action}
        balance={portfolio?.user.mockBalance ?? 0} position={positions.get(ticket.market.id) ?? null} open showButton={false}
        onOpenChange={(open) => { if (!open) setTicket(null); }} onTradeComplete={() => void loadPortfolio()}
        isAuthenticated={isAuthenticated} returnTo="/live" /> : null}
    </div>
  );
}

function GameCard({ game, selected, onSelect }: { game: LiveGameSummary; selected: boolean; onSelect: () => void }) {
  const hasScore = game.awayScore !== null && game.homeScore !== null;
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? "border-neon/50 bg-neon/5" : "border-rim bg-panel hover:border-frost/25"}`}>
      <div className="flex items-center justify-between gap-3"><StatusBadge status={game.status} /><span className="text-[10px] font-bold text-muted">{gameTime(game)}</span></div>
      <TeamScore team={game.awayTeam} score={game.awayScore} possession={game.possession === game.awayTeam} />
      <TeamScore team={game.homeTeam} score={game.homeScore} possession={game.possession === game.homeTeam} />
      {!hasScore && (game.status === "LIVE" || game.status === "HALFTIME") ? <p className="mt-2 text-[10px] font-semibold text-amber">Score unavailable</p> : null}
      {game.isDataStale ? <p className="mt-2 text-[10px] font-semibold text-amber" role="status">Updates delayed</p> : null}
    </button>
  );
}

function TeamScore({ team, score, possession }: { team: string; score: number | null; possession: boolean }) {
  return <div className="mt-2 grid grid-cols-[32px_1fr_auto] items-center gap-2"><TeamMark team={team} /><span className="text-sm font-black text-frost">{team}{possession ? " ·" : ""}</span><span className="font-mono text-xl font-black text-frost">{score ?? "--"}</span></div>;
}

function TeamMark({ team }: { team: string }) {
  return <span className="grid h-8 w-8 place-items-center rounded-md border border-rim bg-panel2 font-mono text-[10px] font-black text-neon" aria-hidden>{team.slice(0, 3)}</span>;
}

function StatusBadge({ status }: { status: GameStatus }) {
  const tone = status === "LIVE" || status === "HALFTIME" ? "bg-neon/15 text-neon" : status === "FINAL" ? "bg-panel2 text-muted" : status === "DELAYED" || status === "POSTPONED" || status === "CANCELED" ? "bg-crimson/15 text-crimson" : "bg-amber/15 text-amber";
  const Icon = status === "FINAL" ? Trophy : status === "LIVE" || status === "HALFTIME" ? Radio : CalendarClock;
  return <span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[9px] font-black ${tone}`}><Icon className="h-3 w-3" aria-hidden />{status}</span>;
}

function gameTime(game: LiveGameSummary) {
  if (game.status === "FINAL") return "Final";
  if (game.status === "HALFTIME") return "Halftime";
  if (game.status === "LIVE") return [game.period, game.clock].filter(Boolean).join(" · ") || "In progress";
  return new Date(game.kickoffTime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}
