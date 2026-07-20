"use client";

import Link from "next/link";
import type { Route } from "next";
import { Lock, Clock, Flame, Star } from "lucide-react";
import { getYesPrice, getNoPrice } from "@/lib/amm";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { ShareMarketButton } from "@/components/share-market-button";
import { getPositionColor } from "@/lib/team-colors";
import { PlayerThresholdSelector } from "@/components/player-market-controls";

export function MarketCard({
  market,
  player,
  onTrade,
  onWatch,
  isWatched,
  marketOptions,
  onSelectMarket
}: {
  market: Market;
  player: Player;
  onTrade: (market: Market, side: Side) => void;
  onWatch?: (marketId: string) => void;
  isWatched?: boolean;
  marketOptions?: Market[];
  onSelectMarket?: (market: Market) => void;
}) {
  const yesPrice = getYesPrice(market);
  const noPrice  = getNoPrice(market);
  const isOpen   = market.status === "OPEN";
  const posColor = getPositionColor(player.position);
  // Kickoff time display
  const extMarket = market as Market & { kickoffTime?: string; volume?: number; openInterest?: number };
  const kickoff = extMarket.kickoffTime ? new Date(extMarket.kickoffTime) : null;
  const isLockingSoon = kickoff && isOpen && (kickoff.getTime() - Date.now()) < 2 * 60 * 60 * 1000;

  const vol = extMarket.volume ?? 0;
  const isHot = vol > 5000;

  return (
    <article className="group relative flex flex-col rounded-xl border border-rim bg-panel market-card-hover transition-all overflow-hidden">
      {/* Position color accent strip */}
      <div className="h-0.5 w-full" style={{ background: posColor.text }} />

      <div className="p-4 space-y-3 flex-1">
        {/* Header: player + badges */}
        <div className="flex items-start gap-3">
          <Link href={`/players/${player.id}?threshold=${market.threshold}` as Route} aria-label={`View ${player.name} market`}>
            <PlayerAvatar name={player.name} team={player.team} position={player.position} size="md" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded"
                style={{ background: posColor.bg, color: posColor.text }}
              >
                {player.position}
              </span>
              <span className="text-[10px] font-bold text-muted">{player.team}</span>
              {player.opponent && <span className="text-[10px] text-muted/60">vs {player.opponent}</span>}
              {isHot && <Flame className="h-3 w-3 text-amber" aria-label="High volume" />}
              {isLockingSoon && <Clock className="h-3 w-3 text-amber animate-pulse-slow" aria-label="Locking soon" />}
            </div>
            <Link href={`/players/${player.id}?threshold=${market.threshold}` as Route} className="block mt-0.5">
              <h2 className="font-black text-frost leading-tight text-base truncate hover:text-neon transition-colors">
                {player.name}
              </h2>
            </Link>
          </div>

          {onWatch && (
            <button
              onClick={() => onWatch(market.id)}
              aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
              className={`shrink-0 rounded-full p-1 transition-colors ${isWatched ? "text-gold" : "text-muted hover:text-frost"}`}
              type="button"
            >
              <Star className="h-4 w-4" fill={isWatched ? "currentColor" : "none"} aria-hidden />
            </button>
          )}
          <ShareMarketButton market={market} player={player} compact />
        </div>

        {/* Market question */}
        <p className="text-xs font-semibold text-muted leading-relaxed">
          Will {player.name} finish <span className="text-frost font-black">{thresholdLabel(market.threshold)}</span> at {player.position} this week?
        </p>

        {marketOptions && marketOptions.length > 1 && onSelectMarket ? (
          <PlayerThresholdSelector
            playerName={player.name}
            markets={marketOptions}
            activeThreshold={market.threshold}
            onChange={onSelectMarket}
            compact
          />
        ) : null}

        {/* YES/NO prices */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="flex flex-col items-center rounded-xl border border-neon/20 bg-neon/8 py-2 px-3 transition-all hover:bg-neon/15 hover:border-neon/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            onClick={() => onTrade(market, "YES")}
            disabled={!isOpen}
            aria-label={`Buy YES — ${player.name} ${thresholdLabel(market.threshold)} at ${pct(yesPrice)}`}
            type="button"
          >
            <span className="text-[10px] font-black text-neon/70 leading-none">YES</span>
            <span className="text-lg font-black text-neon leading-tight">{pct(yesPrice)}</span>
          </button>
          <button
            className="flex flex-col items-center rounded-xl border border-crimson/20 bg-crimson/8 py-2 px-3 transition-all hover:bg-crimson/15 hover:border-crimson/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            onClick={() => onTrade(market, "NO")}
            disabled={!isOpen}
            aria-label={`Buy NO — ${player.name} ${thresholdLabel(market.threshold)} at ${pct(noPrice)}`}
            type="button"
          >
            <span className="text-[10px] font-black text-crimson/70 leading-none">NO</span>
            <span className="text-lg font-black text-crimson leading-tight">{pct(noPrice)}</span>
          </button>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between gap-2 border-t border-rim px-4 py-2">
        <div className="flex items-center gap-3 text-[10px] font-semibold text-muted">
          <span>Vol {credits(vol)}</span>
          <span>Pool {credits(market.liquidity)}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-muted">
              <Lock className="h-3 w-3" aria-hidden />
              {market.status}{market.result ? ` · ${market.result}` : ""}
            </span>
          ) : kickoff ? (
            <span className={`text-[10px] font-bold ${isLockingSoon ? "text-amber" : "text-muted"}`}>
              {kickoff.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          ) : null}
          <Link
            href={`/players/${player.id}?threshold=${market.threshold}` as Route}
            className="text-[10px] font-bold text-field hover:text-neon transition-colors"
            aria-label={`Details for ${player.name} ${thresholdLabel(market.threshold)}`}
          >
            Details →
          </Link>
        </div>
      </div>
    </article>
  );
}
