"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, type PortfolioResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { PageHeading } from "@/components/page-heading";

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
        <SummaryCard label="Open value" value={credits(openValue)} />
        <SummaryCard label="Unrealized P&L" value={`${unrealizedPnl >= 0 ? "+" : ""}${credits(unrealizedPnl)}`} tone={unrealizedPnl >= 0 ? "positive" : "negative"} />
        <SummaryCard label="Realized P&L" value={`${realizedPnl >= 0 ? "+" : ""}${credits(realizedPnl)}`} tone={realizedPnl >= 0 ? "positive" : "negative"} />
      </div>

      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Historical Equity Curve</h2>
            <p className="mt-1 text-sm font-semibold text-ink/70">Ledger-based balance points. Chart visualization placeholder for Sprint 1.</p>
          </div>
          <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{portfolio?.equityCurve.length ?? 0} points</span>
        </div>
        <div className="mt-4 flex h-28 items-end gap-1 rounded border border-ink/10 bg-chalk p-3" aria-label="Historical equity curve placeholder">
          {(portfolio?.equityCurve ?? []).slice(-24).map((point) => {
            const max = Math.max(...(portfolio?.equityCurve ?? []).map((entry) => entry.balance), 1);
            const height = Math.max(8, (point.balance / max) * 96);
            return <div key={point.id} className="flex-1 rounded-t bg-field" style={{ height }} title={`${point.type}: ${credits(point.balance)}`} />;
          })}
          {portfolio && portfolio.equityCurve.length === 0 ? <p className="self-center text-sm font-bold text-ink/60">No ledger history yet.</p> : null}
        </div>
      </section>

      {!isLoading && !error ? (
        <>
          <PositionSection
            title="Open Positions"
            emptyText="No open positions yet."
            positions={openPositions}
            emptyAction
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

type PortfolioPosition = PortfolioResponse["positions"][number];

function PositionSection({ title, positions, emptyText, emptyAction = false }: { title: string; positions: PortfolioPosition[]; emptyText: string; emptyAction?: boolean }) {
  return (
    <section className="mb-5 overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
      <div className="hidden grid-cols-[1.25fr_0.75fr_0.75fr_0.7fr_0.75fr_0.75fr] gap-3 border-b border-ink/10 bg-chalk px-4 py-3 text-xs font-black uppercase tracking-widest text-ink/70 md:grid">
        <span>{title}</span>
        <span>Average entry</span>
        <span>Current value</span>
        <span>Shares</span>
        <span>P&L</span>
        <span>Return</span>
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
              <article className="grid gap-3 p-4 md:grid-cols-[1.25fr_0.75fr_0.75fr_0.7fr_0.75fr_0.75fr]" key={position.id}>
                <div>
                  <p className="font-black">{position.playerName}</p>
                  <p className="text-sm font-semibold text-ink/70">{position.position} - {thresholdLabel(position.thresholdType)} - {sideLabel} - {position.status}</p>
                </div>
                <Metric label="Average entry" value={pct(position.averageEntry)} />
                <Metric label="Current value" value={credits(position.currentValue)} />
                <Metric label="Shares" value={totalShares.toFixed(2)} />
                <PnlMetric label="P&L" value={position.pnl} />
                <PnlMetric label="Return" value={position.returnPct} percent />
              </article>
            );
          })}
        </div>
      )}
    </section>
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
