"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  LineChart,
  ListFilter,
  RotateCcw,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";
import { FirstTradeCoach } from "@/components/first-trade-coach";
import { TradeModal } from "@/components/trade-modal";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { apiGet, apiPost, defaultWeekId, type MarketDiscoveryResponse, type PortfolioResponse } from "@/lib/client-api";
import { credits, money, thresholdLabel } from "@/lib/format";
import { getPositionColor } from "@/lib/team-colors";
import type { Market, Player, Position, Side } from "@/lib/types";

type DiscoveryMarket = MarketDiscoveryResponse["markets"][number];
type DiscoverySort = MarketDiscoveryResponse["query"]["sort"];
type MarketType = NonNullable<MarketDiscoveryResponse["query"]["marketType"]>;
type StatusFilter = NonNullable<MarketDiscoveryResponse["query"]["status"]>;
type ViewKey = "all" | "trending" | "movers" | "QB" | "RB" | "WR" | "TE" | "watchlist";
type Ticket = { market: MarketForTrade; player: Player; side: Side };
type MarketForTrade = Market & {
  weekId: string;
  kickoffTime: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  openInterest: number;
};
type MarketEventGroup = {
  id: string;
  player: DiscoveryMarket["player"];
  markets: DiscoveryMarket[];
  volume: number;
  liquidity: number;
  openInterest: number;
  tradeCount: number;
  watchCount: number;
  bestPrice: number;
  biggestMove: number;
  kickoffTime: string;
  isWatchlisted: boolean;
};

const VIEW_OPTIONS: Array<{ value: ViewKey; label: string; icon: React.ReactNode }> = [
  { value: "all", label: "All Markets", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: "trending", label: "Trending", icon: <Activity className="h-3.5 w-3.5" /> },
  { value: "movers", label: "Top Movers", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: "QB", label: "QB", icon: <span className="text-[10px] font-black">QB</span> },
  { value: "RB", label: "RB", icon: <span className="text-[10px] font-black">RB</span> },
  { value: "WR", label: "WR", icon: <span className="text-[10px] font-black">WR</span> },
  { value: "TE", label: "TE", icon: <span className="text-[10px] font-black">TE</span> },
  { value: "watchlist", label: "Watchlist", icon: <Star className="h-3.5 w-3.5" /> }
];

const SORT_OPTIONS: Array<{ value: DiscoverySort; label: string }> = [
  { value: "popular", label: "Popular" },
  { value: "price-desc", label: "Price high to low" },
  { value: "price-asc", label: "Price low to high" },
  { value: "gainers", label: "Biggest gainers" },
  { value: "losers", label: "Biggest losers" },
  { value: "updated", label: "Recently updated" },
  { value: "alpha", label: "Alphabetical" }
];

const MARKET_TYPE_OPTIONS: Array<{ value: MarketType | "ALL"; label: string }> = [
  { value: "ALL", label: "All markets" },
  { value: "TOP_3", label: "Top 3" },
  { value: "TOP_5", label: "Top 5" },
  { value: "TOP_10", label: "Top 10" }
];

const STATUS_OPTIONS: Array<{ value: StatusFilter | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "LOCKED", label: "Locked" },
  { value: "SETTLED", label: "Settled" },
  { value: "VOID", label: "Void" }
];

export default function MarketsPage() {
  return (
    <Suspense fallback={<LoadingFeed count={8} />}>
      <MarketsDiscovery />
    </Suspense>
  );
}

