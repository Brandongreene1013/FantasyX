"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, type PortfolioResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { PageHeading } from "@/components/page-heading";
import { EquityCurveChart } from "@/components/analytics-charts";

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPortfolio(await apiGet<PortfolioResponse>("/api/portfolio"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load portfolio");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const openPositions = (portfolio?.positions ?? []).filter((position) => position.status === "OPEN" || position.status === "LOCKED");
  const closedPositions = (portfolio?.positions ?? []).filter((position) => position.status === "SETTLED" || position.status === "VOID");
  const openValue = openPositions.reduce((total, position) => total + position.value, 0);
  const unrealizedPnl = openPositions.reduce((total, position) => total + position.pnl, 0);
  const realizedPnl = closedPositions.reduce((total, position) => total + position.pnl, 0);

  return (
    <>
      <PageHeading title="Portfolio" kicker="Open positions">
        <span>
          Cash {portfolio ? credits(portfolio.user.mockBalance) : "Loading"} - Marked value {credits(openValue)}
        </span>
      </PageHeading>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Current value" value={portfolio ? credits(portfolio.analytics.currentPortfolioValue) : credits(openValue)} />
        <SummaryCard label="Weekly P&L" value={portfolio ? signedCredits(portfolio.analytics.weeklyPnl) : signedCredits(unrealizedPnl)} tone={(portfolio?.analytics.weeklyPnl ?? unrealizedPnl) >= 0 ? "positive" : "negative"} />
        <SummaryCard label="All-time P&L" value={portfolio ? signedCredits(portfolio.analytics.allTimePnl) : signedCredits(realizedPnl)} tone={(portfolio?.analytics.allTimePnl ?? realizedPnl) >= 0 ? "positive" : "negative"} />
      </div>

      {portfolio ? (
        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Portfolio analytics">
          <SummaryCard label="Unrealized G/L" value={signedCredits(portfolio.analytics.unrealizedGainLoss)} tone={portfolio.analytics.unrealizedGainLoss >= 0 ? "positive" : "negative"} />
          <SummaryCard label="Realized G/L" value={signedCredits(portfolio.analytics.realizedGainLoss)} tone={portfolio.analytics.realizedGainLoss >= 0 ? "positive" : "negative"} />
          <SummaryCard label="Win rate" value={pct(portfolio.analytics.winRate)} />
          <SummaryCard label="Average entry" value={pct(portfolio.analytics.averageEntry)} />
          <SummaryCard label="Largest position" value={portfolio.analytics.largestPosition ? `${portfolio.analytics.largestPosition.playerName} - ${credits(portfolio.analytics.largestPosition.costBasis)}` : "None"} />
          <SummaryCard label="Best trade" value={portfolio.analytics.bestTrade ? portfolio.analytics.bestTrade.playerName : "None"} tone="positive" />
          <SummaryCard label="Worst trade" value={portfolio.analytics.worstTrade ? portfolio.analytics.worstTrade.playerName : "None"} tone={portfolio.analytics.worstTrade ? "negative" : "default"} />
          <SummaryCard label="Open value" value={credits(openValue)} />
        </section>
      ) : null}

      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Equity Curve</h2>
            <p className="mt-1 text-sm font-semibold text-ink/70">Ledger-based portfolio value history.</p>
          </div>
          <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{portfolio?.equityCurve.length ?? 0} points</span>
        </div>
        <div className="mt-4">
          <EquityCurveChart points={portfolio?.equityCurve ?? []} />
        </div>
      </section>

      {!isLoading && !error ? (
        <>
          <PositionSection
            title="Open Positions"
            emptyText="No open positions yet."
            positions={openPositions}
            emptyAction
            onSold={loadPortfolio}
          />

          <PositionSection
            title="Closed Positions"
            emptyText="No closed positions yet."
            positions={closedPositions}
          />
        </>
      ) : null}

      <section className="mt-5 overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
        <div className="border-b border-ink/10 bg-chalk px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Portfolio State</h2>
        </div>

        {isLoading ? <StatePanel text="Loading portfolio..." /> : null}
        {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadPortfolio} /> : null}
      </section>
    </>
  );
}

function signedCredits(value: number) {
  return `${value >= 0 ? "+" : ""}${credits(value)}`;
}

type PortfolioPosition = PortfolioResponse["positions"][number];

