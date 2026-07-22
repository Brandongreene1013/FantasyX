"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Radio, Search, SlidersHorizontal, TableProperties, TrendingUp, X } from "lucide-react";
import { FirstTradeCoach } from "@/components/first-trade-coach";
import { MarketCard } from "@/components/market-card";
import { MarketBoardView } from "@/components/markets/market-board-view";
import { TradeLauncher } from "@/components/trade-launcher";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { apiGet, apiPost, defaultWeekId, type PortfolioResponse } from "@/lib/client-api";
import {
  MARKET_VIEW_STORAGE_KEY,
  THRESHOLD_ORDER,
  marketsViewUrl,
  resolveMarketView,
  type ExtendedMarket,
  type MarketSortKey,
  type MarketView,
  type PlayerMarketRow,
  type TradeAction
} from "@/lib/market-view";
import type { MarketStatus, Player, Position, Side, Threshold } from "@/lib/types";

type Ticket = { market: ExtendedMarket; player: Player; side: Side; action: TradeAction };

const POSITIONS: Array<{ value: Position | "ALL"; label: string }> = [
  { value: "ALL", label: "All" }, { value: "QB", label: "QB" }, { value: "RB", label: "RB" },
  { value: "WR", label: "WR" }, { value: "TE", label: "TE" }
];
const THRESHOLDS: Array<{ value: Threshold | "ALL"; label: string }> = [
  { value: "ALL", label: "All" }, { value: "TOP_3", label: "Top 3" },
  { value: "TOP_5", label: "Top 5" }, { value: "TOP_10", label: "Top 10" }
];
const PLAYER_MARKET_DEFAULTS: Threshold[] = ["TOP_5", "TOP_10", "TOP_3"];
const SORT_OPTIONS = [
  { value: "popular", label: "Popular" }, { value: "gainers", label: "Hot movers" },
  { value: "losers", label: "Cold movers" }, { value: "volume", label: "Volume" },
  { value: "yes-desc", label: "YES high" }, { value: "yes-asc", label: "YES low" },
  { value: "liquidity", label: "Liquidity" }, { value: "kickoff", label: "Kickoff" },
  { value: "team", label: "Team" }, { value: "alpha", label: "Player A-Z" }
];