function MarketsDiscovery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<MarketDiscoveryResponse | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [showCoach, setShowCoach] = useState(false);

  const query = useMemo(() => queryFromParams(searchParams), [searchParams]);
  const apiUrl = useMemo(() => `/api/markets/discovery?${query.toString()}`, [query]);

  const replaceParams = useCallback((mutator: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutator(next);
    next.set("weekId", defaultWeekId);
    next.set("page", "1");
    const nextString = next.toString();
    router.replace((nextString ? `${pathname}?${nextString}` : pathname) as Route, { scroll: false });
  }, [pathname, router, searchParams]);

  const updateParam = useCallback((key: string, value: string | null) => {
    replaceParams((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
  }, [replaceParams]);

  const resetFilters = useCallback(() => {
    router.replace(`${pathname}?weekId=${defaultWeekId}&sort=popular&limit=100` as Route, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    setSearchDraft(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setShowCoach(searchParams.get("coach") === "first-trade");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(apiUrl, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as unknown;
        if (!response.ok) {
          throw new Error(isErrorPayload(payload) ? payload.error : "Could not load market discovery");
        }
        return payload as MarketDiscoveryResponse;
      })
      .then((nextData) => setData(nextData))
      .catch((nextError) => {
        if (nextError instanceof DOMException && nextError.name === "AbortError") return;
        setError(nextError instanceof Error ? nextError.message : "Could not load market discovery");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [apiUrl]);

  useEffect(() => {
    apiGet<PortfolioResponse>("/api/portfolio")
      .then(setPortfolio)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if ((searchParams.get("q") ?? "") === searchDraft.trim()) return;
      updateParam("q", searchDraft.trim() || null);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchDraft, searchParams, updateParam]);

  const activeView = getActiveView(searchParams);
  const activeFilters = [
    searchParams.get("q"),
    searchParams.get("position"),
    searchParams.get("team"),
    searchParams.get("marketType"),
    searchParams.get("status"),
    searchParams.get("watchlistOnly")
  ].filter(Boolean).length;

  function setView(view: ViewKey) {
    replaceParams((next) => {
      next.delete("position");
      next.delete("watchlistOnly");
      if (view === "trending") next.set("sort", "popular");
      if (view === "movers") next.set("sort", "gainers");
      if (["QB", "RB", "WR", "TE"].includes(view)) next.set("position", view);
      if (view === "watchlist") next.set("watchlistOnly", "true");
    });
  }

  async function toggleWatch(marketId: string) {
    const market = data?.markets.find((item) => item.id === marketId);
    if (!market) return;
    const action = market.isWatchlisted ? "remove" : "add";

    setData((current) => current ? {
      ...current,
      markets: current.markets.map((item) =>
        item.id === marketId
          ? { ...item, isWatchlisted: !item.isWatchlisted, watchCount: Math.max(0, item.watchCount + (item.isWatchlisted ? -1 : 1)) }
          : item
      )
    } : current);

    try {
      await apiPost(`/api/watchlist/${marketId}`, { action });
    } catch {
      setData((current) => current ? {
        ...current,
        markets: current.markets.map((item) =>
          item.id === marketId
            ? { ...item, isWatchlisted: market.isWatchlisted, watchCount: market.watchCount }
            : item
        )
      } : current);
    }
  }

  const marketGroups = useMemo(() => groupMarketsByPlayer(data?.markets ?? []), [data?.markets]);
  const hasMarkets = marketGroups.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-black uppercase tracking-wide text-frost">Market Discovery</h1>
            <span className="rounded border border-neon/20 bg-neon/10 px-2 py-1 font-mono text-[10px] font-black uppercase text-neon">
              Week 1
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            {marketGroups.length} events · {data?.pagination.total ?? 0} contracts · {data?.filters.positions.length ?? 0} positions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={"/markets/board" as Route}
            className="rounded border border-rim bg-panel2 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-wider text-muted transition-colors hover:text-frost"
          >
            Board View
          </Link>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded border border-rim bg-panel2 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-wider text-muted transition-colors hover:text-frost"
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
        </div>
      </div>

      <FirstTradeCoach visible={showCoach} onDismiss={() => setShowCoach(false)} />

      <section className="rounded-lg border border-rim bg-panel p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_170px_150px_140px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="market-search" className="sr-only">Search markets</label>
            <input
              id="market-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              className="h-10 w-full rounded border border-rim bg-surface pl-9 pr-9 font-mono text-xs font-bold text-frost outline-none placeholder:text-muted/50 focus:border-neon/50"
              placeholder="SEARCH PLAYER / TEAM / POSITION"
              type="search"
            />
            {searchDraft && (
              <button
                onClick={() => setSearchDraft("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-frost"
                aria-label="Clear search"
                type="button"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <SelectControl
            label="Sort"
            value={searchParams.get("sort") ?? "popular"}
            onChange={(value) => updateParam("sort", value)}
            options={SORT_OPTIONS}
          />
          <SelectControl
            label="Team"
            value={searchParams.get("team") ?? "ALL"}
            onChange={(value) => updateParam("team", value === "ALL" ? null : value)}
            options={[{ value: "ALL", label: "All teams" }, ...(data?.filters.teams ?? []).map((team) => ({ value: team, label: team }))]}
          />
          <SelectControl
            label="Market"
            value={searchParams.get("marketType") ?? "ALL"}
            onChange={(value) => updateParam("marketType", value === "ALL" ? null : value)}
            options={MARKET_TYPE_OPTIONS}
          />
          <SelectControl
            label="Status"
            value={searchParams.get("status") ?? "ALL"}
            onChange={(value) => updateParam("status", value === "ALL" ? null : value)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {VIEW_OPTIONS.map((view) => (
            <button
              key={view.value}
              onClick={() => setView(view.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wide transition-colors ${
                activeView === view.value
                  ? "border-neon/30 bg-neon/15 text-neon"
                  : "border-rim bg-panel2 text-muted hover:text-frost"
              }`}
              type="button"
            >
              {view.icon}
              {view.label}
            </button>
          ))}
        </div>

        {activeFilters > 0 && (
          <button
            onClick={resetFilters}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted transition-colors hover:text-crimson"
            type="button"
          >
            <ListFilter className="h-3.5 w-3.5" aria-hidden />
            Clear {activeFilters} active filters
          </button>
        )}
      </section>

      {isLoading && <LoadingFeed count={8} />}

      {!isLoading && error && (
        <ErrorState message={error} onRetry={() => router.refresh()} />
      )}

      {!isLoading && !error && !hasMarkets && (
        <EmptyState
          icon={<LineChart className="h-6 w-6" />}
          title={searchParams.get("watchlistOnly") === "true" ? "Your watchlist is empty" : "No markets found"}
          description={searchParams.get("watchlistOnly") === "true" ? "Add players from all markets to build a focused board." : "Try a different player, team, position, or status filter."}
          action={
            <button
              onClick={resetFilters}
              className="rounded border border-neon/30 bg-neon/10 px-4 py-2 text-sm font-black text-neon transition-colors hover:bg-neon/15"
              type="button"
            >
              Show all markets
            </button>
          }
        />
      )}

      {!isLoading && !error && hasMarkets && (
        <section className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            {marketGroups.map((group) => (
              <MarketEventCard
                key={group.id}
                group={group}
                onTrade={(market, side) => setTicket({ market: toTradeMarket(market), player: toPlayer(market), side })}
                onWatch={(marketId) => toggleWatch(marketId)}
              />
            ))}
          </div>
        </section>
      )}

      {ticket && (
        <TradeModal
          market={ticket.market}
          player={ticket.player}
          side={ticket.side}
          balance={portfolio?.user.mockBalance ?? 0}
          onTradeComplete={() => setTicket(null)}
          onClose={() => setTicket(null)}
        />
      )}
    </div>
  );
}

function MarketEventCard({
  group,
  onTrade,
  onWatch
}: {
  group: MarketEventGroup;
  onTrade: (market: DiscoveryMarket, side: Side) => void;
  onWatch: (marketId: string) => void;
}) {
  const player = group.player;
  const posColor = getPositionColor(player.position);
  const changeTone = group.biggestMove > 0 ? "text-neon" : group.biggestMove < 0 ? "text-crimson" : "text-muted";
  const sortedMarkets = orderMarketsByType(group.markets);
  const primaryMarket = sortedMarkets[0];

  return (
    <article className="overflow-hidden rounded-lg border border-rim bg-panel transition-colors hover:border-rim/80 hover:bg-panel2">
      <div className="flex items-start justify-between gap-3 border-b border-rim/60 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={player.name} team={player.team} position={player.position} size="md" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-black"
                style={{ background: posColor.bg, color: posColor.text }}
              >
                {player.position}
              </span>
              <span className="font-mono text-[10px] font-bold text-muted">{player.team}</span>
              <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-black ${changeTone}`}>
                {group.biggestMove > 0 ? <ArrowUp className="h-3 w-3" /> : group.biggestMove < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                {group.biggestMove >= 0 ? "+" : ""}{money(group.biggestMove)}
              </span>
            </div>
            <Link href={`/players/${player.id}` as Route} className="mt-0.5 block truncate text-base font-black text-frost transition-colors hover:text-neon">
              {player.name}
            </Link>
            <p className="truncate text-xs font-semibold text-muted">
              Will {player.name} finish as a top fantasy {player.position} in Week 1?
            </p>
          </div>
        </div>

        {primaryMarket && (
          <button
            onClick={() => onWatch(primaryMarket.id)}
            className={`rounded border p-2 transition-colors ${
              group.isWatchlisted
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-rim bg-panel3 text-muted hover:text-frost"
            }`}
            aria-label={group.isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
            type="button"
          >
            <Star className="h-4 w-4" fill={group.isWatchlisted ? "currentColor" : "none"} aria-hidden />
          </button>
        )}
      </div>

      <div className="grid gap-2 p-3">
        {sortedMarkets.map((market) => {
          const isOpen = market.status === "OPEN";
          const marketChangeTone = market.change > 0 ? "text-neon" : market.change < 0 ? "text-crimson" : "text-muted";

          return (
            <div
              key={market.id}
              className="grid gap-2 rounded border border-rim/70 bg-surface p-2 sm:grid-cols-[minmax(120px,1fr)_86px_86px_132px] sm:items-center"
            >
              <Link href={`/markets/${market.id}` as Route} className="min-w-0">
                <div className="truncate text-sm font-black text-frost">{market.marketTypeLabel}</div>
                <div className={`flex items-center gap-1 font-mono text-[10px] font-black ${marketChangeTone}`}>
                  {market.change > 0 ? <ArrowUp className="h-3 w-3" /> : market.change < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                  {market.change >= 0 ? "+" : ""}{money(market.change)} · {(market.changePercent * 100).toFixed(1)}%
                </div>
              </Link>

              <OutcomePrice label="YES" value={market.priceLabel} tone="text-neon" />
              <OutcomePrice label="NO" value={market.noPriceLabel} tone="text-crimson" />

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onTrade(market, "YES")}
                  disabled={!isOpen}
                  className="rounded border border-neon/25 bg-neon/10 px-2 py-2 font-mono text-[10px] font-black text-neon transition-colors hover:bg-neon/15 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                >
                  Buy Yes
                </button>
                <button
                  onClick={() => onTrade(market, "NO")}
                  disabled={!isOpen}
                  className="rounded border border-crimson/25 bg-crimson/10 px-2 py-2 font-mono text-[10px] font-black text-crimson transition-colors hover:bg-crimson/15 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                >
                  Buy No
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-rim/60 bg-panel2 px-3 py-2">
        <CardStat label="Volume" value={credits(group.volume)} />
        <CardStat label="Liquidity" value={credits(group.liquidity)} />
        <CardStat label="Open Int" value={credits(group.openInterest)} />
        <CardStat label="Trades" value={String(group.tradeCount)} />
      </div>
    </article>
  );
}

function OutcomePrice({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-panel3 px-2 py-1.5 sm:block sm:text-right">
      <span className="font-mono text-[9px] font-black uppercase tracking-wider text-muted/70">{label}</span>
      <span className={`block font-mono text-sm font-black tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-mono text-[8px] font-black uppercase tracking-widest text-muted/60">{label}</div>
      <div className="truncate font-mono text-[10px] font-black tabular-nums text-frost">{value}</div>
    </div>
  );
}

function groupMarketsByPlayer(markets: DiscoveryMarket[]): MarketEventGroup[] {
  const groups = new Map<string, MarketEventGroup>();

  for (const market of markets) {
    const existing = groups.get(market.player.id);
    if (!existing) {
      groups.set(market.player.id, {
        id: market.player.id,
        player: market.player,
        markets: [market],
        volume: market.volume,
        liquidity: market.liquidity,
        openInterest: market.openInterest,
        tradeCount: market.tradeCount,
        watchCount: market.watchCount,
        bestPrice: market.price,
        biggestMove: market.change,
        kickoffTime: market.kickoffTime,
        isWatchlisted: market.isWatchlisted
      });
      continue;
    }

    existing.markets.push(market);
    existing.volume += market.volume;
    existing.liquidity += market.liquidity;
    existing.openInterest += market.openInterest;
    existing.tradeCount += market.tradeCount;
    existing.watchCount += market.watchCount;
    existing.bestPrice = Math.max(existing.bestPrice, market.price);
    existing.biggestMove = Math.abs(market.change) > Math.abs(existing.biggestMove) ? market.change : existing.biggestMove;
    existing.isWatchlisted = existing.isWatchlisted || market.isWatchlisted;
  }

  return Array.from(groups.values()).sort((a, b) => {
    const activity = b.volume + b.openInterest * 10 + b.tradeCount * 50 + b.watchCount * 25 - (a.volume + a.openInterest * 10 + a.tradeCount * 50 + a.watchCount * 25);
    return activity || b.bestPrice - a.bestPrice || a.player.name.localeCompare(b.player.name);
  });
}

function orderMarketsByType(markets: DiscoveryMarket[]) {
  const order: Record<string, number> = { TOP_3: 0, TOP_5: 1, TOP_10: 2 };
  return [...markets].sort((a, b) => order[a.marketType] - order[b.marketType]);
}

function SelectControl({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-rim bg-surface px-3 font-mono text-[11px] font-bold uppercase tracking-wide text-frost outline-none focus:border-neon/50"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function queryFromParams(searchParams: URLSearchParams) {
  const query = new URLSearchParams();
  query.set("weekId", searchParams.get("weekId") ?? defaultWeekId);
  query.set("limit", searchParams.get("limit") ?? "100");
  query.set("page", searchParams.get("page") ?? "1");
  query.set("sort", searchParams.get("sort") ?? "popular");

  for (const key of ["q", "position", "team", "marketType", "status", "watchlistOnly"]) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }

  return query;
}

function getActiveView(searchParams: URLSearchParams): ViewKey {
  if (searchParams.get("watchlistOnly") === "true") return "watchlist";
  const position = searchParams.get("position");
  if (position === "QB" || position === "RB" || position === "WR" || position === "TE") return position;
  const sort = searchParams.get("sort");
  if (sort === "gainers") return "movers";
  if (sort === "popular") return "trending";
  return "all";
}

function toTradeMarket(market: DiscoveryMarket): MarketForTrade {
  return {
    id: market.id,
    playerId: market.playerId,
    weekId: market.weekId,
    week: 1,
    position: market.player.position,
    threshold: market.marketType,
    yesPrice: market.price,
    noPrice: market.noPrice,
    openingPrice: market.openingPrice,
    yesPool: market.liquidity * market.price,
    noPool: market.liquidity * market.noPrice,
    liquidity: market.liquidity,
    volume: market.volume,
    openInterest: market.openInterest,
    status: market.status,
    result: market.result,
    kickoffTime: market.kickoffTime
  };
}

function toPlayer(market: DiscoveryMarket): Player {
  return {
    id: market.player.id,
    name: market.player.name,
    team: market.player.team,
    opponent: "TBD",
    position: market.player.position as Position,
    kickoff: market.kickoffTime,
    projection: 0
  };
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string");
}
