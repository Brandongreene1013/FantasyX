"use client";

import { Activity, Lock } from "lucide-react";
import { getNoPrice, getYesPrice } from "@/lib/amm";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";

export function MarketCard({ market, player, onTrade }: { market: Market; player: Player; onTrade: (market: Market, side: Side) => void }) {
  const yesPrice = getYesPrice(market);
  const noPrice = getNoPrice(market);
  const isOpen = market.status === "OPEN";

  return (
    <article className="rounded border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{player.position}</span>
            <span className="text-xs font-bold text-ink/70">{player.team}</span>
          </div>
          <h2 className="mt-2 truncate text-xl font-black">{player.name}</h2>
          <p className="text-sm font-semibold text-ink/70">{player.team} vs {player.opponent}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-ink/70">Week {market.week}</p>
          <p className="text-lg font-black">{thresholdLabel(market.threshold)}</p>
        </div>
      </div>

      <p className="mt-4 min-h-12 text-base font-black leading-6">
        Will {player.name} finish {thresholdLabel(market.threshold)} at {player.position}?
      </p>

      <div className="my-4 grid grid-cols-2 gap-3">
        <PricePanel label="YES" price={yesPrice} />
        <PricePanel label="NO" price={noPrice} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TradeButton disabled={!isOpen} label="Buy YES" ariaLabel={`Buy YES shares for ${player.name} ${thresholdLabel(market.threshold)} ${player.position}`} onClick={() => onTrade(market, "YES")} />
        <TradeButton disabled={!isOpen} label="Buy NO" ariaLabel={`Buy NO shares for ${player.name} ${thresholdLabel(market.threshold)} ${player.position}`} onClick={() => onTrade(market, "NO")} />
      </div>

      <div className="mt-4 grid gap-1 border-t border-ink/10 pt-3 text-xs font-semibold text-ink/70">
        <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Pool {credits(market.liquidity)} · Vol {credits(market.volume ?? 0)}</span>
        <span>Open interest {(market.openInterest ?? 0).toFixed(2)} shares · Open YES {pct(market.openingPrice ?? yesPrice)}</span>
        {isOpen ? <span>Closes at kickoff</span> : <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> {market.status}</span>}
      </div>
    </article>
  );
}

function PricePanel({ label, price }: { label: Side; price: number }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <p className="text-xs font-black text-ink/70">{label} price</p>
      <p className="mt-1 text-2xl font-black">{pct(price)}</p>
    </div>
  );
}

function TradeButton({ disabled, label, ariaLabel, onClick }: { disabled: boolean; label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      className="h-11 rounded bg-ink px-3 text-sm font-black text-white transition hover:bg-field disabled:cursor-not-allowed disabled:bg-ink/30"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      type="button"
    >
      {label}
    </button>
  );
}
