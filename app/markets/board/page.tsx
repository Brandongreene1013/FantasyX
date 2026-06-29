"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Activity, BarChart2, Clock, Filter, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { LiveBadge } from "@/components/ui/live-badge";
import { Countdown } from "@/components/ui/countdown";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { defaultWeekId } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { FeedEvent } from "@/lib/live-types";
import type { Market, Position, Threshold } from "@/lib/types";

type ExtMarket = Market & {
  weekId: string;
  kickoffTime: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  openInterest: number;
};

type SortKey = "volume" | "gainer" | "loser" | "locking" | "oi" | "yes-asc" | "yes-desc";
type PositionFilter = Position | "ALL";
type ThresholdFilter = Threshold | "ALL";
type StatusFilter = "OPEN" | "LOCKED" | "SETTLED" | "ALL";

const SORT_OPTS: Array<{ value: SortKey; label: string; icon: React.ReactNode }> = [
  { value: "volume", label: "Volume", icon: <BarChart2 className="h-3 w-3" /> },
  { value: "gainer", label: "Gainers", icon: <TrendingUp className="h-3 w-3" /> },
  { value: "loser", label: "Losers", icon: <TrendingDown className="h-3 w-3" /> },
  { value: "locking", label: "Locking", icon: <Clock className="h-3 w-3" /> },
  { value: "oi", label: "Open Int", icon: <Activity className="h-3 w-3" /> },
  { value: "yes-desc", label: "YES high", icon: <Zap className="h-3 w-3" /> },
  { value: "yes-asc", label: "YES low", icon: <Zap className="h-3 w-3" /> }
];

const POS_OPTS: PositionFilter[] = ["ALL", "QB", "RB", "WR", "TE"];
const THR_OPTS: Array<{ v: ThresholdFilter; label: string }> = [
  { v: "ALL", label: "All" },
  { v: "TOP_3", label: "Top 3" },
  { v: "TOP_5", label: "Top 5" },
  { v: "TOP_10", label: "Top 10" }
];

function useFlashMap(markets: ExtMarket[]) {
  const prevRef = useRef<Map<string, number>>(new Map());
  const [flashes, setFlashes] = useState<Map<string, "up" | "down">>(new Map());

  useEffect(() => {
    const next = new Map<string, "up" | "down">();
    for (const market of markets) {
      const prev = prevRef.current.get(market.id);
      if (prev !== undefined && prev !== market.yesPrice) {
        next.set(market.id, market.yesPrice > prev ? "up" : "down");
      }
      prevRef.current.set(market.id, market.yesPrice);
    }
    if (next.size === 0) return;
    setFlashes(next);
    const timeout = setTimeout(() => setFlashes(new Map()), 900);
    return () => clearTimeout(timeout);
  }, [markets]);

  return flashes;
}