export default function MarketsPage() {
  const live = useLiveExchange(defaultWeekId);
  const [view, setView] = useState<MarketView>("market");
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [threshold, setThreshold] = useState<Threshold | "ALL">("ALL");
  const [team, setTeam] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<MarketStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<MarketSortKey>("popular");
  const [selectedMarketByPlayer, setSelectedMarketByPlayer] = useState<Record<string, Threshold>>({});

  const loadPersonalization = useCallback(async () => {
    try {
      const nextPortfolio = await apiGet<PortfolioResponse>("/api/portfolio");
      setPortfolio(nextPortfolio);
      setIsAuthenticated(true);
      const nextWatchlist = await apiGet<{ marketIds: string[] }>("/api/watchlist").catch(() => ({ marketIds: [] }));
      setWatchlist(new Set(nextWatchlist.marketIds));
    } catch {
      setPortfolio(null);
      setIsAuthenticated(false);
      setWatchlist(new Set());
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => { void loadPersonalization(); }, [loadPersonalization]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextView = resolveMarketView(params.get("view"), window.localStorage.getItem(MARKET_VIEW_STORAGE_KEY));
    setView(nextView);
    window.localStorage.setItem(MARKET_VIEW_STORAGE_KEY, nextView);
    setShowCoach(params.get("coach") === "first-trade");
  }, []);
  useEffect(() => { if (live.markets.length > 0) setHasLoaded(true); }, [live.markets.length]);

  const playerMap = useMemo(() => new Map(live.players.map((player) => [player.id, player])), [live.players]);
  const positionMap = useMemo(() => new Map((portfolio?.positions ?? []).map((item) => [item.marketId, item])), [portfolio]);
  const teams = useMemo(() => Array.from(new Set(live.players.map((player) => player.team))).sort(), [live.players]);

  const playerRows = useMemo<PlayerMarketRow[]>(() => {
    const query = search.trim().toLowerCase();
    const grouped = new Map<string, { player: Player; markets: ExtendedMarket[] }>();
    for (const market of live.markets as ExtendedMarket[]) {
      const player = playerMap.get(market.playerId);
      if (!player) continue;
      if (position !== "ALL" && market.position !== position) continue;
      if (team !== "ALL" && player.team !== team) continue;
      if (statusFilter !== "ALL" && market.status !== statusFilter) continue;
      if (query && !`${player.name} ${player.team} ${player.opponent}`.toLowerCase().includes(query)) continue;
      const existing = grouped.get(market.playerId);
      if (existing) existing.markets.push(market);
      else grouped.set(market.playerId, { player, markets: [market] });
    }

    return Array.from(grouped.values()).map(({ player, markets }) => {
      const orderedMarkets = [...markets].sort((a, b) => THRESHOLD_ORDER.indexOf(a.threshold) - THRESHOLD_ORDER.indexOf(b.threshold));
      const preferred = threshold !== "ALL" ? threshold : selectedMarketByPlayer[player.id];
      const selectedMarket = orderedMarkets.find((market) => market.threshold === preferred)
        ?? PLAYER_MARKET_DEFAULTS.map((candidate) => orderedMarkets.find((market) => market.threshold === candidate)).find(Boolean)
        ?? orderedMarkets[0];
      return selectedMarket ? { player, markets: orderedMarkets, selectedMarket } : null;
    }).filter((row): row is PlayerMarketRow => Boolean(row))
      .filter((row) => threshold === "ALL" || row.markets.some((market) => market.threshold === threshold))
      .sort((a, b) => comparePlayerRows(a, b, sortBy));
  }, [live.markets, playerMap, position, search, selectedMarketByPlayer, sortBy, statusFilter, team, threshold]);

  function changeView(nextView: MarketView) {
    setView(nextView);
    window.localStorage.setItem(MARKET_VIEW_STORAGE_KEY, nextView);
    window.history.replaceState(window.history.state, "", marketsViewUrl(nextView, window.location.search));
    setLiveMsg(`${nextView === "board" ? "Board" : "Market"} view selected.`);
  }

  async function toggleWatch(marketId: string) {
    if (!isAuthenticated) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const watched = watchlist.has(marketId);
    setWatchlist((previous) => updateSet(previous, marketId, !watched));
    try {
      await apiPost(`/api/watchlist/${marketId}`, { action: watched ? "remove" : "add" });
    } catch {
      setWatchlist((previous) => updateSet(previous, marketId, watched));
    }
  }

  function clearFilters() {
    setPosition("ALL"); setThreshold("ALL"); setTeam("ALL"); setStatusFilter("ALL"); setSearch(""); setSelectedMarketByPlayer({});
  }

  const activeFiltersCount = [position !== "ALL", threshold !== "ALL", team !== "ALL", statusFilter !== "ALL", search !== ""].filter(Boolean).length;
  const isLoading = !hasLoaded && live.markets.length === 0;
  const returnTo = typeof window === "undefined" ? "/markets" : `${window.location.pathname}${window.location.search}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-frost">Markets <LiveBadge isLive={live.isConnected} /></h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted"><Radio className="h-3 w-3" aria-hidden />Week 1 · {playerRows.length} players</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-lg border border-rim bg-panel sm:flex-none" role="group" aria-label="Market presentation">
            <ViewButton active={view === "board"} onClick={() => changeView("board")} icon={<TableProperties className="h-3.5 w-3.5" />}>Board</ViewButton>
            <ViewButton active={view === "market"} onClick={() => changeView("market")} icon={<LayoutGrid className="h-3.5 w-3.5" />}>Market</ViewButton>
          </div>
          <button onClick={() => setShowFilters((value) => !value)} type="button"
            className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold ${showFilters || activeFiltersCount ? "border-neon/40 bg-neon/10 text-neon" : "border-rim bg-panel text-muted hover:text-frost"}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </button>
        </div>
      </div>

      <FirstTradeCoach visible={showCoach} onDismiss={() => setShowCoach(false)} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="market-search" className="sr-only">Search players, teams, or opponents</label>
        <input id="market-search" type="search" placeholder="Search player, team, or opponent" value={search} onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full rounded-lg border border-rim bg-panel pl-9 pr-10 text-sm font-semibold text-frost outline-none placeholder:text-muted focus:border-neon/50" />
        {search ? <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted hover:text-frost" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Position filters">
        {POSITIONS.map(({ value, label }) => <button key={value} type="button" onClick={() => setPosition(value)} aria-pressed={position === value}
          className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-black ${position === value ? "bg-neon text-surface" : "border border-rim bg-panel2 text-muted hover:text-frost"}`}>{label}</button>)}
      </div>

      {showFilters ? (
        <div className="space-y-3 rounded-lg border border-rim bg-panel p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FilterSelect label="Threshold" value={threshold} onChange={(value) => setThreshold(value as Threshold | "ALL")} options={THRESHOLDS.map(({ value, label }) => ({ value, label }))} />
            <FilterSelect label="Team" value={team} onChange={setTeam} options={[{ value: "ALL", label: "All teams" }, ...teams.map((value) => ({ value, label: value }))]} />
            <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as MarketStatus | "ALL")} options={[{ value: "ALL", label: "All statuses" }, { value: "OPEN", label: "Open" }, { value: "LOCKED", label: "Locked" }, { value: "SETTLED", label: "Settled" }]} />
            <FilterSelect label="Sort" value={sortBy} onChange={(value) => setSortBy(value as MarketSortKey)} options={SORT_OPTIONS} />
          </div>
          {activeFiltersCount ? <button type="button" onClick={clearFilters} className="flex min-h-9 items-center gap-1 text-xs font-bold text-muted hover:text-crimson"><X className="h-3 w-3" />Clear filters</button> : null}
        </div>
      ) : null}

      {isLoading ? <LoadingFeed count={6} /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => window.location.reload()} /> : null}
      {!isLoading && !error && playerRows.length === 0 ? <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No players found" description="Try adjusting your filters or search." action={<button type="button" onClick={clearFilters} className="rounded-lg border border-neon/20 bg-neon/10 px-4 py-2 text-sm font-black text-neon">Clear filters</button>} /> : null}

      {!isLoading && !error && playerRows.length > 0 && view === "board" ? (
        <MarketBoardView rows={playerRows} positions={positionMap} watchlist={watchlist} isAuthenticated={isAuthenticated}
          teams={teams} team={team} sortBy={sortBy} onTeamChange={setTeam} onSortChange={setSortBy}
          onTrade={(market, player, side, action) => setTicket({ market, player, side, action })} onWatch={(marketId) => void toggleWatch(marketId)} />
      ) : null}

      {!isLoading && !error && playerRows.length > 0 && view === "market" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playerRows.map(({ player, markets, selectedMarket }) => (
            <MarketCard key={player.id} market={selectedMarket} player={player}
              onTrade={(market, side, action) => setTicket({ market: market as ExtendedMarket, player, side, action })}
              onWatch={(marketId) => void toggleWatch(marketId)} isWatched={watchlist.has(selectedMarket.id)}
              marketOptions={markets} position={positionMap.get(selectedMarket.id)} isAuthenticated={isAuthenticated}
              onSelectMarket={(nextMarket) => { setThreshold("ALL"); setSelectedMarketByPlayer((previous) => ({ ...previous, [player.id]: nextMarket.threshold })); }} />
          ))}
        </div>
      ) : null}

      {ticket ? <TradeLauncher market={ticket.market} player={ticket.player} initialSide={ticket.side} initialAction={ticket.action}
        balance={portfolio?.user.mockBalance ?? 0} position={positionMap.get(ticket.market.id) ?? null} open showButton={false}
        onOpenChange={(open) => { if (!open) setTicket(null); }} onTradeComplete={() => { setLiveMsg("Trade confirmed."); void loadPersonalization(); }}
        isAuthenticated={isAuthenticated} returnTo={returnTo} /> : null}
      <p className="sr-only" aria-live="polite" aria-atomic>{liveMsg}</p>
    </div>
  );
}

