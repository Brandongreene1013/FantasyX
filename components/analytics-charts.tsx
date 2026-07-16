"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type React from "react";
import { credits, pct } from "@/lib/format";
import type { MarketHistoryPoint, PortfolioResponse } from "@/lib/client-api";

type ChartDatum = MarketHistoryPoint & { label: string };

export function MarketHistoryCharts({ history }: { history: MarketHistoryPoint[] }) {
  const data: ChartDatum[] = history.map((point) => ({
    ...point,
    label: new Date(point.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }));

  if (data.length === 0) {
    return <EmptyChart text="No market history yet." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartPanel title="YES Price History" description={`${data.length} price point${data.length === 1 ? "" : "s"}`}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="#101820" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} />
            <YAxis domain={[0, 1]} tickFormatter={(value) => pct(Number(value))} tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} width={42} />
            <Tooltip formatter={(value) => pct(Number(value))} labelFormatter={(label) => `Point ${label}`} />
            <Line type="monotone" dataKey="yesPrice" name="YES" stroke="#12664F" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="noPrice" name="NO" stroke="#A83224" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Volume History" description="Cumulative traded credits">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="#101820" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} />
            <YAxis tickFormatter={(value) => credits(Number(value))} tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} width={44} />
            <Tooltip formatter={(value) => credits(Number(value))} />
            <Area type="monotone" dataKey="volume" name="Volume" stroke="#D7A94B" fill="#D7A94B" fillOpacity={0.25} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Open Interest History" description="Outstanding shares">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="#101820" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} />
            <YAxis tickFormatter={(value) => Number(value).toFixed(0)} tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} width={38} />
            <Tooltip formatter={(value) => Number(value).toFixed(2)} />
            <Area type="monotone" dataKey="openInterest" name="Open interest" stroke="#101820" fill="#12664F" fillOpacity={0.18} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}

export function EquityCurveChart({ points }: { points: PortfolioResponse["equityCurve"] }) {
  const data = points.map((point) => ({
    ...point,
    label: new Date(point.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }));

  if (data.length === 0) {
    return <EmptyChart text="No ledger history yet." />;
  }

  return (
    <div className="h-72" role="img" aria-label="Portfolio equity curve chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#101820" strokeOpacity={0.08} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} />
          <YAxis tickFormatter={(value) => credits(Number(value))} tickLine={false} axisLine={false} tick={{ fill: "#101820", fontSize: 11 }} width={58} />
          <Tooltip formatter={(value) => credits(Number(value))} />
          <Area type="monotone" dataKey="balance" name="Balance" stroke="#12664F" fill="#12664F" fillOpacity={0.22} strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-ink/10 bg-white p-4 shadow-soft" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-ink/70">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-ink/55">{description}</p>
        </div>
      </div>
      <div role="img" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-48 place-items-center rounded border border-ink/10 bg-chalk p-4 text-sm font-bold text-ink/60">
      {text}
    </div>
  );
}