export default function MarketBoardPage() {
  const live = useLiveExchange(defaultWeekId);
  const markets = live.markets as ExtMarket[];
  const playerMap = useMemo(() => new Map(live.players.map((player) => [player.id, player])), [live.players]);
  const lastTradeByMarket = useMemo(() => {
    const map = new Map<string, FeedEvent>();
    for (const event of live.feed) {
      if (!map.has(event.marketId)) {
        map.set(event.marketId, event);
      }
    }
    return map;
  }, [live.feed]);

  const [sort, setSort] = useState<SortKey>("volume");
  const [posFilter, setPosFilter] = useState<PositionFilter>("ALL");
  const [thrFilter, setThrFilter] = useState<ThresholdFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const flashes = useFlashMap(markets);

  const filtered = useMemo(() => {
    let nextMarkets = markets;
    if (statusFilter !== "ALL") nextMarkets = nextMarkets.filter((market) => market.status === statusFilter);
    if (posFilter !== "ALL") nextMarkets = nextMarkets.filter((market) => market.position === posFilter);
    if (thrFilter !== "ALL") nextMarkets = nextMarkets.filter((market) => market.threshold === thrFilter);
    if (search) {
      const query = search.toLowerCase();
      nextMarkets = nextMarkets.filter((market) => {
        const player = playerMap.get(market.playerId);
        return player?.name.toLowerCase().includes(query) || player?.team.toLowerCase().includes(query);
      });
    }
    return [...nextMarkets].sort((a, b) => {
      switch (sort) {
        case "volume": return b.volume - a.volume;
        case "gainer": return (b.yesPrice - b.openingPrice) - (a.yesPrice - a.openingPrice);
        case "loser": return (a.yesPrice - a.openingPrice) - (b.yesPrice - b.openingPrice);
        case "locking": return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
        case "oi": return b.openInterest - a.openInterest;
        case "yes-desc": return b.yesPrice - a.yesPrice;
        case "yes-asc": return a.yesPrice - b.yesPrice;
        default: return 0;
      }
    });
  }, [markets, sort, posFilter, thrFilter, statusFilter, search, playerMap]);

  const isLoading = markets.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-black text-frost">
            <Activity className="h-5 w-5 text-neon" aria-hidden />
            MARKET BOARD
          </h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            NFL Week 1 - Half-PPR Rank Markets - {filtered.length} instruments
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={"/markets" as Route}
            className="rounded border border-rim bg-panel2 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-muted transition-colors hover:text-frost"
          >
            Back to Market Feed
          </Link>
          <LiveBadge isLive={live.isConnected} />
        </div>
      </div>

      <div className="rounded-lg border border-rim bg-panel2 p-3">
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="board-search" className="sr-only">Search player or team</label>
          <input
            id="board-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SEARCH PLAYER / TEAM"
            className="w-full rounded border border-rim bg-surface px-8 py-2 font-mono text-xs text-frost outline-none placeholder:text-muted/50 focus:border-neon/40"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center font-mono text-[9px] uppercase tracking-wider text-muted/60">SORT</span>
          {SORT_OPTS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors ${
                sort === value ? "border-neon/30 bg-neon/15 text-neon" : "border-rim bg-panel3 text-muted hover:text-frost"
              }`}
              type="button"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <FilterGroup label="POS">
            {POS_OPTS.map((position) => (
              <FilterButton key={position} active={posFilter === position} onClick={() => setPosFilter(position)}>
                {position}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label="THR">
            {THR_OPTS.map(({ v, label }) => (
              <FilterButton key={v} active={thrFilter === v} onClick={() => setThrFilter(v)}>
                {label}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label="STATUS">
            {(["ALL", "OPEN", "LOCKED", "SETTLED"] as StatusFilter[]).map((status) => (
              <FilterButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {status}
              </FilterButton>
            ))}
          </FilterGroup>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-rim bg-panel">
        <div className="hidden grid-cols-[minmax(220px,1.4fr)_76px_76px_86px_96px_96px_120px_120px_96px] gap-3 border-b border-rim/60 bg-panel2 px-3 py-2 xl:grid">
          {["Instrument", "YES price", "NO price", "Change %", "Volume", "Open interest", "Last trade", "Kickoff countdown", "Status"].map((header) => (
            <span key={header} className="text-right font-mono text-[9px] font-bold uppercase tracking-widest text-muted/60 first:text-left">
              {header}
            </span>
          ))}
        </div>

        {isLoading && Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse border-b border-rim/30 bg-panel2/30" />
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center font-mono text-xs text-muted">NO MARKETS MATCH FILTERS</div>
        )}

        {!isLoading && filtered.map((market) => {
          const player = playerMap.get(market.playerId);
          if (!player) return null;
          return (
            <BoardRow
              key={market.id}
              market={market}
              playerName={player.name}
              team={player.team}
              lastTrade={lastTradeByMarket.get(market.id) ?? null}
              flash={flashes.get(market.id) ?? null}
              isSelected={selected === market.id}
              onSelect={() => setSelected(market.id === selected ? null : market.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="mr-1 self-center font-mono text-[9px] uppercase tracking-wider text-muted/60">{label}</span>
      {children}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors ${
        active ? "border-neon/30 bg-neon/15 text-neon" : "border-rim bg-panel3 text-muted hover:text-frost"
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

function BoardRow({
  market,
  playerName,
  team,
  lastTrade,
  flash,
  isSelected,
  onSelect
}: {
  market: ExtMarket;
  playerName: string;
  team: string;
  lastTrade: FeedEvent | null;
  flash: "up" | "down" | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const changePct = market.openingPrice > 0 ? (market.yesPrice - market.openingPrice) / market.openingPrice : 0;
  const changeTone = changePct > 0 ? "text-neon" : changePct < 0 ? "text-crimson" : "text-muted";
  const rowTone =
    isSelected ? "bg-neon/8 border-l-2 border-l-neon" :
    flash === "up" ? "animate-flash-up" :
    flash === "down" ? "animate-flash-down" :
    "hover:bg-panel2";

  return (
    <Link
      href={`/markets/${market.id}` as Route}
      onClick={onSelect}
      className={`grid gap-2 border-b border-rim/30 px-3 py-2 transition-colors last:border-b-0 xl:grid-cols-[minmax(220px,1.4fr)_76px_76px_86px_96px_96px_120px_120px_96px] xl:items-center xl:gap-3 ${rowTone}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="truncate font-mono text-xs font-black text-frost">{playerName}</span>
          <span className="font-mono text-[9px] font-bold text-amber">{market.position}</span>
          <span className="font-mono text-[9px] text-muted">{team}</span>
        </div>
        <div className="font-mono text-[9px] text-muted">{thresholdLabel(market.threshold)}</div>
      </div>

      <Metric label="YES price" value={pct(market.yesPrice)} tone="text-neon" />
      <Metric label="NO price" value={pct(market.noPrice)} tone="text-crimson" />
      <Metric label="Change %" value={`${changePct >= 0 ? "+" : ""}${(changePct * 100).toFixed(1)}%`} tone={changeTone} />
      <Metric label="Volume" value={credits(market.volume)} />
      <Metric label="Open interest" value={market.openInterest.toFixed(1)} />
      <Metric
        label="Last trade"
        value={lastTrade ? `${lastTrade.action} ${lastTrade.side} ${pct(lastTrade.priceAfter)}` : "-"}
        tone={lastTrade?.side === "YES" ? "text-neon" : lastTrade?.side === "NO" ? "text-crimson" : "text-muted"}
      />
      <div className="xl:text-right">
        <span className="block font-mono text-[9px] text-muted/60 xl:hidden">Kickoff countdown</span>
        <Countdown kickoffTime={market.kickoffTime} status={market.status} className="font-mono text-[10px]" />
      </div>
      <Metric label="Status" value={market.status} tone={market.status === "OPEN" ? "text-neon" : market.status === "LOCKED" ? "text-amber" : "text-muted"} />
    </Link>
  );
}

function Metric({ label, value, tone = "text-frost" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 xl:block xl:text-right">
      <span className="font-mono text-[9px] text-muted/60 xl:hidden">{label}</span>
      <span className={`font-mono text-[10px] font-black tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
