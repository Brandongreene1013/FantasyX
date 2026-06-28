"use client";

import { useEffect, useState } from "react";
import type React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Activity, BarChart3, Flame, Gauge, Trophy } from "lucide-react";
import { apiGet, defaultWeekId, type AnalyticsMarketCard, type DashboardAnalyticsResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";

export function AnalyticsDashboard() {
  const [dashboard, setDashboard] = useState<DashboardAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DashboardAnalyticsResponse>(`/api/analytics/dashboard?weekId=${defaultWeekId}`)
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load analytics"));
  }, []);

  if (error) {
    return <div className="rounded border border-rush/20 bg-rush/10 p-4 text-sm font-bold text-rush">{error}</div>;
  }

  if (!dashboard) {
    return <div className="rounded border border-ink/10 bg-white p-6 text-sm font-bold text-ink/60 shadow-soft">Loading market intelligence...</div>;
  }

  return (
    <section className="grid gap-5" aria-label="Market intelligence dashboard">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Trending Markets" icon={<Flame className="h-4 w-4" aria-hidden />}>
          <MarketList markets={dashboard.trendingMarkets} emptyText="No trending markets yet." showScore />
        </Panel>

        <Panel title="Biggest Movers" icon={<Activity className="h-4 w-4" aria-hidden />}>
          <MoverList title="YES up" markets={dashboard.biggestMovers.yesIncrease} tone="positive" />
          <MoverList title="YES down" markets={dashboard.biggestMovers.yesDecrease} tone="negative" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Highest Volume" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
          <MarketList markets={dashboard.highestVolume} emptyText="No volume yet." compact />
        </Panel>
        <Panel title="Highest Open Interest" icon={<Gauge className="h-4 w-4" aria-hidden />}>
          <MarketList markets={dashboard.highestOpenInterest} emptyText="No open interest yet." compact />
        </Panel>
        <Panel title="Most Active Players" icon={<Trophy className="h-4 w-4" aria-hidden />}>
          {dashboard.mostActivePlayers.length === 0 ? (
            <p className="text-sm font-semibold text-ink/60">No player activity yet.</p>
          ) : (
            <div className="grid gap-2">
              {dashboard.mostActivePlayers.map((player) => (
                <Link key={player.playerId} href={`/players/${player.playerId}` as Route} className="rounded border border-ink/10 bg-chalk p-3 hover:border-field/40">
                  <p className="font-black">{player.playerName}</p>
                  <p className="text-xs font-semibold text-ink/60">{player.team} - {credits(player.volume)} volume - {player.openInterest.toFixed(1)} OI</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recently Settled" icon={<Trophy className="h-4 w-4" aria-hidden />}>
        {dashboard.recentlySettled.length === 0 ? (
          <p className="text-sm font-semibold text-ink/60">No settled markets yet.</p>
        ) : (
          <MarketList markets={dashboard.recentlySettled} emptyText="No settled markets yet." />
        )}
      </Panel>
    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded border border-ink/10 bg-white p-4 shadow-soft" aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-ink/70">
        <span className="text-field">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function MarketList({ markets, emptyText, compact = false, showScore = false }: { markets: AnalyticsMarketCard[]; emptyText: string; compact?: boolean; showScore?: boolean }) {
  if (markets.length === 0) {
    return <p className="text-sm font-semibold text-ink/60">{emptyText}</p>;
  }

  return (
    <div className="grid gap-2">
      {markets.map((market) => (
        <Link key={market.marketId} href={`/markets/${market.marketId}` as Route} className="rounded border border-ink/10 bg-chalk p-3 hover:border-field/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-black">{market.playerName}</p>
              <p className="text-xs font-semibold text-ink/60">{market.position} - {thresholdLabel(market.threshold)} - {market.team}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-field">{pct(market.yesPrice)}</p>
              <p className={market.priceChange >= 0 ? "text-xs font-bold text-field" : "text-xs font-bold text-rush"}>
                {market.priceChange >= 0 ? "+" : ""}{pct(market.priceChange)}
              </p>
            </div>
          </div>
          {!compact ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold text-ink/60">
              <span>{credits(market.volume)}</span>
              <span>{market.openInterest.toFixed(1)} OI</span>
              <span>{showScore ? `${market.score.toFixed(1)} score` : `${market.recentTradeCount} trades`}</span>
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function MoverList({ title, markets, tone }: { title: string; markets: AnalyticsMarketCard[]; tone: "positive" | "negative" }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink/50">{title}</p>
      <div className="grid gap-2">
        {markets.slice(0, 3).map((market) => (
          <Link key={`${title}-${market.marketId}`} href={`/markets/${market.marketId}` as Route} className="flex items-center justify-between gap-3 rounded border border-ink/10 bg-chalk px-3 py-2 hover:border-field/40">
            <span className="truncate text-sm font-bold">{market.playerName} {thresholdLabel(market.threshold)}</span>
            <span className={tone === "positive" ? "text-sm font-black text-field" : "text-sm font-black text-rush"}>
              {market.priceChange >= 0 ? "+" : ""}{pct(market.priceChange)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
