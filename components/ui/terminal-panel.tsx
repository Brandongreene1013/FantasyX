"use client";

/**
 * Bloomberg-terminal-style UI primitives.
 *
 * TerminalPanel     — dark bordered panel with optional label header
 * TerminalHeader    — dense section header with left label and right slot
 * QuoteRow          — one market row: player, position, YES/NO, change, volume
 * PriceCell         — monospace price display that accepts a change direction
 * ChangeCell        — colored Δ% with arrow
 * VolumeCell        — right-aligned volume in compact credits
 * TapeRow           — exchange tape entry (timestamp · action · side · player · price)
 * MarketHeatCell    — colored block representing a market's YES probability
 * TerminalDivider   — hairline section divider
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── TerminalPanel ──────────────────────────────────────────────────────────

export function TerminalPanel({
  label,
  children,
  className = "",
  action
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-rim bg-panel overflow-hidden ${className}`}>
      {label && (
        <div className="flex items-center justify-between border-b border-rim/60 bg-panel2 px-3 py-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</span>
          {action && <div className="text-[10px] text-muted">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── TerminalHeader ─────────────────────────────────────────────────────────

export function TerminalHeader({
  label,
  right,
  className = ""
}: {
  label: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between mb-2 ${className}`}>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber">
        ▸ {label}
      </span>
      {right && <div className="text-[10px] text-muted font-mono">{right}</div>}
    </div>
  );
}

// ── TerminalDivider ────────────────────────────────────────────────────────

export function TerminalDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-rim/50" />
      {label && <span className="text-[9px] font-mono font-bold text-muted/50 uppercase tracking-widest">{label}</span>}
      <div className="h-px flex-1 bg-rim/50" />
    </div>
  );
}

// ── PriceCell ──────────────────────────────────────────────────────────────

export function PriceCell({
  value,
  direction,
  size = "sm"
}: {
  value: number;
  direction?: "up" | "down" | "flat";
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const color = direction === "up" ? "text-neon" : direction === "down" ? "text-crimson" : "text-frost";
  const fontSize = size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";
  return (
    <span className={`font-mono font-black tabular-nums ${fontSize} ${color}`}>
      {Math.round(value * 100)}¢
    </span>
  );
}

// ── ChangeCell ─────────────────────────────────────────────────────────────

export function ChangeCell({ change }: { change: number }) {
  if (Math.abs(change) < 0.001) {
    return <span className="font-mono text-[10px] text-muted flex items-center gap-0.5"><Minus className="h-2.5 w-2.5" />0.0%</span>;
  }
  const up = change > 0;
  return (
    <span className={`font-mono text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${up ? "text-neon" : "text-crimson"}`}>
      {up ? <TrendingUp className="h-2.5 w-2.5" aria-hidden /> : <TrendingDown className="h-2.5 w-2.5" aria-hidden />}
      {up ? "+" : ""}{(change * 100).toFixed(1)}%
    </span>
  );
}

// ── VolumeCell ─────────────────────────────────────────────────────────────

export function VolumeCell({ volume }: { volume: number }) {
  const display = volume >= 1000
    ? `${(volume / 1000).toFixed(1)}K`
    : volume.toFixed(0);
  return <span className="font-mono text-[10px] tabular-nums text-steel">{display}</span>;
}

// ── QuoteRow ───────────────────────────────────────────────────────────────

const POS_COLOR: Record<string, string> = {
  QB: "text-amber",
  RB: "text-rb",
  WR: "text-wr",
  TE: "text-te"
};

export function QuoteRow({
  marketId,
  playerName,
  team,
  position,
  threshold,
  yesPrice,
  noPrice,
  openingPrice,
  volume,
  isFlashing,
  isSelected,
  onSelect
}: {
  marketId: string;
  playerName: string;
  team: string;
  position: string;
  threshold: string;
  yesPrice: number;
  noPrice: number;
  openingPrice: number;
  volume: number;
  isFlashing?: "up" | "down" | null;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const change = openingPrice > 0 ? (yesPrice - openingPrice) / openingPrice : 0;
  const threshLabel = threshold.replace("TOP_", "T");

  return (
    <Link
      href={`/markets/${marketId}` as Route}
      onClick={onSelect}
      className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2 border-b border-rim/30 last:border-b-0 cursor-pointer select-none transition-colors ${
        isSelected ? "bg-neon/8 border-l-2 border-l-neon" :
        isFlashing === "up" ? "animate-flash-up" :
        isFlashing === "down" ? "animate-flash-down" :
        "hover:bg-panel2"
      }`}
    >
      {/* Player + position */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-xs font-black text-frost truncate">{playerName}</span>
          <span className={`font-mono text-[9px] font-bold ${POS_COLOR[position] ?? "text-muted"}`}>{position}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] text-muted">{team}</span>
          <span className="font-mono text-[9px] text-muted/50">·</span>
          <span className="font-mono text-[9px] text-muted">{threshLabel}</span>
        </div>
      </div>

      {/* YES price */}
      <div className="text-right">
        <div className="font-mono text-[9px] text-muted/60">YES</div>
        <PriceCell value={yesPrice} direction={change > 0 ? "up" : change < 0 ? "down" : "flat"} />
      </div>

      {/* NO price */}
      <div className="text-right">
        <div className="font-mono text-[9px] text-muted/60">NO</div>
        <PriceCell value={noPrice} direction={change < 0 ? "up" : change > 0 ? "down" : "flat"} size="xs" />
      </div>

      {/* Change */}
      <div className="text-right hidden sm:block">
        <ChangeCell change={change} />
      </div>

      {/* Volume */}
      <div className="text-right hidden sm:block">
        <VolumeCell volume={volume} />
      </div>
    </Link>
  );
}

