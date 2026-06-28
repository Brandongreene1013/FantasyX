"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Activity, Clock, Lock, CheckCircle, XCircle, TrendingUp, TrendingDown } from "lucide-react";
import { MarketTimeline } from "@/components/market-timeline";
import { TradePanel } from "@/components/trade-panel";
import { MarketHistoryCharts } from "@/components/analytics-charts";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { ErrorState } from "@/components/ui/empty-state";
import { apiGet } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { getPositionColor } from "@/lib/team-colors";
import type { MarketDetailResponse, PortfolioResponse } from "@/lib/client-api";

export default function MarketDetailPage({ params }: { params: Promise<{ marketId: string }> }) {
  const [marketId, setMarketId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetailResponse | null>(null);
  const [balance, setBalance] = useState(0);
  const [marketPosition, setMarketPosition] = useState<PortfolioResponse["positions"][number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void params.then((p) => setMarketId(p.marketId)); }, [params]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true); setError(null);
    try {
      const [d, p] = await Promise.all([
        apiGet<MarketDetailResponse>(`/api/markets/${id}`),
        apiGet<PortfolioResponse>("/api/portfolio")
      ]);
      setDetail(d); setBalance(p.user.mockBalance);
      setMarketPosition(p.positions.find((pos) => pos.marketId === id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load market");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (marketId) void load(marketId); }, [marketId, load]);

  if (isLoading) return (
    <div className="space-y-4">
      <BackLink />
      <div className="h-40 animate-shimmer rounded-2xl" />
    </div>
  );

  if (error || !detail?.player) return (
    <div className="space-y-4">
      <BackLink />
      <ErrorState message={error ?? "Market not found."} onRetry={marketId ? () => void load(marketId) : undefined} />
    </div>
  );

  const { market, player, events } = detail;
  const posColor = getPositionColor(player.position);
  const isOpen = market.status === "OPEN";
  const priceMove = market.yesPrice - market.openingPrice;

  return (
    <div className="space-y-4 pb-6">
      <BackLink />

      {/* Player hero card */}
      <div className="rounded-2xl border border-rim bg-panel overflow-hidden">
        <div className="h-1 w-full" style={{ background: posColor.text }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <PlayerAvatar name={player.name} team={player.team} position={player.position} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: posColor.bg, color: posColor.text }}>{player.position}</span>
                <span className="text-xs font-bold text-muted">{player.team}</span>
                {player.opponent && <span className="text-xs text-muted/60">vs {player.opponent}</span>}
                <StatusBadge status={market.status} result={market.result} />
              </div>
              <Link href={`/players/${player.id}` as Route} className="block">
                <h1 className="text-2xl font-black text-frost hover:text-neon transition-colors leading-tight">{player.name}</h1>
              </Link>
              <p className="text-sm font-semibold text-muted mt-1">
                {thresholdLabel(market.threshold)} threshold · Week {market.week}
              </p>
            </div>
          </div>

          {/* YES/NO prices — mobile-prominent */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neon/25 bg-neon/8 p-4 text-center">
              <p className="text-[10px] font-black text-neon/70 uppercase tracking-wider">YES</p>
              <p className="text-3xl font-black text-neon mt-1">{pct(market.yesPrice)}</p>
              <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-bold ${priceMove >= 0 ? "text-neon/70" : "text-crimson/70"}`}>
                {priceMove >= 0 ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
                {priceMove >= 0 ? "+" : ""}{pct(priceMove)}
              </div>
            </div>
            <div className="rounded-xl border border-crimson/25 bg-crimson/8 p-4 text-center">
              <p className="text-[10px] font-black text-crimson/70 uppercase tracking-wider">NO</p>
              <p className="text-3xl font-black text-crimson mt-1">{pct(market.noPrice)}</p>
              <p className="text-xs font-bold text-muted mt-1">
                {credits(market.liquidity)} pool
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Volume" value={credits(market.volume)} />
            <MiniStat label="Open Interest" value={`${Number(market.openInterest).toFixed(1)} sh`} />
            <MiniStat label="Kickoff" value={new Date(market.kickoffTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
          </div>

          {/* Kickoff */}
          <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span>{new Date(market.kickoffTime).toLocaleString()}</span>
            {!isOpen && <Lock className="h-3.5 w-3.5 text-amber" aria-hidden />}
          </div>
        </div>
      </div>

      {/* Market question */}
      <div className="rounded-xl border border-rim bg-panel px-4 py-3">
        <p className="text-sm font-semibold text-muted">
          Will <span className="font-black text-frost">{player.name}</span> finish{" "}
          <span className="font-black text-neon">{thresholdLabel(market.threshold)}</span>{" "}
          at {player.position} this week in half-PPR scoring?
        </p>
      </div>

      {/* Charts */}
      <section aria-label="Market price history">
        <MarketHistoryCharts history={detail.history} />
      </section>

      {/* Sentiment */}
      <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Market sentiment">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-frost">Market Sentiment</h2>
          <span className="text-xs font-bold text-muted">{detail.sentiment.label}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SentimentBar label="Bullish" value={detail.sentiment.bullishScore} color="neon" />
          <SentimentBar label="Bearish" value={detail.sentiment.bearishScore} color="crimson" />
          <SentimentBar label="Confidence" value={detail.sentiment.confidenceScore} color="charge" />
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">Price Move</p>
            <p className={`text-base font-black ${detail.sentiment.recentPriceChange >= 0 ? "text-neon" : "text-crimson"}`}>
              {detail.sentiment.recentPriceChange >= 0 ? "+" : ""}{pct(detail.sentiment.recentPriceChange)}
            </p>
          </div>
        </div>
      </section>

      {/* Trade panel + Timeline */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <TradePanel
            market={market}
            player={player}
            balance={balance}
            position={marketPosition}
            onTradeComplete={() => void load(marketId!)}
          />
        </div>
        <section aria-label="Market timeline">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted" aria-hidden />
            <h2 className="text-sm font-black text-frost">Timeline</h2>
            <span className="ml-auto text-xs font-semibold text-muted">{events.length} events</span>
          </div>
          <MarketTimeline events={events} />
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel2 px-3 py-2 text-center">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-black text-frost mt-0.5">{value}</p>
    </div>
  );
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: "neon" | "crimson" | "charge" }) {
  const barColor = color === "neon" ? "bg-neon" : color === "crimson" ? "bg-crimson" : "bg-charge";
  const textColor = color === "neon" ? "text-neon" : color === "crimson" ? "text-crimson" : "text-charge";
  return (
    <div className="rounded-lg bg-panel2 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-lg font-black mt-1 ${textColor}`}>{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rim">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/markets" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-frost transition-colors" aria-label="Back to markets">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Markets
    </Link>
  );
}

function StatusBadge({ status, result }: { status: string; result: string | null }) {
  if (status === "SETTLED") {
    return result === "YES"
      ? <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-black text-neon"><CheckCircle className="h-3 w-3" aria-hidden />YES</span>
      : <span className="flex items-center gap-1 rounded-full bg-crimson/15 px-2 py-0.5 text-[10px] font-black text-crimson"><XCircle className="h-3 w-3" aria-hidden />NO</span>;
  }
  if (status === "LOCKED") return <span className="flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-black text-amber"><Lock className="h-3 w-3" aria-hidden />LOCKED</span>;
  if (status === "VOID")   return <span className="rounded-full bg-rim px-2 py-0.5 text-[10px] font-black text-muted">VOID</span>;
  return <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-black text-neon">LIVE</span>;
}