function PositionSection({ title, positions, emptyText, emptyAction = false, onSold }: { title: string; positions: PortfolioPosition[]; emptyText: string; emptyAction?: boolean; onSold?: () => void }) {
  return (
    <section className="mb-5 overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
      <div className="hidden grid-cols-[1.25fr_0.65fr_0.65fr_0.6fr_0.65fr_0.65fr_1fr] gap-3 border-b border-ink/10 bg-chalk px-4 py-3 text-xs font-black uppercase tracking-widest text-ink/70 md:grid">
        <span>{title}</span>
        <span>Average entry</span>
        <span>Current value</span>
        <span>Shares</span>
        <span>P&L</span>
        <span>Return</span>
        <span>Sell</span>
      </div>
      <div className="border-b border-ink/10 bg-chalk px-4 py-3 md:hidden">
        <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">{title}</h2>
      </div>
      {positions.length === 0 ? (
        <div className="p-6">
          <p className="text-sm font-semibold text-ink/70">{emptyText}</p>
          {emptyAction ? (
            <Link className="mt-4 inline-flex h-10 items-center rounded bg-ink px-4 text-sm font-black text-white hover:bg-field" href="/markets">
              Start Trading Week 1
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="divide-y divide-ink/10">
          {positions.map((position) => {
            const totalShares = position.yesShares + position.noShares;
            const sideLabel = position.yesShares > 0 && position.noShares > 0 ? "YES / NO" : position.yesShares > 0 ? "YES" : "NO";
            return (
              <article className="grid gap-3 p-4 md:grid-cols-[1.25fr_0.65fr_0.65fr_0.6fr_0.65fr_0.65fr_1fr]" key={position.id}>
                <div>
                  <p className="font-black">{position.playerName}</p>
                  <p className="text-sm font-semibold text-ink/70">{position.position} - {thresholdLabel(position.thresholdType)} - {sideLabel} - {position.status}</p>
                </div>
                <Metric label="Average entry" value={pct(position.averageEntry)} />
                <Metric label="Current value" value={credits(position.currentValue)} />
                <Metric label="Shares" value={totalShares.toFixed(2)} />
                <PnlMetric label="P&L" value={position.pnl} />
                <PnlMetric label="Return" value={position.returnPct} percent />
                {onSold && (position.status === "OPEN" || position.status === "LOCKED") ? <SellPositionControl position={position} onSold={onSold} /> : <Metric label="Sell" value="-" />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SellPositionControl({ position, onSold }: { position: PortfolioPosition; onSold: () => void }) {
  const defaultSide: "YES" | "NO" = position.yesShares > 0 ? "YES" : "NO";
  const [side, setSide] = useState<"YES" | "NO">(defaultSide);
  const [shares, setShares] = useState(Math.max(0, defaultSide === "YES" ? position.yesShares : position.noShares));
  const [isSelling, setIsSelling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownedShares = side === "YES" ? position.yesShares : position.noShares;
  const canSell = position.status === "OPEN" && shares > 0 && shares <= ownedShares && !isSelling;

  async function sell() {
    if (!canSell) return;
    setIsSelling(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost("/api/trades", { action: "SELL", marketId: position.marketId, side, shares, idempotencyKey: crypto.randomUUID() });
      setMessage("Sold.");
      onSold();
    } catch (sellError) {
      setError(sellError instanceof Error ? sellError.message : "Sell failed");
    } finally {
      setIsSelling(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-ink/70 md:hidden">Sell</p>
      <div className="grid gap-2">
        <div className="grid grid-cols-2 gap-1">
          <button type="button" disabled={position.yesShares <= 0} aria-pressed={side === "YES"} onClick={() => { setSide("YES"); setShares(position.yesShares); }} className={`rounded border px-2 py-1 text-xs font-black disabled:opacity-40 ${side === "YES" ? "border-field bg-field/10" : "border-ink/10"}`}>YES</button>
          <button type="button" disabled={position.noShares <= 0} aria-pressed={side === "NO"} onClick={() => { setSide("NO"); setShares(position.noShares); }} className={`rounded border px-2 py-1 text-xs font-black disabled:opacity-40 ${side === "NO" ? "border-field bg-field/10" : "border-ink/10"}`}>NO</button>
        </div>
        <input className="h-9 rounded border border-ink/15 px-2 text-sm font-bold" type="number" min={0.000001} step={0.000001} max={ownedShares} value={shares} onChange={(event) => setShares(Number(event.target.value))} aria-label={`Shares of ${side} to sell`} />
        <div className="flex gap-1">
          <button className="flex-1 rounded border border-ink/10 px-2 py-1 text-xs font-black hover:bg-ink/5" type="button" disabled={ownedShares <= 0} onClick={() => setShares(ownedShares)}>All</button>
          <button className="flex-1 rounded bg-ink px-2 py-1 text-xs font-black text-white hover:bg-field disabled:opacity-40" type="button" disabled={!canSell} onClick={sell}>{isSelling ? "Selling" : "Sell"}</button>
        </div>
        {position.status !== "OPEN" ? <p className="text-xs font-bold text-ink/60">Market is {position.status.toLowerCase()}.</p> : null}
        {error ? <p className="text-xs font-bold text-rush" role="alert">{error}</p> : null}
        {message ? <p className="text-xs font-bold text-field" role="status">{message}</p> : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-field" : tone === "negative" ? "text-rush" : "text-ink";
  return (
    <div className="rounded border border-ink/10 bg-white p-4 shadow-soft">
      <p className="text-xs font-black uppercase tracking-widest text-ink/70">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-ink/70 md:hidden">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function PnlMetric({ label, value, percent = false }: { label: string; value: number; percent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-ink/70 md:hidden">{label}</p>
      <p className={value >= 0 ? "font-black text-field" : "font-black text-rush"}>
        {value >= 0 ? "+" : ""}{percent ? pct(value) : credits(value)}
      </p>
    </div>
  );
}

function StatePanel({ text, tone = "default", actionLabel, onAction }: { text: string; tone?: "default" | "error"; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className={tone === "error" ? "p-6 text-sm font-bold text-rush" : "p-6 text-sm font-semibold text-ink/70"}>
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="mt-3 rounded bg-ink px-4 py-2 text-xs font-black text-white hover:bg-field" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
