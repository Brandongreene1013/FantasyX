"use client";

import Link from "next/link";
import type { Route } from "next";
import { Activity, Lock, ExternalLink } from "lucide-react";
import { getNoPrice, getYesPrice } from "@/lib/amm";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";

export function MarketCard({
  market,
  player,
  onTrade
}: {
  market: Market;
  player: Player;
  onTrade: (market: Market, side: Side) => void;
}) {
  const yesPrice = getYesPrice(market);
  const noPrice = getNoPrice(market);
  const isOpen = market.status === "OPEN";

  return (
    <article className="flex flex-col rounded border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{player.position}</span>
            <span className="text-xs font-bold text-ink/70">{player.team}</span>
            <span className="text-xs font-bold text-ink/50">vs {player.opponent}</span>
          </div>
          <h2 className="mt-2 truncate text-xl font-black">{player.name}</h2>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold text-ink/60">Week {market.week}</p>
          <p className="text-lg font-black">{thresholdLabel(market.threshold)}</p>
        </div>
      </div>

      <p className="mt-3 min-h-12 text-sm font-semibold leading-6 text-ink/80">
        Will {player.name} finish {thresholdLabel(market.threshold)} at {player.position}?
      </p>

      <div className="my-3 grid grid-cols-2 gap-3">
        <PricePanel label="YES" price={yesPrice} />
        <PricePanel label="NO" price={noPrice} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TradeButton
          disabled={!isOpen}
          label="Buy YES"
          ariaLabel={`Buy YES — ${player.name} ${thresholdLabel(market.threshold)}`}
          onClick={() => onTrade(market, "YES")}
        />
        <TradeButton
          disabled={!isOpen}
          label="Buy NO"
          ariaLabel={`Buy NO — ${player.name} ${thresholdLabel(market.threshold)}`}
          onClick={() => onTrade(market, "NO")}
        />
      </div>

      <div className="mt-4 grid gap-1 border-t border-ink/10 pt-3 text-xs font-semibold text-ink/60">
        <span className="flex items-center gap-1">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Pool {credits(market.liquidity)} · Vol {credits(market.volume ?? 0)}
        </span>
        <span>Open interest {(market.openInterest ?? 0).toFixed(2)} shares</span>
        {isOpen ? (
          <span>Closes at kickoff</span>
        ) : (
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {market.status}{market.result ? ` — ${market.result}` : ""}
          </span>
        )}
      </div>

      <Link
        href={`/markets/${market.id}` as Route}
        className="mt-3 inline-flex min-h-9 items-center gap-1 self-start text-xs font-bold text-field hover:underline"
        aria-label={`View details for ${player.name} ${thresholdLabel(market.threshold)}`}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        View details
      </Link>
    </article>
  );
}

function PricePanel({ label, price }: { label: Side; price: number }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <p className="text-xs font-black text-ink/60">{label} price</p>
      <p className="mt-1 text-2xl font-black">{pct(price)}</p>
    </div>
  );
}

function TradeButton({
  disabled,
  label,
  ariaLabel,
  onClick
}: {
  disabled: boolean;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
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