function comparePlayerRows(a: PlayerMarketRow, b: PlayerMarketRow, sort: MarketSortKey) {
  if (sort === "team") return a.player.team.localeCompare(b.player.team) || a.player.name.localeCompare(b.player.name);
  if (sort === "alpha") return a.player.name.localeCompare(b.player.name);
  return compareMarkets(a.selectedMarket, b.selectedMarket, sort);
}

function compareMarkets(a: ExtendedMarket, b: ExtendedMarket, sort: MarketSortKey) {
  const movementA = a.yesPrice - a.openingPrice;
  const movementB = b.yesPrice - b.openingPrice;
  if (sort === "popular") return popularityScore(b) - popularityScore(a);
  if (sort === "gainers") return movementB - movementA || b.volume - a.volume;
  if (sort === "losers") return movementA - movementB || b.volume - a.volume;
  if (sort === "kickoff") return a.kickoffTime.localeCompare(b.kickoffTime);
  if (sort === "yes-asc") return a.yesPrice - b.yesPrice;
  if (sort === "yes-desc") return b.yesPrice - a.yesPrice;
  if (sort === "liquidity") return b.liquidity - a.liquidity;
  return b.volume - a.volume;
}

function popularityScore(market: ExtendedMarket) {
  return market.volume + market.openInterest * 12 + market.liquidity * 0.08 + Math.abs(market.yesPrice - market.openingPrice) * 2500;
}

function updateSet(previous: Set<string>, value: string, include: boolean) {
  const next = new Set(previous);
  if (include) next.add(value); else next.delete(value);
  return next;
}

function ViewButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-black ${active ? "bg-neon/10 text-neon" : "text-muted hover:bg-panel2 hover:text-frost"}`}>{icon}{children}</button>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="text-[10px] font-black uppercase text-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-rim bg-panel2 px-3 text-xs font-semibold normal-case text-frost outline-none focus:border-neon/50">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
