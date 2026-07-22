"use client";

import { useMemo, useState } from "react";
import { Activity, Info } from "lucide-react";
import { buildMarketDepth, type MarketDepthLevel } from "@/lib/market-depth";
import { credits, pct } from "@/lib/format";
import type { Market, Side } from "@/lib/types";

export function AmmOrderBook({ market }: { market: Market }) {
  const [side, setSide] = useState<Side>("YES");
  const depth = useMemo(() => buildMarketDepth(market, side), [market, side]);
  const yesPrice = side === "YES" ? depth.midpoint : 1 - depth.midpoint;
  const maxDepth = Math.max(
    depth.asks[depth.asks.length - 1]?.cumulativeShares ?? 1,
    depth.bids[depth.bids.length - 1]?.cumulativeShares ?? 1
  );

  return (
    <section aria-label={`${side} order book`} className="overflow-hidden rounded-xl border border-rim bg-panel card-depth">
      <div className="border-b border-rim px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-frost">
              <Activity className="h-4 w-4 text-charge" aria-hidden />Order Book
            </h2>
            <p className="mt-0.5 text-[10px] font-semibold text-muted">Executable market depth</p>
          </div>
          <span className="rounded border border-charge/25 bg-charge/10 px-2 py-1 font-mono text-[9px] font-black uppercase text-charge">AMM depth</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-rim bg-surface p-1" role="tablist" aria-label="Order book outcome">
          {(["YES", "NO"] as const).map((outcome) => (
            <button key={outcome} type="button" role="tab" aria-selected={side === outcome} onClick={() => setSide(outcome)}
              className={`h-8 rounded-md font-mono text-[10px] font-black transition-colors ${side === outcome ? outcome === "YES" ? "bg-neon text-surface" : "bg-crimson text-white" : "text-muted hover:bg-panel2 hover:text-frost"}`}>
              {outcome} {pct(outcome === "YES" ? yesPrice : 1 - yesPrice)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_.8fr_.8fr] border-b border-rim bg-surface px-3 py-1.5 font-mono text-[8px] font-black uppercase text-muted">
        <span>Price</span><span className="text-right">Size</span><span className="text-right">Total</span>
      </div>

      <div className="divide-y divide-rim/40">
        {[...depth.asks].reverse().map((level, index) => (
          <DepthRow key={`ask-${index}`} level={level} maxDepth={maxDepth} tone="ask" />
        ))}
      </div>

      <div className="grid grid-cols-3 items-center border-y border-rim bg-panel2/70 px-3 py-2 font-mono">
        <div><p className="text-[8px] font-black uppercase text-muted">Mid</p><p className="text-sm font-black text-frost">{pct(depth.midpoint)}</p></div>
        <div className="text-center"><p className="text-[8px] font-black uppercase text-muted">Spread</p><p className="text-xs font-black text-amber">{pct(depth.spread)}</p></div>
        <div className="text-right"><p className="text-[8px] font-black uppercase text-muted">Liquidity</p><p className="text-xs font-black text-frost">{credits(market.liquidity)}</p></div>
      </div>

      <div className="divide-y divide-rim/40">
        {depth.bids.map((level, index) => (
          <DepthRow key={`bid-${index}`} level={level} maxDepth={maxDepth} tone="bid" />
        ))}
      </div>

      <div className="flex gap-2 border-t border-rim bg-surface px-3 py-2 text-[9px] font-semibold leading-relaxed text-muted">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <p>Depth is calculated from the live liquidity curve. FantasyX does not support resting limit orders yet.</p>
      </div>
    </section>
  );
}

function DepthRow({ level, maxDepth, tone }: { level: MarketDepthLevel; maxDepth: number; tone: "bid" | "ask" }) {
  const width = `${Math.max(4, (level.cumulativeShares / maxDepth) * 100)}%`;
  const bid = tone === "bid";
  return (
    <div className="relative grid h-8 grid-cols-[1fr_.8fr_.8fr] items-center overflow-hidden px-3 font-mono text-[10px]">
      <div className={`pointer-events-none absolute inset-y-0 right-0 ${bid ? "bg-neon/8" : "bg-crimson/8"}`} style={{ width }} />
      <span className={`relative font-black ${bid ? "text-neon" : "text-crimson"}`}>{pct(level.price)}</span>
      <span className="relative text-right font-bold text-frost">{level.shares.toFixed(2)}</span>
      <span className="relative text-right font-bold text-muted">{credits(level.notional)}</span>
    </div>
  );
}
