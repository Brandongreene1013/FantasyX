"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketTimeline } from "@/components/market-timeline";
import { PageHeading } from "@/components/page-heading";
import { apiGet, defaultWeekId, type MarketEventsResponse, type SessionResponse, type SlateResponse, type TradeHistoryResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { AuthRequiredState } from "@/components/auth-required-state";

export default function HistoryPage() {
  const [slate, setSlate] = useState<SlateResponse | null>(null);
  const [trades, setTrades] = useState<TradeHistoryResponse["trades"]>([]);
  const [events, setEvents] = useState<MarketEventsResponse["events"]>([]);
  const [filters, setFilters] = useState({ weekId: defaultWeekId, playerId: "", position: "", marketId: "", status: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await apiGet<SessionResponse>("/api/session").catch(() => ({ user: null }));
      if (!session.user) {
        setIsGuest(true);
        return;
      }
      setIsGuest(false);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      const [slateData, tradeData, eventData] = await Promise.all([
        apiGet<SlateResponse>(`/api/slate?weekId=${filters.weekId}`),
        apiGet<TradeHistoryResponse>(`/api/trade-history?${params.toString()}`),
        apiGet<MarketEventsResponse>(`/api/market-events?weekId=${filters.weekId}${filters.marketId ? `&marketId=${filters.marketId}` : ""}`)
      ]);
      setSlate(slateData);
      setTrades(tradeData.trades);
      setEvents(eventData.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load history");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const players = slate?.players ?? [];
  const markets = useMemo(() => slate?.markets ?? [], [slate]);
  const filteredMarkets = markets.filter((market) => !filters.playerId || market.playerId === filters.playerId);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "playerId" ? { marketId: "" } : {})
    }));
  }

  return (
    <>
      <PageHeading title="Trade History" kicker="Exchange activity">
        <span>Review executions, price changes, market events, and the trail behind every move.</span>
      </PageHeading>

      {!isLoading && isGuest ? (
        <AuthRequiredState title="Your trade history is private" description="Log in to review your executions and personalized activity. Public market prices and player timelines remain available from the market pages." next="/history" />
      ) : null}

      {!isGuest ? <section className="mb-5 grid gap-3 rounded border border-ink/10 bg-white p-4 shadow-soft md:grid-cols-5" aria-label="History filters">
        <Select label="Week" value={filters.weekId} onChange={(value) => updateFilter("weekId", value)}>
          <option value={defaultWeekId}>Week 1</option>
        </Select>
        <Select label="Player" value={filters.playerId} onChange={(value) => updateFilter("playerId", value)}>
          <option value="">All players</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </Select>
        <Select label="Position" value={filters.position} onChange={(value) => updateFilter("position", value)}>
          <option value="">All</option>
          <option value="QB">QB</option>
          <option value="RB">RB</option>
          <option value="WR">WR</option>
          <option value="TE">TE</option>
        </Select>
        <Select label="Market" value={filters.marketId} onChange={(value) => updateFilter("marketId", value)}>
          <option value="">All markets</option>
          {filteredMarkets.map((market) => {
            const player = players.find((item) => item.id === market.playerId);
            return <option key={market.id} value={market.id}>{player?.name ?? "Player"} {thresholdLabel(market.threshold)}</option>;
          })}
        </Select>
        <Select label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)}>
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="LOCKED">Locked</option>
          <option value="SETTLED">Settled</option>
          <option value="VOID">Void</option>
        </Select>
      </section> : null}

      {isLoading ? <StatePanel text="Loading exchange history..." /> : null}
      {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadHistory} /> : null}

      {!isLoading && !error && !isGuest ? (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
            <div className="border-b border-ink/10 bg-chalk px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Executions</h2>
            </div>
            {trades.length === 0 ? <StatePanel text="No trades match these filters." /> : null}
            {trades.length > 0 ? (
              <div className="divide-y divide-ink/10">
                {trades.map((trade) => (
                  <article className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr]" key={trade.id}>
                    <div>
                      <p className="font-black">{trade.playerName}</p>
                      <p className="text-sm font-semibold text-ink/70">{trade.position} {thresholdLabel(trade.thresholdType)} · {trade.status}</p>
                      <p className="text-xs font-semibold text-ink/60">{new Date(trade.timestamp).toLocaleString()}</p>
                    </div>
                    <Metric label="Side" value={trade.side} />
                    <Metric label="Execution" value={pct(trade.executionPrice)} />
                    <Metric label="Shares" value={trade.shares.toFixed(2)} />
                    <Metric label="Cost" value={credits(trade.cost)} />
                    <Metric label="After" value={pct(trade.marketPriceAfter)} />
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <MarketTimeline events={events} />
        </div>
      ) : null}
    </>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">{label}</span>
      <select className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-ink/60">{label}</p>
      <p className="font-black">{value}</p>
    </div>
  );
}

function StatePanel({ text, tone = "default", actionLabel, onAction }: { text: string; tone?: "default" | "error"; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className={tone === "error" ? "rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush" : "p-5 text-sm font-semibold text-ink/70"}>
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="mt-3 rounded bg-ink px-4 py-2 text-xs font-black text-white hover:bg-field" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
