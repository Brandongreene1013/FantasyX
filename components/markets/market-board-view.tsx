"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Activity, BarChart3, Clock, Flame, Lock, Radio, Snowflake, Sparkles,
  Star, TrendingDown, TrendingUp, Users, Zap
} from "lucide-react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { apiGet, defaultWeekId, type FantasyMarketIntelligence, type MarketScannerResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { THRESHOLD_ORDER, type ExtendedMarket, type MarketSortKey, type PlayerMarketRow, type TradeAction } from "@/lib/market-view";
import { getPositionColor } from "@/lib/team-colors";
import type { Side } from "@/lib/types";

type Position = { yesShares: number; noShares: number };
type SignalTab = "picks" | "hot" | "cold" | "popular";

const BOARD_SORTS: Array<{ value: MarketSortKey; label: string }> = [
  { value: "popular", label: "Popular" },
  { value: "gainers", label: "Hot" },
  { value: "losers", label: "Cold" },
  { value: "volume", label: "Volume" },
  { value: "kickoff", label: "Kickoff" },
  { value: "alpha", label: "A-Z" }
];

const SIGNAL_TABS: Array<{ value: SignalTab; label: string; icon: typeof Sparkles }> = [
  { value: "picks", label: "Picks", icon: Sparkles },
  { value: "hot", label: "Hot", icon: Flame },
  { value: "cold", label: "Cold", icon: Snowflake },
  { value: "popular", label: "Popular", icon: Users }
];

