"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, SlidersHorizontal, X, Radio } from "lucide-react";
import { MarketCard } from "@/components/market-card";
import { FirstTradeCoach } from "@/components/first-trade-coach";
import { TradeLauncher } from "@/components/trade-launcher";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { apiGet, apiPost, defaultWeekId, type PortfolioResponse } from "@/lib/client-api";
import type { Market, Player, Position, Side, Threshold, MarketStatus } from "@/lib/types";
import { TrendingUp } from "lucide-react";

type Ticket = { market: Market; player: Player; side: Side };
type SortKey = "kickoff" | "yes-asc" | "yes-desc" | "liquidity" | "volume";
type ExtMarket = Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number };
type PlayerMarketRow = { player: Player; markets: ExtMarket[]; selectedMarket: ExtMarket };

const POSITIONS: Array<{ value: Position | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "QB", label: "QB" },
  { value: "RB", label: "RB" },
  { value: "WR", label: "WR" },
  { value: "TE", label: "TE" }
];

const THRESHOLDS: Array<{ value: Threshold | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "TOP_3", label: "Top 3" },
  { value: "TOP_5", label: "Top 5" },
  { value: "TOP_10", label: "Top 10" }
];

const PLAYER_MARKET_DEFAULTS: Threshold[] = ["TOP_5", "TOP_10", "TOP_3"];
const THRESHOLD_ORDER: Threshold[] = ["TOP_3", "TOP_5", "TOP_10"];

const SORT_OPTIONS = [
  { value: "kickoff",  label: "Kickoff" },
  { value: "volume",   label: "Volume ↓" },
  { value: "yes-desc", label: "YES ↓" },
  { value: "yes-asc",  label: "YES ↑" },
  { value: "liquidity",label: "Liquidity" }
];

