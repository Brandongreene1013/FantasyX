"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketCard } from "@/components/market-card";
import { MarketTimeline } from "@/components/market-timeline";
import { PageHeading } from "@/components/page-heading";
import { PositionTabs } from "@/components/position-tabs";
import { ThresholdTabs } from "@/components/threshold-tabs";
import { TradeModal } from "@/components/trade-modal";
import { apiGet, defaultWeekId, type MarketEventsResponse, type PortfolioResponse, type SlateResponse } from "@/lib/client-api";
import type { Market, Player, Position, Side, Threshold } from "@/lib/types";

type Ticket = {
  market: Market;
  player: Player;
  side: Side;
};

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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const playerMap = useMemo(() => new Map((slate?.players ?? []).map((player) => [player.id, player])), [slate]);
  const markets = useMemo(() => slate?.markets ?? [], [slate]);

  const filtered = useMemo(
    () =>
      markets.filter(
        (market) =>
          (position === "ALL" || market.position === position) &&
          (threshold === "ALL" || market.threshold === threshold)
      ),
    [markets, position, threshold]
  );

  return (
    <>
      <PageHeading title="Markets" kicker="Week 1 trading">
        <span>Filter by position and finish threshold. Prices move with each mock-credit trade.</span>
      </PageHeading>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
        <PositionTabs active={position} onChange={setPosition} />
        <ThresholdTabs active={threshold} onChange={setThreshold} />
      </div>

      {isLoading ? <StatePanel text="Loading Week 1 markets..." /> : null}
      {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadData} /> : null}
      {!isLoading && !error && filtered.length === 0 ? <StatePanel text="No markets match those filters." /> : null}

      {!isLoading && !error && filtered.length > 0 ? (
        <div className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) => {
            const player = playerMap.get(market.playerId);
            if (!player) {
              return null;
            }
            return (
              <MarketCard
                key={market.id}
                market={market}
                player={player}
                onTrade={(selectedMarket, side) => setTicket({ market: selectedMarket, player, side })}
              />
            );
          })}
        </div>
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
        <section className="pb-20">
          <MarketTimeline events={events.slice(0, 12)} compact />
        </section>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>
    </>
  );
}

function StatePanel({ text, tone = "default", actionLabel, onAction }: { text: string; tone?: "default" | "error"; actionLabel?: string; onAction?: () => void }) {
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
