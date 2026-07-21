"use client";

import Link from "next/link";
import type { Route } from "next";
import { Star, TrendingDown, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { pct, thresholdLabel } from "@/lib/format";
import { THRESHOLD_ORDER, type ExtendedMarket, type PlayerMarketRow, type TradeAction } from "@/lib/market-view";
import type { Side } from "@/lib/types";

type Position = { yesShares: number; noShares: number };

export function MarketBoardView({
  rows,
  positions,
  watchlist,
  isAuthenticated,
  onTrade,
  onWatch
}: {
  rows: PlayerMarketRow[];
  positions: Map<string, Position>;
  watchlist: Set<string>;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
  onWatch: (marketId: string) => void;
}) {
  return (
    <section aria-label="Market board" className="overflow-hidden rounded-lg border border-rim bg-panel">
      <div className="hidden grid-cols-[minmax(210px,1.3fr)_minmax(135px,.8fr)_repeat(3,minmax(150px,1fr))_84px] gap-2 border-b border-rim bg-panel2 px-3 py-2 lg:grid">
        {['Player', 'Game', 'Top 3', 'Top 5', 'Top 10', 'Move'].map((label) => (
          <span key={label} className="font-mono text-[9px] font-black uppercase text-muted">{label}</span>
        ))}
      </div>

      <div className="divide-y divide-rim/60">
        {rows.map((row) => (
          <BoardPlayerRow
            key={row.player.id}
            row={row}
            positions={positions}
            watched={watchlist.has(row.selectedMarket.id)}
            isAuthenticated={isAuthenticated}
            onTrade={onTrade}
            onWatch={onWatch}
          />
        ))}
      </div>
    </section>
  );
}

function BoardPlayerRow({ row, positions, watched, isAuthenticated, onTrade, onWatch }: {
  row: PlayerMarketRow;
  positions: Map<string, Position>;
  watched: boolean;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
  onWatch: (marketId: string) => void;
}) {
  const movement = row.selectedMarket.yesPrice - row.selectedMarket.openingPrice;
  const MoveIcon = movement >= 0 ? TrendingUp : TrendingDown;

  return (
    <article className="grid gap-3 px-3 py-3 transition-colors hover:bg-panel2/60 lg:grid-cols-[minmax(210px,1.3fr)_minmax(135px,.8fr)_repeat(3,minmax(150px,1fr))_84px] lg:items-center lg:gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route}>
          <PlayerAvatar name={row.player.name} team={row.player.team} position={row.player.position} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route} className="block truncate text-sm font-black text-frost hover:text-neon">
            {row.player.name}
          </Link>
          <p className="text-[10px] font-bold text-muted">{row.player.team} · {row.player.position}</p>
        </div>
        <button
          type="button"
          onClick={() => onWatch(row.selectedMarket.id)}
          className={`grid h-9 w-9 place-items-center rounded-md ${watched ? "text-amber" : "text-muted hover:text-frost"}`}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star className="h-4 w-4" fill={watched ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-md bg-panel2 px-2 py-2 lg:block lg:bg-transparent lg:px-0">
        <span className="text-[9px] font-black uppercase text-muted lg:hidden">Game</span>
        <p className="text-xs font-bold text-frost">{row.player.team} vs {row.player.opponent || "TBD"}</p>
        <p className="text-[9px] text-muted">{new Date(row.selectedMarket.kickoffTime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
      </div>

      {THRESHOLD_ORDER.map((threshold) => {
        const market = row.markets.find((candidate) => candidate.threshold === threshold);
        return market ? (
          <ThresholdQuote
            key={threshold}
            market={market}
            player={row.player}
            position={positions.get(market.id)}
            isAuthenticated={isAuthenticated}
            onTrade={onTrade}
          />
        ) : (
          <div key={threshold} className="hidden rounded-md border border-rim/50 px-2 py-3 text-center text-xs text-muted lg:block">Unavailable</div>
        );
      })}

      <div className={`flex items-center gap-1 text-xs font-black ${movement >= 0 ? "text-neon" : "text-crimson"}`}>
        <MoveIcon className="h-3.5 w-3.5" aria-hidden />
        {movement >= 0 ? "+" : ""}{pct(movement)}
      </div>
    </article>
  );
}

function ThresholdQuote({ market, player, position, isAuthenticated, onTrade }: {
  market: ExtendedMarket;
  player: PlayerMarketRow["player"];
  position?: Position;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
}) {
  const sellSide: Side = (position?.yesShares ?? 0) > 0 ? "YES" : "NO";
  const hasShares = (position?.yesShares ?? 0) > 0 || (position?.noShares ?? 0) > 0;
  const isOpen = market.status === "OPEN";

  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-2 rounded-md border border-rim bg-panel2 p-2 lg:block">
      <div>
        <p className="text-[9px] font-black uppercase text-muted lg:hidden">{thresholdLabel(market.threshold)}</p>
        <p className="font-mono text-base font-black text-neon">{pct(market.yesPrice)}</p>
        <p className="font-mono text-[9px] text-muted">NO {pct(market.noPrice)}</p>
      </div>
      <div className="grid grid-cols-2 gap-1 lg:mt-1.5">
        <button type="button" disabled={!isOpen} onClick={() => onTrade(market, player, "YES", "BUY")}
          className="min-h-8 rounded bg-neon/15 px-2 text-[9px] font-black text-neon hover:bg-neon/25 disabled:opacity-35">Buy</button>
        <button type="button" disabled={!isOpen || (isAuthenticated && !hasShares)} onClick={() => onTrade(market, player, sellSide, "SELL")}
          className="min-h-8 rounded border border-rim px-2 text-[9px] font-black text-muted hover:text-frost disabled:opacity-35">Sell</button>
      </div>
    </div>
  );
}
