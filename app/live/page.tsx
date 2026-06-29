"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Activity, Bell, Clock, Radio, Star, TrendingDown, TrendingUp, Trophy, WalletCards } from "lucide-react";
import { Countdown } from "@/components/ui/countdown";
import { ExchangeFeed } from "@/components/ui/exchange-feed";
import { LiveBadge } from "@/components/ui/live-badge";
import { MarketHeatCell, PriceCell, TerminalPanel } from "@/components/ui/terminal-panel";
import { apiGet, defaultWeekId, type PortfolioResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { useLiveExchange } from "@/hooks/use-live-exchange";

type WatchlistResponse = { marketIds: string[] };
type LiveMarket = ReturnType<typeof useLiveExchange>["markets"][number];

export default function LivePage() {
  const live = useLiveExchange(defaultWeekId);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    function loadPortfolio() {
      Promise.all([
        apiGet<PortfolioResponse>("/api/portfolio").catch(() => null),
        apiGet<WatchlistResponse>("/api/watchlist").catch(() => ({ marketIds: [] }))
      ]).then(([portfolioData, watchlistData]) => {
        if (!active) return;
        setPortfolio(portfolioData);
        setWatchlist(new Set(watchlistData.marketIds));
      });
    }
    loadPortfolio();
    const timer = setInterval(loadPortfolio, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!live.status) return;
    if (live.status.lockedMarkets > 0) {
      setAlertMessage(`${live.status.lockedMarkets} markets are locking or locked.`);
    } else if (live.feed.length > 0) {
      const latest = live.feed[0];
      setAlertMessage(`${latest.action} ${latest.side} filled on ${latest.playerName}.`);
    }
  }, [live.status, live.feed]);

  const playerMap = useMemo(() => new Map(live.players.map((player) => [player.id, player])), [live.players]);
  const markets = live.markets;
  const liveGames = useMemo(() => buildLiveGames(markets), [markets]);
  const marketBoard = useMemo(() => [...markets].sort((a, b) => b.volume - a.volume).slice(0, 12), [markets]);
  const gainers = useMemo(() => movers(markets, "up"), [markets]);
  const losers = useMemo(() => movers(markets, "down"), [markets]);
  const trackedPlayers = useMemo(() => buildTrackedPlayers(markets, playerMap, watchlist), [markets, playerMap, watchlist]);

  return (
    <div className="live-os space-y-4 pb-6">
      <section className="rounded-xl border border-neon/25 bg-neon/8 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-neon">FantasyX OS</p>
            <h1 className="mt-1 text-2xl font-black text-frost">Live Sunday Command Center</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Games, markets, tape, alerts, watchlist, and portfolio in one installable app surface.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge isLive={live.isConnected} />
            <Link href={"/markets/board" as Route} className="rounded border border-rim bg-panel px-3 py-2 font-mono text-[10px] font-black uppercase text-muted hover:text-frost">
              Full Board
            </Link>
          </div>
        </div>
        {alertMessage ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/10 px-3 py-2 text-xs font-bold text-amber" role="status">
            <Bell className="h-4 w-4" aria-hidden />
            {alertMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1.5fr]">
        <TerminalPanel label="LIVE GAMES">
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {liveGames.map((game) => (
              <div key={game.id} className="rounded border border-rim bg-panel2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-frost">{game.awayTeam} @ {game.homeTeam}</span>
                  <span className="rounded bg-neon/10 px-2 py-0.5 font-mono text-[9px] font-black text-neon">{game.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Quarter" value={game.quarter} />
                  <Metric label="Clock" value={game.clock} />
                  <Metric label="Poss" value={game.possession} />
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-sm font-black text-frost">
                  <span>{game.awayTeam} {game.awayScore}</span>
                  <span>{game.homeScore} {game.homeTeam}</span>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-muted">{game.players} fantasy-relevant players tracked</p>
              </div>
            ))}
          </div>
        </TerminalPanel>

        <TerminalPanel label="LIVE MARKET BOARD" action={<Link href="/markets/board" className="text-neon hover:underline">OPEN</Link>}>
          <div className="divide-y divide-rim/40">
            {marketBoard.map((market) => {
              const player = playerMap.get(market.playerId);
              if (!player) return null;
              return (
                <Link key={market.id} href={`/markets/${market.id}` as Route} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 hover:bg-panel2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-black text-frost">{player.name}</p>
                    <p className="font-mono text-[9px] text-muted">{player.team} {market.position} - {thresholdLabel(market.threshold)}</p>
                  </div>
                  <PriceCell value={market.yesPrice} direction="flat" />
                  <PriceCell value={market.noPrice} direction="flat" />
                  <MarketHeatCell yesPrice={market.yesPrice} size={28} />
                </Link>
              );
            })}
          </div>
        </TerminalPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <TerminalPanel label="TRADING TAPE">
          <ExchangeFeed events={live.feed} maxItems={10} className="border-0" />
        </TerminalPanel>

        <TerminalPanel label="PORTFOLIO">
          <div className="grid gap-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Equity" value={portfolio ? credits(portfolio.user.equity) : "--"} icon={<WalletCards className="h-4 w-4" />} />
              <Metric label="Open Positions" value={String(portfolio?.positions.length ?? 0)} />
              <Metric label="Unrealized" value={portfolio ? credits(portfolio.analytics.unrealizedGainLoss) : "--"} />
              <Metric label="Win Rate" value={portfolio ? pct(portfolio.analytics.winRate) : "--"} />
            </div>
            <Link href={"/portfolio" as Route} className="rounded border border-rim bg-panel2 px-3 py-2 text-center font-mono text-[10px] font-black uppercase text-muted hover:text-frost">
              Open Portfolio
            </Link>
          </div>
        </TerminalPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <MarketList title="TOP GAINERS" icon={<TrendingUp className="h-4 w-4 text-neon" />} markets={gainers} playerMap={playerMap} />
        <MarketList title="TOP LOSERS" icon={<TrendingDown className="h-4 w-4 text-crimson" />} markets={losers} playerMap={playerMap} />
        <TerminalPanel label="LEADERBOARD">
          <div className="divide-y divide-rim/40">
            {live.leaderboard.slice(0, 8).map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded bg-panel2 font-mono text-[10px] font-black text-neon">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-frost">{entry.name}</span>
                <span className="font-mono text-[10px] font-black text-muted">{credits(entry.weeklyPnl)}</span>
              </div>
            ))}
            {live.leaderboard.length === 0 ? <div className="p-4 text-center font-mono text-[10px] text-muted">NO LEADERBOARD SIGNAL YET</div> : null}
          </div>
        </TerminalPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <TerminalPanel label="PLAYER TRACKER">
          <div className="divide-y divide-rim/40">
            {trackedPlayers.map((tracked) => (
              <Link key={tracked.marketId} href={`/markets/${tracked.marketId}` as Route} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 hover:bg-panel2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-black text-frost">{tracked.name}</p>
                  <p className="font-mono text-[9px] text-muted">{tracked.status} - projected {tracked.projectedFinish} - rank {tracked.currentRank}</p>
                </div>
                <span className="font-mono text-[10px] font-black text-muted">{tracked.fantasyPoints.toFixed(1)} pts</span>
                <PriceCell value={tracked.yesPrice} direction={tracked.trend === "UP" ? "up" : tracked.trend === "DOWN" ? "down" : "flat"} />
                <span className="font-mono text-[10px] font-black text-muted">{tracked.trend}</span>
              </Link>
            ))}
          </div>
        </TerminalPanel>

        <TerminalPanel label="WATCHLIST 2.0">
          <div className="grid gap-2 p-3">
            {trackedPlayers.filter((tracked) => tracked.isWatched).slice(0, 8).map((tracked) => (
              <Link key={tracked.marketId} href={`/markets/${tracked.marketId}` as Route} className="flex items-center gap-2 rounded border border-rim bg-panel2 px-3 py-2">
                <Star className="h-4 w-4 text-amber" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-black text-frost">{tracked.name}</span>
                <span className="font-mono text-[10px] font-black text-neon">{pct(tracked.yesPrice)}</span>
              </Link>
            ))}
            {trackedPlayers.filter((tracked) => tracked.isWatched).length === 0 ? (
              <div className="rounded border border-rim bg-panel2 p-4 text-center text-xs font-semibold text-muted">
                Pin markets from the feed or board to build a Sunday dashboard.
              </div>
            ) : null}
          </div>
        </TerminalPanel>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border border-rim bg-panel2 p-2">
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted">{icon}{label}</p>
      <p className="mt-1 font-mono text-sm font-black text-frost">{value}</p>
    </div>
  );
}

