"use client";

import Link from "next/link";
import type { Route } from "next";
import { Activity, Clock, Lock, Star, TrendingDown, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { credits, pct, thresholdLabel } from "@/lib/format";
import { THRESHOLD_ORDER, type ExtendedMarket, type PlayerMarketRow, type TradeAction } from "@/lib/market-view";
import { getPositionColor } from "@/lib/team-colors";
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
  const openMarkets = rows.reduce((total, row) => total + row.markets.filter((market) => market.status === "OPEN").length, 0);
  const totalVolume = rows.reduce((total, row) => total + row.markets.reduce((sum, market) => sum + market.volume, 0), 0);

  return (
    <section aria-label="Market board" className="space-y-3">
      <div className="overflow-hidden rounded-md border border-rim bg-[#05070A]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rim bg-panel2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-neon" aria-hidden />
            <span className="font-mono text-[10px] font-black uppercase text-frost">FantasyX Market Board</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] font-black uppercase">
            <span className="text-muted">{rows.length} players</span>
            <span className="text-neon">{openMarkets} open</span>
            <span className="text-amber">Vol {credits(totalVolume)}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.7fr_.7fr] border-b border-rim/70 bg-surface px-3 py-1.5 font-mono text-[9px] font-black uppercase text-muted max-sm:hidden">
          <span>Player</span>
          <span>Kick</span>
          <span>Top 3</span>
          <span>Top 5</span>
          <span>Top 10</span>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <BoardPlayerTile
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

function BoardPlayerTile({ row, positions, watched, isAuthenticated, onTrade, onWatch }: {
  row: PlayerMarketRow;
  positions: Map<string, Position>;
  watched: boolean;
  isAuthenticated: boolean;
  onTrade: (market: ExtendedMarket, player: PlayerMarketRow["player"], side: Side, action: TradeAction) => void;
  onWatch: (marketId: string) => void;
}) {
  const movement = row.selectedMarket.yesPrice - row.selectedMarket.openingPrice;
  const MoveIcon = movement >= 0 ? TrendingUp : TrendingDown;
  const posColor = getPositionColor(row.player.position);
  const totalVolume = row.markets.reduce((sum, market) => sum + market.volume, 0);
  const kickoff = new Date(row.selectedMarket.kickoffTime);

  return (
    <article className="overflow-hidden rounded-md border border-rim bg-[#070A0F] shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition-colors hover:border-neon/25">
      <div className="h-0.5 w-full" style={{ background: posColor.text }} />
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-rim/70 bg-panel/55 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route}>
            <PlayerAvatar name={row.player.name} team={row.player.team} position={row.player.position} size="sm" />
          </Link>
          <div className="min-w-0">
            <Link href={`/players/${row.player.id}?threshold=${row.selectedMarket.threshold}` as Route} className="block truncate text-sm font-black leading-tight text-frost hover:text-neon">
              {row.player.name}
            </Link>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] font-black uppercase">
              <span className="rounded-sm px-1.5 py-0.5" style={{ background: posColor.bg, color: posColor.text }}>{row.player.position}</span>
              <span className="text-muted">{row.player.team}</span>
              <span className="text-muted/70">vs {row.player.opponent || "TBD"}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onWatch(row.selectedMarket.id)}
          className={`grid h-8 w-8 place-items-center rounded-md ${watched ? "bg-amber/10 text-amber" : "text-muted hover:bg-panel2 hover:text-frost"}`}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star className="h-4 w-4" fill={watched ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-rim/60 border-b border-rim/70 bg-surface/70">
        <BoardStat label="Kick" value={kickoff.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} />
        <BoardStat label="Vol" value={credits(totalVolume)} />
        <div className="flex items-center justify-center gap-1 px-2 py-2">
          <MoveIcon className={`h-3.5 w-3.5 ${movement >= 0 ? "text-neon" : "text-crimson"}`} aria-hidden />
          <span className={`font-mono text-xs font-black ${movement >= 0 ? "text-neon" : "text-crimson"}`}>
            {movement >= 0 ? "+" : ""}{pct(movement)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-rim/60">
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
            <div key={threshold} className="grid min-h-[120px] place-items-center px-2 text-center font-mono text-[10px] font-black uppercase text-muted">No line</div>
          );
        })}
      </div>
    </article>
  );
}

function BoardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 py-2 text-center">
      <p className="font-mono text-[8px] font-black uppercase text-muted">{label}</p>
      <p className="truncate font-mono text-[10px] font-black text-frost">{value}</p>
    </div>
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
  const movement = market.yesPrice - market.openingPrice;
  const hasPosition = (position?.yesShares ?? 0) > 0 || (position?.noShares ?? 0) > 0;

  return (
    <div className={`min-w-0 p-2 ${hasPosition ? "bg-neon/5" : "bg-transparent"}`}>
      <div className="flex items-center justify-between gap-1">
        <p className="font-mono text-[9px] font-black uppercase text-muted">{thresholdLabel(market.threshold)}</p>
        {!isOpen ? <Lock className="h-3 w-3 text-muted" aria-label={market.status} /> : <Clock className="h-3 w-3 text-neon/70" aria-label="Open market" />}
      </div>
      <button
        type="button"
        disabled={!isOpen}
        onClick={() => onTrade(market, player, "YES", "BUY")}
        className="mt-1 w-full rounded-md border border-neon/20 bg-neon/10 px-1.5 py-2 text-left transition-colors hover:border-neon/40 hover:bg-neon/15 disabled:opacity-35"
        aria-label={`Buy YES for ${player.name} ${thresholdLabel(market.threshold)} at ${pct(market.yesPrice)}`}
      >
        <span className="block font-mono text-[8px] font-black uppercase text-neon/70">Yes</span>
        <span className="block font-mono text-xl font-black leading-none text-neon">{pct(market.yesPrice)}</span>
      </button>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={!isOpen}
          onClick={() => onTrade(market, player, "NO", "BUY")}
          className="min-h-7 rounded-sm bg-crimson/10 px-1 font-mono text-[9px] font-black text-crimson hover:bg-crimson/15 disabled:opacity-35"
          aria-label={`Buy NO for ${player.name} ${thresholdLabel(market.threshold)} at ${pct(market.noPrice)}`}
        >
          NO {pct(market.noPrice)}
        </button>
        <button
          type="button"
          disabled={!isOpen || (isAuthenticated && !hasShares)}
          onClick={() => onTrade(market, player, sellSide, "SELL")}
          className="min-h-7 rounded-sm border border-rim px-1 font-mono text-[9px] font-black text-muted hover:text-frost disabled:opacity-35"
        >
          Sell
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 font-mono text-[8px] font-black uppercase text-muted">
        <span>{movement >= 0 ? "+" : ""}{pct(movement)}</span>
        <span>{credits(market.liquidity)}</span>
      </div>
    </div>
  );
}
