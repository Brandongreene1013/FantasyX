"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MarketCard } from "@/components/market-card";
import { MarketTimeline } from "@/components/market-timeline";
import { PageHeading } from "@/components/page-heading";
import { PositionTabs } from "@/components/position-tabs";
import { ThresholdTabs } from "@/components/threshold-tabs";
import { TradeModal } from "@/components/trade-modal";
import { apiGet, defaultWeekId, type MarketEventsResponse, type PortfolioResponse, type SlateResponse } from "@/lib/client-api";
import type { Market, Player, Position, Side, Threshold, MarketStatus } from "@/lib/types";

type Ticket = { market: Market; player: Player; side: Side };
type SortKey = "kickoff" | "yes-asc" | "yes-desc" | "liquidity" | "volume";
type ExtendedMarket = Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number };

export default function MarketsPage() {
  const [slate, setSlate] = useState<SlateResponse | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [events, setEvents] = useState<MarketEventsResponse["events"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [threshold, setThreshold] = useState<Threshold | "ALL">("ALL");
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<MarketStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("kickoff");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [slateData, portfolioData, eventData] = await Promise.all([
        apiGet<SlateResponse>(`/api/slate?weekId=${defaultWeekId}`),
        apiGet<PortfolioResponse>("/api/portfolio"),
        apiGet<MarketEventsResponse>(`/api/market-events?weekId=${defaultWeekId}`)
      ]);
      setSlate(slateData);
      setPortfolio(portfolioData);
      setEvents(eventData.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load markets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const playerMap = useMemo(
    () => new Map((slate?.players ?? []).map((p) => [p.id, p])),
    [slate]
  );

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const p of slate?.players ?? []) set.add(p.team);
    return Array.from(set).sort();
  }, [slate]);

  const markets = useMemo(() => slate?.markets ?? [], [slate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (markets as ExtendedMarket[])
      .filter((market) => {
        const player = playerMap.get(market.playerId);
        if (!player) return false;
        if (position !== "ALL" && market.position !== position) return false;
        if (threshold !== "ALL" && market.threshold !== threshold) return false;
        if (team !== "ALL" && player.team !== team) return false;
        if (statusFilter !== "ALL" && market.status !== statusFilter) return false;
        if (q && !player.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "kickoff") return a.kickoffTime.localeCompare(b.kickoffTime);
        if (sortBy === "yes-asc") return a.yesPrice - b.yesPrice;
        if (sortBy === "yes-desc") return b.yesPrice - a.yesPrice;
        if (sortBy === "liquidity") return b.liquidity - a.liquidity;
        if (sortBy === "volume") return b.volume - a.volume;
        return 0;
      });
  }, [markets, playerMap, position, threshold, team, statusFilter, search, sortBy]);

  return (
    <>
      <PageHeading title="Markets" kicker="Week 1 trading">
        <span>Browse, filter, and trade mock-credit shares on player performance markets.</span>
      </PageHeading>

      <div className="mb-4 grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden />
          <label htmlFor="market-search" className="sr-only">Search by player name</label>
          <input
            id="market-search"
            type="search"
            placeholder="Search player…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded border border-ink/15 bg-white pl-9 pr-4 text-sm font-semibold outline-none focus:border-field"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FilterSelect
            id="team-filter"
            label="Team"
            value={team}
            onChange={setTeam}
            options={[{ value: "ALL", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t }))]}
          />
          <FilterSelect
            id="status-filter"
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as MarketStatus | "ALL")}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "OPEN", label: "Open" },
              { value: "LOCKED", label: "Locked" },
              { value: "SETTLED", label: "Settled" },
              { value: "VOID", label: "Void" }
            ]}
          />
          <FilterSelect
            id="sort-by"
            label="Sort by"
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            options={[
              { value: "kickoff", label: "Kickoff" },
              { value: "yes-asc", label: "YES price ↑" },
              { value: "yes-desc", label: "YES price ↓" },
              { value: "liquidity", label: "Liquidity" },
              { value: "volume", label: "Volume" }
            ]}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <PositionTabs active={position} onChange={setPosition} />
          <ThresholdTabs active={threshold} onChange={setThreshold} />
        </div>
      </div>

      {isLoading ? <StatePanel text="Loading markets…" /> : null}
      {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadData} /> : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <StatePanel text="No markets match those filters." />
      ) : null}

      {!isLoading && !error && filtered.length > 0 ? (
        <>
          <p className="mb-3 text-xs font-semibold text-ink/50">
            {filtered.length} market{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((market) => {
              const player = playerMap.get(market.playerId);
              if (!player) return null;
              return (
                <MarketCard
                  key={market.id}
                  market={market}
                  player={player}
                  onTrade={(m, side) => setTicket({ market: m, player, side })}
                />
              );
            })}
          </div>
        </>
      ) : null}

      {ticket ? (
        <TradeModal
          market={ticket.market}
          player={ticket.player}
          side={ticket.side}
          balance={portfolio?.user.mockBalance ?? 0}
          onTradeComplete={() => {
            setLiveMessage("Trade confirmed. Markets and account balance updated.");
            void loadData();
          }}
          onClose={() => setTicket(null)}
        />
      ) : null}

      {!isLoading && !error ? (
        <section className="pb-20" aria-label="Recent market events">
          <MarketTimeline events={events.slice(0, 12)} compact />
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded border border-ink/15 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-field"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function StatePanel({
  text,
  tone = "default",
  actionLabel,
  onAction
}: {
  text: string;
  tone?: "default" | "error";
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={tone === "error" ? "rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush" : "rounded border border-ink/10 bg-white p-5 text-sm font-bold text-ink/70 shadow-soft"}>
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="mt-3 rounded bg-ink px-4 py-2 text-xs font-black text-white hover:bg-field" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