export default function MarketsPage() {
  const live = useLiveExchange(defaultWeekId);

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [liveMsg, setLiveMsg]     = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [ticket, setTicket]       = useState<Ticket | null>(null);
  const [showCoach, setShowCoach] = useState(false);

  const [search,      setSearch]      = useState("");
  const [position,    setPosition]    = useState<Position | "ALL">("ALL");
  const [threshold,   setThreshold]   = useState<Threshold | "ALL">("ALL");
  const [team,        setTeam]        = useState("ALL");
  const [statusFilter,setStatusFilter]= useState<MarketStatus | "ALL">("ALL");
  const [sortBy,      setSortBy]      = useState<SortKey>("kickoff");
  const [selectedMarketByPlayer, setSelectedMarketByPlayer] = useState<Record<string, Threshold>>({});

  // Portfolio and watchlist are personalized overlays. Market discovery stays public.
  useEffect(() => {
    apiGet<PortfolioResponse>("/api/portfolio")
      .then((p) => {
        setPortfolio(p);
        setIsAuthenticated(true);
        return apiGet<{ marketIds: string[] }>("/api/watchlist");
      })
      .then((wl) => setWatchlist(new Set(wl.marketIds)))
      .catch(() => {
        setPortfolio(null);
        setIsAuthenticated(false);
        setWatchlist(new Set());
      })
      .finally(() => setHasLoaded(true));
  }, []);

  useEffect(() => {
    setShowCoach(new URLSearchParams(window.location.search).get("coach") === "first-trade");
  }, []);

  // Mark loaded once SSE delivers first slate
  useEffect(() => {
    if (live.markets.length > 0) setHasLoaded(true);
  }, [live.markets.length]);

  const playerMap = useMemo(() => new Map(live.players.map((p) => [p.id, p])), [live.players]);
  const positionMap = useMemo(() => new Map((portfolio?.positions ?? []).map((p) => [p.marketId, p])), [portfolio]);
  const teams = useMemo(() => {
    const s = new Set<string>();
    for (const p of live.players) s.add(p.team);
    return Array.from(s).sort();
  }, [live.players]);

  const playerRows = useMemo<PlayerMarketRow[]>(() => {
    const q = search.trim().toLowerCase();
    const grouped = new Map<string, { player: Player; markets: ExtMarket[] }>();

    for (const market of live.markets as ExtMarket[]) {
      const player = playerMap.get(market.playerId);
      if (!player) continue;
      if (position !== "ALL" && market.position !== position) continue;
      if (team !== "ALL" && player.team !== team) continue;
      if (statusFilter !== "ALL" && market.status !== statusFilter) continue;
      if (q && !player.name.toLowerCase().includes(q)) continue;

      const existing = grouped.get(market.playerId);
      if (existing) {
        existing.markets.push(market);
      } else {
        grouped.set(market.playerId, { player, markets: [market] });
      }
    }

    return Array.from(grouped.values())
      .map(({ player, markets }) => {
        const orderedMarkets = [...markets].sort((a, b) => THRESHOLD_ORDER.indexOf(a.threshold) - THRESHOLD_ORDER.indexOf(b.threshold));
        const preferredThreshold = threshold !== "ALL" ? threshold : selectedMarketByPlayer[player.id];
        const selectedMarket =
          orderedMarkets.find((market) => market.threshold === preferredThreshold) ??
          PLAYER_MARKET_DEFAULTS.map((candidate) => orderedMarkets.find((market) => market.threshold === candidate)).find(Boolean) ??
          orderedMarkets[0];

        return selectedMarket ? { player, markets: orderedMarkets, selectedMarket } : null;
      })
      .filter((row): row is PlayerMarketRow => Boolean(row))
      .filter((row) => threshold === "ALL" || row.markets.some((market) => market.threshold === threshold))
      .sort((a, b) => {
        const marketA = a.selectedMarket;
        const marketB = b.selectedMarket;
        if (sortBy === "kickoff")  return marketA.kickoffTime.localeCompare(marketB.kickoffTime);
        if (sortBy === "yes-asc")  return marketA.yesPrice - marketB.yesPrice;
        if (sortBy === "yes-desc") return marketB.yesPrice - marketA.yesPrice;
        if (sortBy === "liquidity")return marketB.liquidity - marketA.liquidity;
        if (sortBy === "volume")   return marketB.volume - marketA.volume;
        return 0;
      });
  }, [live.markets, playerMap, position, threshold, team, statusFilter, search, sortBy, selectedMarketByPlayer]);

  async function toggleWatch(marketId: string) {
    if (!isAuthenticated) {
      setLiveMsg("Log in to add markets to your watchlist.");
      return;
    }
    const isWatched = watchlist.has(marketId);
    setWatchlist((prev) => { const n = new Set(prev); isWatched ? n.delete(marketId) : n.add(marketId); return n; });
    try {
      await apiPost(`/api/watchlist/${marketId}`, { action: isWatched ? "remove" : "add" });
    } catch {
      setWatchlist((prev) => { const n = new Set(prev); isWatched ? n.add(marketId) : n.delete(marketId); return n; });
    }
  }

  const activeFiltersCount = [
    position !== "ALL", threshold !== "ALL", team !== "ALL", statusFilter !== "ALL", search !== ""
  ].filter(Boolean).length;

  const isLoading = !hasLoaded && live.markets.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-frost flex items-center gap-2">
            Markets
            <LiveBadge isLive={live.isConnected} />
          </h1>
          <p className="text-xs font-semibold text-muted flex items-center gap-1.5 mt-0.5">
            <Radio className="h-3 w-3" aria-hidden />
            Week 1 · {playerRows.length} players · live
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden overflow-hidden rounded-xl border border-rim bg-panel sm:flex">
            <span className="bg-neon/10 px-3 py-2 text-xs font-black text-neon">Feed View</span>
            <Link href={"/markets/board" as Route} className="px-3 py-2 text-xs font-black text-muted transition-colors hover:bg-panel2 hover:text-frost">
              Board View
            </Link>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              showFilters || activeFiltersCount > 0
                ? "border-neon/40 bg-neon/10 text-neon"
                : "border-rim bg-panel text-muted hover:text-frost"
            }`}
            type="button"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[9px] font-black text-surface">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-rim bg-panel sm:hidden">
        <span className="bg-neon/10 px-3 py-2 text-center text-xs font-black text-neon">Feed View</span>
        <Link href={"/markets/board" as Route} className="px-3 py-2 text-center text-xs font-black text-muted transition-colors hover:bg-panel2 hover:text-frost">
          Board View
        </Link>
      </div>

      <FirstTradeCoach visible={showCoach} onDismiss={() => setShowCoach(false)} />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="market-search" className="sr-only">Search by player name</label>
        <input
          id="market-search"
          type="search"
          placeholder="Search player…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-rim bg-panel pl-9 pr-4 text-sm font-semibold text-frost placeholder:text-muted outline-none focus:border-neon/50 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-frost" aria-label="Clear search" type="button">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Position pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {POSITIONS.map(({ value, label }) => (
          <button key={value} onClick={() => setPosition(value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition-colors ${position === value ? "bg-neon text-surface" : "bg-panel2 text-muted hover:text-frost border border-rim"}`}
            type="button">{label}</button>
        ))}
        <div className="w-4 shrink-0" />
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="rounded-xl border border-rim bg-panel p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect id="threshold-filter" label="Threshold" value={threshold} onChange={(v) => setThreshold(v as Threshold | "ALL")} options={THRESHOLDS.map((t) => ({ value: t.value, label: t.label }))} />
            <FilterSelect id="team-filter" label="Team" value={team} onChange={setTeam} options={[{ value: "ALL", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t }))]} />
            <FilterSelect id="status-filter" label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as MarketStatus | "ALL")} options={[{ value: "ALL", label: "All statuses" }, { value: "OPEN", label: "Open" }, { value: "LOCKED", label: "Locked" }, { value: "SETTLED", label: "Settled" }]} />
            <FilterSelect id="sort-by" label="Sort" value={sortBy} onChange={(v) => setSortBy(v as SortKey)} options={SORT_OPTIONS} />
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={() => { setPosition("ALL"); setThreshold("ALL"); setTeam("ALL"); setStatusFilter("ALL"); setSearch(""); setSelectedMarketByPlayer({}); }}
              className="text-xs font-bold text-muted hover:text-crimson transition-colors flex items-center gap-1" type="button">
              <X className="h-3 w-3" aria-hidden /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading && <LoadingFeed count={6} />}
      {!isLoading && error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {!isLoading && !error && playerRows.length === 0 && (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No players found"
          description="Try adjusting your filters or search term."
          action={
            <button onClick={() => { setPosition("ALL"); setThreshold("ALL"); setTeam("ALL"); setStatusFilter("ALL"); setSearch(""); setSelectedMarketByPlayer({}); }}
              className="rounded-xl bg-neon/10 border border-neon/20 px-4 py-2 text-sm font-black text-neon hover:bg-neon/20 transition" type="button">
              Clear filters
            </button>
          }
        />
      )}

      {!isLoading && !error && playerRows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playerRows.map(({ player, markets, selectedMarket }) => {
            return (
              <MarketCard
                key={player.id}
                market={selectedMarket}
                player={player}
                onTrade={(m, side) => setTicket({ market: m, player, side })}
                onWatch={isAuthenticated ? toggleWatch : undefined}
                isWatched={watchlist.has(selectedMarket.id)}
                marketOptions={markets}
                onSelectMarket={(nextMarket) => {
                  setThreshold("ALL");
                  setSelectedMarketByPlayer((prev) => ({ ...prev, [player.id]: nextMarket.threshold }));
                }}
              />
            );
          })}
        </div>
      )}

      {ticket && (
        <TradeLauncher
          market={ticket.market}
          player={ticket.player}
          initialSide={ticket.side}
          balance={portfolio?.user.mockBalance ?? 0}
          position={positionMap.get(ticket.market.id) ?? null}
          open={Boolean(ticket)}
          showButton={false}
          onOpenChange={(nextOpen) => { if (!nextOpen) setTicket(null); }}
          onTradeComplete={() => {
            setLiveMsg("Trade confirmed.");
            void apiGet<PortfolioResponse>("/api/portfolio").then((p) => {
              setPortfolio(p);
              setIsAuthenticated(true);
            });
            window.dispatchEvent(new Event("fantasyx:data-changed"));
          }}
          isAuthenticated={isAuthenticated}
        />
      )}

      <p className="sr-only" aria-live="polite" aria-atomic>{liveMsg}</p>
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-rim bg-panel2 px-3 text-xs font-semibold text-frost outline-none focus:border-neon/50" aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
