"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct } from "@/lib/format";
import type { MarketHistoryPoint } from "@/lib/client-api";
import type { MarketTimeRange } from "@/components/player-market-controls";

const RANGES: Array<{ key: MarketTimeRange; ms: number | null }> = [
  { key: "1H", ms: 60 * 60 * 1000 },
  { key: "1D", ms: 24 * 60 * 60 * 1000 },
  { key: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "ALL", ms: null }
];

export function PlayerMarketChart({
  history,
  openingPrice,
  currentPrice,
  label,
  range
}: {
  history: MarketHistoryPoint[];
  openingPrice: number;
  currentPrice: number;
  label: string;
  range: MarketTimeRange;
}) {
  const points = useMemo(() => {
    const ordered = dedupeHistory(history);
    const selectedRange = RANGES.find((item) => item.key === range);
    if (!selectedRange?.ms || ordered.length === 0) return ordered;
    const latest = new Date(ordered[ordered.length - 1].createdAt).getTime();
    const filtered = ordered.filter((point) => new Date(point.createdAt).getTime() >= latest - selectedRange.ms!);
    return filtered.length > 0 ? filtered : ordered;
  }, [history, range]);

  const firstPrice = points[0]?.yesPrice ?? currentPrice;
  const movement = currentPrice - firstPrice;
  const movementPct = firstPrice > 0 ? movement / firstPrice : 0;
  const chartData = points.map((point) => ({
    ...point,
    timeLabel: new Date(point.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    pricePct: point.yesPrice * 100
  }));

  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label={`${label} YES share price history`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">YES Share Price</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-black text-neon">{pct(currentPrice)}</span>
            <span className={`text-sm font-black ${movement >= 0 ? "text-neon" : "text-crimson"}`}>
              {movement >= 0 ? "+" : ""}{pct(movement)} ({movementPct >= 0 ? "+" : ""}{(movementPct * 100).toFixed(1)}%)
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">
            Opening reference {pct(openingPrice)}. Range begins at {pct(firstPrice)}.
          </p>
        </div>
        <span className="rounded-lg border border-field/30 bg-field/10 px-3 py-1.5 text-xs font-black text-field">{range}</span>
      </div>

      <p className="sr-only">
        {label} YES price is {pct(currentPrice)}, moving {movement >= 0 ? "up" : "down"} {pct(Math.abs(movement))} from the beginning of the selected range.
      </p>

      {chartData.length === 0 ? (
        <div className="mt-4 rounded-xl border border-rim bg-panel2 px-4 py-10 text-center text-sm font-semibold text-muted">
          No price history is available for this market yet.
        </div>
      ) : chartData.length === 1 ? (
        <div className="mt-4 rounded-xl border border-rim bg-panel2 px-4 py-10 text-center">
          <p className="text-sm font-black text-frost">First price point recorded</p>
          <p className="mt-1 text-xs font-semibold text-muted">{pct(chartData[0].yesPrice)} at {new Date(chartData[0].createdAt).toLocaleString()}</p>
        </div>
      ) : (
        <div className="mt-4 h-64 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="yesPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39ff88" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#39ff88" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
              <XAxis dataKey="timeLabel" tick={{ fill: "#7f8c9d", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} domain={[0, 100]} tick={{ fill: "#7f8c9d", fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
              <ReferenceLine y={openingPrice * 100} stroke="#f5b642" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ stroke: "rgba(57, 255, 136, 0.28)" }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (MarketHistoryPoint & { pricePct: number }) | undefined;
                  if (!active || !point) return null;
                  return (
                    <div className="rounded-lg border border-rim bg-surface px-3 py-2 shadow-xl">
                      <p className="text-xs font-black text-frost">{pct(point.yesPrice)}</p>
                      <p className="text-[10px] font-semibold text-muted">{new Date(point.createdAt).toLocaleString()}</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="pricePct" stroke="#39ff88" strokeWidth={2} fill="url(#yesPriceFill)" isAnimationActive={false} dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function dedupeHistory(history: MarketHistoryPoint[]) {
  const byTimestamp = new Map<string, MarketHistoryPoint>();
  for (const point of [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    byTimestamp.set(point.createdAt, point);
  }
  return Array.from(byTimestamp.values());
}