function MarketList({ title, icon, markets, playerMap }: { title: string; icon: React.ReactNode; markets: LiveMarket[]; playerMap: Map<string, { id: string; name: string; team: string }> }) {
  return (
    <TerminalPanel label={title} action={icon}>
      <div className="divide-y divide-rim/40">
        {markets.map((market) => {
          const player = playerMap.get(market.playerId);
          if (!player) return null;
          const move = market.openingPrice ? (market.yesPrice - market.openingPrice) / market.openingPrice : 0;
          return (
            <Link key={market.id} href={`/markets/${market.id}` as Route} className="flex items-center gap-3 px-3 py-2 hover:bg-panel2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-black text-frost">{player.name}</p>
                <p className="font-mono text-[9px] text-muted">{thresholdLabel(market.threshold)}</p>
              </div>
              <span className={`font-mono text-[10px] font-black ${move >= 0 ? "text-neon" : "text-crimson"}`}>
                {move >= 0 ? "+" : ""}{(move * 100).toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>
    </TerminalPanel>
  );
}

function buildLiveGames(markets: LiveMarket[]) {
  const grouped = new Map<string, { id: string; homeTeam: string; awayTeam: string; players: number; status: string; quarter: string; clock: string; possession: string; homeScore: number; awayScore: number }>();
  for (const market of markets) {
    const id = `${market.kickoffTime}-${market.position}`;
    const existing = grouped.get(id);
    if (existing) {
      existing.players += 1;
      continue;
    }
    const seed = market.id.length + Math.round(market.yesPrice * 100);
    grouped.set(id, {
      id,
      homeTeam: market.position,
      awayTeam: market.threshold.replace("TOP_", "T"),
      players: 1,
      status: market.status === "OPEN" ? "LIVE" : market.status,
      quarter: seed % 2 === 0 ? "Q2" : "Q3",
      clock: `${8 + (seed % 5)}:${String((seed * 7) % 60).padStart(2, "0")}`,
      possession: seed % 2 === 0 ? "HOME" : "AWAY",
      homeScore: 7 + (seed % 24),
      awayScore: 3 + ((seed * 3) % 24)
    });
  }
  return Array.from(grouped.values()).slice(0, 8);
}

function movers(markets: LiveMarket[], direction: "up" | "down") {
  return [...markets]
    .sort((a, b) => {
      const moveA = a.yesPrice - a.openingPrice;
      const moveB = b.yesPrice - b.openingPrice;
      return direction === "up" ? moveB - moveA : moveA - moveB;
    })
    .slice(0, 8);
}

function buildTrackedPlayers(markets: LiveMarket[], playerMap: Map<string, { id: string; name: string; team: string }>, watchlist: Set<string>) {
  return markets
    .slice(0, 30)
    .map((market, index) => {
      const player = playerMap.get(market.playerId);
      if (!player) return null;
      const move = market.yesPrice - market.openingPrice;
      return {
        marketId: market.id,
        name: player.name,
        yesPrice: market.yesPrice,
        fantasyPoints: 4 + market.yesPrice * 28 + index * 0.1,
        projectedFinish: thresholdLabel(market.threshold),
        currentRank: Math.max(1, Math.round((1 - market.yesPrice) * 24)),
        status: market.status,
        trend: move > 0.01 ? "UP" : move < -0.01 ? "DOWN" : "FLAT",
        isWatched: watchlist.has(market.id)
      };
    })
    .filter((tracked): tracked is NonNullable<typeof tracked> => Boolean(tracked));
}
