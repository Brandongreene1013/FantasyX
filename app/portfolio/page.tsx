"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TrendingUp, TrendingDown, BarChart2, Wallet, Lock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { apiGet, apiPost, type PortfolioResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { EquityCurveChart } from "@/components/analytics-charts";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";

function signedCredits(v: number) {
  return `${v >= 0 ? "+" : ""}${credits(v)}`;
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const [tab, setTab] = useState<"open" | "closed">("open");

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setPortfolio(await apiGet<PortfolioResponse>("/api/portfolio")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load portfolio"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openPositions   = (portfolio?.positions ?? []).filter((p) => p.status === "OPEN" || p.status === "LOCKED");
  const closedPositions = (portfolio?.positions ?? []).filter((p) => p.status === "SETTLED" || p.status === "VOID");
  const openValue       = openPositions.reduce((s, p) => s + p.value, 0);

  async function sell(positionId: string) {
    try {
      await apiPost("/api/trade/sell", { positionId });
      setLiveMsg("Position sold.");
      void load();
      window.dispatchEvent(new Event("fantasyx:data-changed"));
    } catch (e) {
      setLiveMsg(e instanceof Error ? e.message : "Sell failed");
    }
  }

  if (isLoading) return <LoadingFeed count={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const user = portfolio?.user;
  const analytics = portfolio?.analytics;
  const pnlPos = (analytics?.allTimePnl ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="rounded-2xl border border-rim bg-hero-gradient p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted">Portfolio Value</p>
            <p className="text-3xl font-black text-frost mt-1">{credits(analytics?.currentPortfolioValue ?? openValue)}</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 border ${pnlPos ? "bg-neon/10 border-neon/20 text-neon" : "bg-crimson/10 border-crimson/20 text-crimson"}`}>
            {pnlPos ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
            <span className="text-sm font-black">{signedCredits(analytics?.allTimePnl ?? 0)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Cash" value={credits(user?.mockBalance ?? 0)} />
          <MiniStat label="Open Value" value={credits(openValue)} />
          <MiniStat label="Win Rate" value={pct(analytics?.winRate ?? 0)} tone={analytics?.winRate && analytics.winRate > 0.5 ? "positive" : "neutral"} />
        </div>
      </div>

      {/* Secondary analytics */}
      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnalyticsCard label="Weekly P&L" value={signedCredits(analytics.weeklyPnl)} tone={analytics.weeklyPnl >= 0 ? "positive" : "negative"} />
          <AnalyticsCard label="Unrealized" value={signedCredits(analytics.unrealizedGainLoss)} tone={analytics.unrealizedGainLoss >= 0 ? "positive" : "negative"} />
          <AnalyticsCard label="Realized" value={signedCredits(analytics.realizedGainLoss)} tone={analytics.realizedGainLoss >= 0 ? "positive" : "negative"} />
          <AnalyticsCard label="Avg Entry" value={pct(analytics.averageEntry)} />
        </div>
      )}

      {/* Equity chart */}
      {(portfolio?.equityCurve.length ?? 0) > 1 && (
        <section className="rounded-xl border border-rim bg-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-charge" aria-hidden />
            <h2 className="text-sm font-black text-frost">Equity Curve</h2>
            <span className="text-xs text-muted">{portfolio!.equityCurve.length} points</span>
          </div>
          <EquityCurveChart points={portfolio!.equityCurve} />
          <p className="mt-2 text-xs text-muted font-semibold">Ledger-based portfolio value history</p>
        </section>
      )}

      {/* Position tabs */}
      <div className="flex gap-2">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${tab === t ? "bg-neon/10 border border-neon/30 text-neon" : "bg-panel border border-rim text-muted hover:text-frost"}`}
            type="button"
          >
            {t === "open" ? `Open (${openPositions.length})` : `Closed (${closedPositions.length})`}
          </button>
        ))}
      </div>

      {/* Positions */}
      {tab === "open" && (
        <section className="space-y-2">
          {openPositions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="No open positions"
              description="Trade a market to build your portfolio."
              action={
                <Link href="/markets" className="rounded-xl bg-neon/10 border border-neon/20 px-4 py-2 text-sm font-black text-neon hover:bg-neon/20 transition">
                  Browse Markets
                </Link>
              }
            />
          ) : openPositions.map((pos) => (
            <PositionCard
              key={pos.id}
              position={pos}
              onSell={pos.status === "OPEN" ? () => sell(pos.id) : undefined}
            />
          ))}
        </section>
      )}

      {tab === "closed" && (
        <section className="space-y-2">
          {closedPositions.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No closed positions" compact />
          ) : closedPositions.map((pos) => (
            <PositionCard key={pos.id} position={pos} />
          ))}
        </section>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic>{liveMsg}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const color = tone === "positive" ? "text-neon" : tone === "negative" ? "text-crimson" : "text-frost";
  return (
    <div className="text-center">
      <p className={`text-base font-black ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-muted mt-0.5">{label}</p>
    </div>
  );
}

function AnalyticsCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-neon" : tone === "negative" ? "text-crimson" : "text-frost";
  return (
    <div className="rounded-xl border border-rim bg-panel p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-base font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function PositionCard({ position: pos, onSell }: {
  position: PortfolioResponse["positions"][0];
  onSell?: () => void;
}) {
  const side  = pos.yesShares > 0 ? "YES" : "NO";
  const shares = side === "YES" ? pos.yesShares : pos.noShares;
  const pnlPos = pos.pnl >= 0;

  const StatusIcon = pos.status === "SETTLED"
    ? (pos.result === "YES" ? CheckCircle2 : XCircle)
    : pos.status === "LOCKED" ? Lock : null;

  return (
    <div className="rounded-xl border border-rim bg-panel p-4">
      <div className="flex items-start gap-3">
        <PlayerAvatar name={pos.playerName} team={pos.team} position={pos.position} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-frost truncate">{pos.playerName}</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${side === "YES" ? "bg-neon/10 text-neon" : "bg-crimson/10 text-crimson"}`}>
              {side}
            </span>
            {StatusIcon && (
              <StatusIcon
                className={`h-3.5 w-3.5 ${pos.status === "SETTLED" && pos.result === "YES" ? "text-neon" : pos.status === "SETTLED" ? "text-crimson" : "text-muted"}`}
                aria-hidden
              />
            )}
          </div>
          <p className="text-[10px] font-semibold text-muted mt-0.5">
            {thresholdLabel(pos.thresholdType)} · {pos.position} · {shares.toFixed(2)} shares
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-black ${pnlPos ? "text-neon" : "text-crimson"}`}>
            {pnlPos ? "+" : ""}{credits(pos.pnl)}
          </p>
          <p className="text-[10px] font-semibold text-muted">{credits(pos.value)} val</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex gap-3 text-[10px] font-semibold text-muted">
          <span>Entry {pct(pos.entryPrice)}</span>
          <span>Now {pct(pos.currentPrice)}</span>
          <span>Cost {credits(pos.costBasis)}</span>
        </div>
        <div className="flex items-center gap-2">
          {onSell && (
            <button
              onClick={onSell}
              className="rounded-lg bg-panel2 border border-rim px-3 py-1 text-xs font-black text-frost hover:border-crimson/40 hover:text-crimson transition-colors"
              type="button"
            >
              Sell
            </button>
          )}
          <Link
            href={`/markets/${pos.marketId}`}
            className="text-xs font-bold text-field hover:text-neon transition-colors"
            aria-label={`View market for ${pos.playerName}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
