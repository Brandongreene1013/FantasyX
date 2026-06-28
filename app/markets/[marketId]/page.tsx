"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Activity, Clock, Lock, CheckCircle, XCircle, User } from "lucide-react";
import { MarketTimeline } from "@/components/market-timeline";
import { TradePanel } from "@/components/trade-panel";
import { MarketHistoryCharts } from "@/components/analytics-charts";
import { apiGet } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { MarketDetailResponse, PortfolioResponse } from "@/lib/client-api";

export default function MarketDetailPage({ params }: { params: Promise<{ marketId: string }> }) {
  const [marketId, setMarketId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetailResponse | null>(null);
  const [balance, setBalance] = useState(0);
  const [marketPosition, setMarketPosition] = useState<PortfolioResponse["positions"][number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setMarketId(p.marketId));
  }, [params]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [detailData, portfolioData] = await Promise.all([
        apiGet<MarketDetailResponse>(`/api/markets/${id}`),
        apiGet<PortfolioResponse>("/api/portfolio")
      ]);
      setDetail(detailData);
      setBalance(portfolioData.user.mockBalance);
      setMarketPosition(portfolioData.positions.find((position) => position.marketId === id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load market");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (marketId) void load(marketId);
  }, [marketId, load]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !detail || !detail.player) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush">
          {error ?? "Market not found."}
        </div>
      </div>
    );
  }

  const { market, player, events } = detail;

  return (
    <div>
      <BackLink />

      <div className="mt-4 rounded border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{player.position}</span>
              <span className="text-xs font-bold text-ink/70">{player.team}</span>
              <span className="text-xs font-bold text-ink/50">vs {player.opponent}</span>
              <StatusBadge status={market.status} result={market.result} />
            </div>
            <Link
              href={`/players/${player.id}` as Route}
              className="mt-2 inline-flex items-center gap-2 text-3xl font-black hover:text-field"
              aria-label={`View ${player.name} player page`}
            >
              {player.name}
              <User className="h-5 w-5 text-ink/30" aria-hidden />
            </Link>
            <p className="mt-1 text-base font-semibold text-ink/70">
              Will {player.name} finish {thresholdLabel(market.threshold)} at {player.position}?
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-ink/60">Week {market.week}</p>
            <p className="text-2xl font-black">{thresholdLabel(market.threshold)}</p>
            <p className="flex items-center justify-end gap-1 text-xs font-semibold text-ink/60">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {new Date(market.kickoffTime).toLocaleString()}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="YES price" value={pct(market.yesPrice)} accent />
          <Stat label="NO price" value={pct(market.noPrice)} />
          <Stat label="Liquidity" value={credits(market.liquidity)} />
          <Stat label="Volume" value={credits(market.volume)} />
          <Stat label="Open interest" value={(market.openInterest).toFixed(2)} />
          <Stat label="Opening YES" value={pct(market.openingPrice)} />
        </dl>
      </div>

      <section className="mt-5 rounded border border-ink/10 bg-white p-5 shadow-soft" aria-label="Market sentiment">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Market Sentiment</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">
              {detail.sentiment.label} read from price, flow, open interest, and recent movement.
            </p>
          </div>
          <span className="rounded bg-field/10 px-3 py-1 text-xs font-black text-field">
            Confidence {detail.sentiment.confidenceScore}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SentimentMeter label="Bullish score" value={detail.sentiment.bullishScore} tone="field" />
          <SentimentMeter label="Bearish score" value={detail.sentiment.bearishScore} tone="rush" />
          <SentimentMeter label="Confidence" value={detail.sentiment.confidenceScore} tone="ink" />
          <Stat label="YES move" value={`${detail.sentiment.recentPriceChange >= 0 ? "+" : ""}${pct(detail.sentiment.recentPriceChange)}`} accent={detail.sentiment.recentPriceChange >= 0} />
        </div>
      </section>

      <section className="mt-5" aria-label="Market charts">
        <MarketHistoryCharts history={detail.history} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div>
          <TradePanel
            market={market}
            player={player}
            balance={balance}
            position={marketPosition}
            onTradeComplete={() => void load(marketId!)}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink/60" aria-hidden />
            <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">
              Market Timeline
            </h2>
            <span className="ml-auto text-xs font-semibold text-ink/50">{events.length} event{events.length !== 1 ? "s" : ""}</span>
          </div>
          <MarketTimeline events={events} />
        </div>
      </div>
    </div>
  );
}

function SentimentMeter({ label, value, tone }: { label: string; value: number; tone: "field" | "rush" | "ink" }) {
  const barClass = tone === "field" ? "bg-field" : tone === "rush" ? "bg-rush" : "bg-ink";
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <p className="text-xs font-black uppercase tracking-widest text-ink/60">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
      <div className="mt-2 h-2 overflow-hidden rounded bg-white">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/markets"
      className="inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-bold text-ink/70 hover:text-ink"
      aria-label="Back to markets"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Markets
    </Link>
  );
}

function LoadingState() {
  return (
    <div>
      <BackLink />
      <div className="mt-6 rounded border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/60 shadow-soft">
        Loading market…
      </div>
    </div>
  );
}

function StatusBadge({ status, result }: { status: string; result: string | null }) {
  if (status === "SETTLED") {
    return (
      <span className="flex items-center gap-1 rounded bg-field/10 px-2 py-1 text-xs font-black text-field">
        <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Settled {result ?? ""}
      </span>
    );
  }
  if (status === "VOID") {
    return (
      <span className="flex items-center gap-1 rounded bg-rush/10 px-2 py-1 text-xs font-black text-rush">
        <XCircle className="h-3.5 w-3.5" aria-hidden /> Void
      </span>
    );
  }
  if (status === "LOCKED") {
    return (
      <span className="flex items-center gap-1 rounded bg-gold/10 px-2 py-1 text-xs font-black text-gold">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Locked
      </span>
    );
  }
  return (
    <span className="rounded bg-ink/10 px-2 py-1 text-xs font-black text-ink/70">Open</span>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <dt className="text-xs font-black uppercase tracking-widest text-ink/60">{label}</dt>
      <dd className={`mt-1 text-lg font-black ${accent ? "text-field" : ""}`}>{value}</dd>
    </div>
  );
}