export function MarketBoardView({
  rows,
  positions,
  watchlist,
  isAuthenticated,
  teams,
  team,
  sortBy,
  onTeamChange,
  onSortChange,
  onTrade,
  onWatch
}: {
  rows: PlayerMarketRow[];
  positions: Map<string, Position>;
  watchlist: Set<string>;
  isAuthenticated: boolean;
  teams: string[];
  team: string;
  sortBy: MarketSortKey;
  onTeamChange: (team: string) => void;
  onSortChange: (sort: MarketSortKey) => void;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
  onWatch: (marketId: string) => void;
}) {
  const [scanner, setScanner] = useState<MarketScannerResponse | null>(null);
  const [signalTab, setSignalTab] = useState<SignalTab>("picks");
  const openMarkets = rows.reduce((total, row) => total + row.markets.filter((market) => market.status === "OPEN").length, 0);
  const totalVolume = rows.reduce((total, row) => total + row.markets.reduce((sum, market) => sum + market.volume, 0), 0);

  useEffect(() => {
    let active = true;
    apiGet<MarketScannerResponse>(`/api/intelligence?weekId=${defaultWeekId}`)
      .then((result) => { if (active) setScanner(result); })
      .catch(() => { if (active) setScanner(null); });
    return () => { active = false; };
  }, []);

  const signalRows = useMemo(() => {
    if (!scanner) return [];
    if (signalTab === "picks") return scanner.scanner.highestConviction;
    if (signalTab === "hot") return scanner.scanner.trending;
    if (signalTab === "popular") return scanner.scanner.mostActive;
    return [...scanner.markets].filter((market) => market.status === "OPEN")
      .sort((a, b) => a.priceChange - b.priceChange || b.volume - a.volume);
  }, [scanner, signalTab]);

  const marketRows = useMemo(() => {
    const map = new Map<string, { market: ExtendedMarket; player: PlayerMarketRow["player"] }>();
    rows.forEach((row) => row.markets.forEach((market) => map.set(market.id, { market, player: row.player })));
    return map;
  }, [rows]);

  return (
    <section aria-label="Market board" className="relative left-1/2 w-[calc(100vw-24px)] max-w-[1760px] -translate-x-1/2 space-y-3 sm:w-[calc(100vw-32px)]">
      <div className="overflow-hidden rounded-md border border-rim bg-[#080C12] shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rim bg-[#111827] px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-neon" aria-hidden />
              <h2 className="font-mono text-base font-black uppercase text-frost">Market Discovery</h2>
              <span className="rounded-sm border border-neon/25 bg-neon/10 px-2 py-1 font-mono text-[9px] font-black uppercase text-neon">Week 1</span>
            </div>
            <p className="mt-1 font-mono text-[9px] font-bold uppercase text-slate-400">{openMarkets} open contracts across {rows.length} players</p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[9px] font-black uppercase">
            <span className="inline-flex items-center gap-1 text-neon"><Radio className="h-3 w-3" /> Live</span>
            <span className="text-slate-300">Volume {credits(totalVolume)}</span>
          </div>
        </div>

        <div className="grid gap-3 bg-[#0E1420] p-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide" aria-label="Board sort options">
            {BOARD_SORTS.map((option) => (
              <button key={option.value} type="button" onClick={() => onSortChange(option.value)} aria-pressed={sortBy === option.value}
                className={`min-h-9 shrink-0 rounded-sm border px-3 font-mono text-[9px] font-black uppercase transition-colors ${sortBy === option.value ? "border-neon/35 bg-neon/15 text-neon" : "border-rim bg-[#090D14] text-slate-300 hover:border-slate-500 hover:text-frost"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="board-team">Filter board by team</label>
          <select id="board-team" value={team} onChange={(event) => onTeamChange(event.target.value)}
            className="h-9 w-full rounded-sm border border-rim bg-[#090D14] px-3 font-mono text-[10px] font-black uppercase text-frost outline-none focus:border-neon/50">
            <option value="ALL">All teams</option>
            {teams.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 2xl:grid-cols-2">
          {rows.map((row) => (
            <BoardPlayerTile key={row.player.id} row={row} positions={positions}
              watched={watchlist.has(row.selectedMarket.id)} isAuthenticated={isAuthenticated}
              onTrade={onTrade} onWatch={onWatch} />
          ))}
        </div>

        <aside className="order-first overflow-hidden rounded-md border border-rim bg-[#080C12] xl:order-none xl:sticky xl:top-3" aria-label="Prediction intelligence">
          <div className="border-b border-rim bg-[#111827] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-black uppercase text-frost"><Zap className="h-3.5 w-3.5 text-amber" /> Prediction Intelligence</h3>
              <span className="font-mono text-[8px] font-black uppercase text-neon">Auto</span>
            </div>
            <p className="mt-1 font-mono text-[8px] leading-relaxed text-slate-400">Signals rank market conviction, activity, liquidity and price action. They are decision support, not guaranteed outcomes.</p>
          </div>
          <div className="grid grid-cols-4 border-b border-rim bg-[#0E1420]" role="tablist" aria-label="Prediction signal groups">
            {SIGNAL_TABS.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setSignalTab(value)} role="tab" aria-selected={signalTab === value}
                className={`grid min-h-12 place-items-center border-r border-rim px-1 font-mono text-[8px] font-black uppercase last:border-r-0 ${signalTab === value ? "bg-neon/10 text-neon" : "text-slate-400 hover:bg-panel2 hover:text-frost"}`}>
                <span className="flex flex-col items-center gap-1"><Icon className="h-3.5 w-3.5" />{label}</span>
              </button>
            ))}
          </div>
          <div className="divide-y divide-rim/70">
            {!scanner ? <SignalSkeleton /> : signalRows.slice(0, 8).map((signal, index) => {
              const tradable = marketRows.get(signal.marketId);
              return <IntelligenceRow key={`${signalTab}-${signal.marketId}`} signal={signal} rank={index + 1} tab={signalTab}
                onPick={tradable && tradable.market.status === "OPEN" ? () => onTrade(tradable.market, tradable.player, "YES", "BUY") : undefined} />;
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function BoardPlayerTile({ row, positions, watched, isAuthenticated, onTrade, onWatch }: {
  row: PlayerMarketRow;
  positions: Map<string, Position>;
  watched: boolean;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
  onWatch: (marketId: string) => void;
}) {
  const movement = row.selectedMarket.yesPrice - row.selectedMarket.openingPrice;
  const MoveIcon = movement >= 0 ? TrendingUp : TrendingDown;
  const posColor = getPositionColor(row.player.position);
  const totalVolume = row.markets.reduce((sum, market) => sum + market.volume, 0);
  const kickoff = new Date(row.selectedMarket.kickoffTime);

  return (
    <article className="overflow-hidden rounded-md border border-rim bg-[#070A0F] transition-colors hover:border-slate-500">
      <div className="h-0.5 w-full" style={{ background: posColor.text }} />
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-rim bg-[#111722] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route}><PlayerAvatar name={row.player.name} team={row.player.team} position={row.player.position} size="md" /></Link>
          <div className="min-w-0">
            <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route} className="block truncate text-base font-black leading-tight text-frost hover:text-neon">{row.player.name}</Link>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] font-black uppercase">
              <span className="rounded-sm px-1.5 py-0.5" style={{ background: posColor.bg, color: posColor.text }}>{row.player.position}</span>
              <span className="text-frost">{row.player.team}</span><span className="text-slate-400">vs {row.player.opponent || "TBD"}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => onWatch(row.selectedMarket.id)}
          className={`grid h-8 w-8 place-items-center rounded-sm ${watched ? "bg-amber/10 text-amber" : "text-slate-400 hover:bg-panel2 hover:text-frost"}`}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}>
          <Star className="h-4 w-4" fill={watched ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-rim border-b border-rim bg-[#090D14]">
        <BoardStat label="Kick" value={kickoff.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} />
        <BoardStat label="Volume" value={credits(totalVolume)} />
        <div className="flex items-center justify-center gap-1 px-2 py-2.5"><MoveIcon className={`h-3.5 w-3.5 ${movement >= 0 ? "text-neon" : "text-crimson"}`} /><span className={`font-mono text-xs font-black ${movement >= 0 ? "text-neon" : "text-crimson"}`}>{movement >= 0 ? "+" : ""}{pct(movement)}</span></div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-rim">
        {THRESHOLD_ORDER.map((threshold) => {
          const market = row.markets.find((candidate) => candidate.threshold === threshold);
          return market ? <ThresholdQuote key={threshold} market={market} player={row.player} position={positions.get(market.id)} isAuthenticated={isAuthenticated} onTrade={onTrade} />
            : <div key={threshold} className="grid min-h-[128px] place-items-center px-2 font-mono text-[9px] font-black uppercase text-slate-500">No line</div>;
        })}
      </div>
    </article>
  );
}

function BoardStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-2 py-2 text-center"><p className="font-mono text-[8px] font-black uppercase text-slate-500">{label}</p><p className="truncate font-mono text-[10px] font-black text-frost">{value}</p></div>;
}

function ThresholdQuote({ market, player, position, isAuthenticated, onTrade }: {
  market: ExtendedMarket;
  player: PlayerMarketRow["player"];
  position?: Position;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
}) {
  const hasShares = (position?.yesShares ?? 0) > 0 || (position?.noShares ?? 0) > 0;
  const sellSide: Side = (position?.yesShares ?? 0) > 0 ? "YES" : "NO";
  const isOpen = market.status === "OPEN";
  const movement = market.yesPrice - market.openingPrice;

  return (
    <div className={`min-w-0 p-2 ${hasShares ? "bg-neon/5" : ""}`}>
      <div className="flex items-center justify-between gap-1"><p className="font-mono text-[9px] font-black uppercase text-frost">{thresholdLabel(market.threshold)}</p>{!isOpen ? <Lock className="h-3 w-3 text-slate-500" aria-label={market.status} /> : <Clock className="h-3 w-3 text-neon/70" aria-label="Open market" />}</div>
      <button type="button" disabled={!isOpen} onClick={() => onTrade(market, player, "YES", "BUY")}
        className="mt-1 w-full rounded-sm border border-neon/25 bg-[#022A1D] px-2 py-2 text-left transition-colors hover:border-neon/60 hover:bg-[#073525] disabled:opacity-35"
        aria-label={`Buy YES for ${player.name} ${thresholdLabel(market.threshold)} at ${pct(market.yesPrice)}`}>
        <span className="block font-mono text-[8px] font-black uppercase text-neon/75">Yes</span><span className="block font-mono text-xl font-black leading-none text-neon">{pct(market.yesPrice)}</span>
      </button>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <button type="button" disabled={!isOpen} onClick={() => onTrade(market, player, "NO", "BUY")} className="min-h-7 rounded-sm bg-crimson/10 px-1 font-mono text-[8px] font-black text-crimson hover:bg-crimson/15 disabled:opacity-35">NO {pct(market.noPrice)}</button>
        <button type="button" disabled={!isOpen || (isAuthenticated && !hasShares)} onClick={() => onTrade(market, player, sellSide, "SELL")} className="min-h-7 rounded-sm border border-rim px-1 font-mono text-[8px] font-black text-slate-400 hover:text-frost disabled:opacity-35">SELL</button>
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[8px] font-black uppercase text-slate-400"><span className={movement >= 0 ? "text-neon" : "text-crimson"}>{movement >= 0 ? "+" : ""}{pct(movement)}</span><span>{credits(market.liquidity)}</span></div>
    </div>
  );
}

function IntelligenceRow({ signal, rank, tab, onPick }: { signal: FantasyMarketIntelligence; rank: number; tab: SignalTab; onPick?: () => void }) {
  const movementUp = signal.priceChange >= 0;
  const score = tab === "picks" ? signal.confidenceScore : tab === "popular" ? Math.min(99, Math.round(signal.trendScore)) : Math.min(99, Math.round(Math.abs(signal.priceChangePct) + signal.trendScore * 0.45));
  const rationale = signal.signals[0] ?? (tab === "cold" ? "Price cooling on recent action" : signal.bullCase);

  return (
    <div className="group grid grid-cols-[24px_1fr_auto] gap-2 px-3 py-2.5 hover:bg-[#101722]">
      <span className="grid h-6 w-6 place-items-center rounded-sm bg-panel2 font-mono text-[9px] font-black text-slate-300">{rank}</span>
      <div className="min-w-0">
        <Link href={`/markets/${signal.marketId}` as Route} className="block truncate font-mono text-[11px] font-black text-frost hover:text-neon">{signal.playerName}</Link>
        <p className="mt-0.5 truncate font-mono text-[8px] font-bold uppercase text-slate-400">{signal.team} · {thresholdLabel(signal.threshold)} · {rationale}</p>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[8px] font-black uppercase"><span className="text-amber">Signal {score}</span><span className="text-slate-500">Vol {credits(signal.volume)}</span></div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-black text-neon">{pct(signal.yesPrice)}</p>
        <p className={`font-mono text-[9px] font-black ${movementUp ? "text-neon" : "text-crimson"}`}>{movementUp ? "+" : ""}{pct(signal.priceChange)}</p>
        {onPick ? <button type="button" onClick={onPick} className="mt-1 rounded-sm border border-neon/30 bg-neon/10 px-2 py-1 font-mono text-[8px] font-black uppercase text-neon opacity-100 hover:bg-neon/20 xl:opacity-0 xl:group-hover:opacity-100">Trade</button> : null}
      </div>
    </div>
  );
}

function SignalSkeleton() {
  return <div className="space-y-1 p-3" aria-label="Loading prediction intelligence">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-sm bg-panel2/60" />)}</div>;
}
