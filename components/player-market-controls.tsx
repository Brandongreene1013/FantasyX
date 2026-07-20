"use client";

import { getYesPrice } from "@/lib/amm";
import { pct, thresholdLabel } from "@/lib/format";
import type { Market, Threshold } from "@/lib/types";

const THRESHOLDS: Threshold[] = ["TOP_3", "TOP_5", "TOP_10"];

export type MarketTimeRange = "1H" | "1D" | "1W" | "ALL";

const TIME_RANGES: MarketTimeRange[] = ["1H", "1D", "1W", "ALL"];

export function PlayerThresholdSelector({
  playerName,
  markets,
  activeThreshold,
  onChange,
  compact = false,
  sticky = false
}: {
  playerName: string;
  markets: Market[];
  activeThreshold: Threshold;
  onChange: (market: Market) => void;
  compact?: boolean;
  sticky?: boolean;
}) {
  const marketByThreshold = new Map(markets.map((market) => [market.threshold, market]));

  return (
    <div
      className={`${sticky ? "sticky top-0 z-20" : ""} rounded-xl border border-rim bg-surface/95 p-1.5 backdrop-blur`}
      role="tablist"
      aria-label={`${playerName} contract`}
      data-testid="player-threshold-selector"
    >
      {!compact ? <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-black uppercase tracking-wider text-muted">Choose contract</p> : null}
      <div className="grid grid-cols-3 gap-1.5">
        {THRESHOLDS.map((threshold) => {
          const option = marketByThreshold.get(threshold);
          const selected = activeThreshold === threshold;

          return (
            <button
              key={threshold}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={!option}
              onClick={() => option && onChange(option)}
              className={`${compact ? "min-h-12" : "min-h-16"} rounded-lg border px-2 py-2 text-center transition-colors ${
                selected
                  ? "border-neon bg-neon text-surface shadow-glow-sm"
                  : "border-rim bg-panel text-muted hover:border-neon/35 hover:bg-panel2 hover:text-frost"
              } disabled:cursor-not-allowed disabled:opacity-35`}
            >
              <span className={`${compact ? "text-[11px]" : "text-sm"} block font-black leading-none`}>{thresholdLabel(threshold)}</span>
              <span className={`${compact ? "text-xs" : "text-lg"} mt-1.5 block font-black leading-none`}>
                {option ? pct(getYesPrice(option)) : "N/A"}
              </span>
              {!compact ? <span className="mt-1 block text-[9px] font-bold uppercase leading-none opacity-70">YES price</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MarketTimeRangeSelector({ value, onChange }: { value: MarketTimeRange; onChange: (range: MarketTimeRange) => void }) {
  return (
    <div className="rounded-xl border border-rim bg-surface p-1.5" role="group" aria-label="Price chart time range" data-testid="market-time-range-selector">
      <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-black uppercase tracking-wider text-muted">Choose time</p>
      <div className="grid grid-cols-4 gap-1.5">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            aria-pressed={value === range}
            className={`h-10 rounded-lg border px-2 text-xs font-black transition-colors ${
              value === range
                ? "border-field bg-field text-surface"
                : "border-rim bg-panel text-muted hover:border-field/40 hover:bg-panel2 hover:text-frost"
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