// ── TapeRow ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
  } catch { return "—:—:—"; }
}

export function TapeRow({
  marketId,
  actorName,
  action,
  side,
  playerName,
  threshold,
  position,
  priceAfter,
  createdAt,
  isNew
}: {
  marketId: string;
  actorName: string;
  action: "BUY" | "SELL";
  side: "YES" | "NO";
  playerName: string;
  threshold: string;
  position: string;
  priceAfter: number;
  createdAt: string;
  isNew?: boolean;
}) {
  const isBuy = action === "BUY";
  const isYes = side === "YES";
  const threshLabel = threshold.replace("TOP_", "T");
  const posColor = POS_COLOR[position] ?? "text-muted";

  return (
    <Link
      href={`/markets/${marketId}` as Route}
      className={`flex items-center gap-2 px-3 py-1.5 border-b border-rim/20 last:border-b-0 hover:bg-panel2 transition-colors font-mono text-[10px] leading-tight ${isNew ? "animate-fade-in" : ""}`}
    >
      {/* Timestamp */}
      <span className="text-muted/60 tabular-nums shrink-0 w-16">{formatTime(createdAt)}</span>

      {/* BUY/SELL */}
      <span className={`font-bold w-8 shrink-0 ${isBuy ? "text-neon" : "text-crimson"}`}>
        {action}
      </span>

      {/* YES/NO */}
      <span className={`font-bold w-6 shrink-0 ${isYes ? "text-neon" : "text-amber"}`}>
        {side}
      </span>

      {/* Player + threshold */}
      <span className="min-w-0 flex-1 truncate">
        <span className="text-frost font-bold">{playerName.split(" ").at(-1)}</span>
        {" "}
        <span className={`${posColor}`}>{threshLabel}</span>
        {" "}
        <span className="text-muted/70">{position}</span>
      </span>

      {/* Price */}
      <span className={`tabular-nums shrink-0 font-black ${isYes ? "text-neon" : "text-crimson"}`}>
        {Math.round(priceAfter * 100)}¢
      </span>
    </Link>
  );
}

// ── MarketHeatCell ─────────────────────────────────────────────────────────

/**
 * A colored square representing a market's YES probability.
 * 0–30%: crimson, 30–50%: amber, 50–70%: neon, 70%+: bright neon
 */
export function MarketHeatCell({
  yesPrice,
  size = 24
}: {
  yesPrice: number;
  size?: number;
}) {
  const pct = Math.round(yesPrice * 100);
  const [bg, text] =
    pct >= 70 ? ["#00D46A", "#0D1117"] :
    pct >= 50 ? ["rgba(0,212,106,0.5)", "#E2E8F0"] :
    pct >= 30 ? ["rgba(245,158,11,0.5)", "#E2E8F0"] :
                ["rgba(239,68,68,0.4)", "#E2E8F0"];
  return (
    <div
      className="inline-flex items-center justify-center rounded-sm font-mono font-black tabular-nums"
      style={{ width: size, height: size, background: bg, color: text, fontSize: size * 0.35 }}
      aria-label={`YES price ${pct}%`}
    >
      {pct}
    </div>
  );
}
