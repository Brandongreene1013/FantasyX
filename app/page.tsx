"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import {
  Activity, TrendingUp, TrendingDown, Trophy,
  Clock, BarChart2, ArrowRight, Zap, Radio
} from "lucide-react";
import { apiGet, defaultWeekId, type SessionResponse, type PortfolioResponse } from "@/lib/client-api";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { credits, thresholdLabel } from "@/lib/format";
import { ExchangeFeed } from "@/components/ui/exchange-feed";
import { LiveBadge } from "@/components/ui/live-badge";
import { Countdown } from "@/components/ui/countdown";
import { PriceFlash } from "@/components/ui/price-flash";
import { TerminalHeader, TerminalPanel, ChangeCell, VolumeCell, PriceCell } from "@/components/ui/terminal-panel";
import type { Market } from "@/lib/types";

type ExtMarket = Market & {
  weekId: string; kickoffTime: string; yesPrice: number; noPrice: number;
  openingPrice: number; volume: number; openInterest: number;
};

export default function Home() {
  const live = useLiveExchange(defaultWeekId);

  const [session,   setSession]   = useState<SessionResponse["user"] | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loaded,    setLoaded]    = useState(false);

  useEffect(() => {
    apiGet<SessionResponse>("/api/session").then((s) => {
      const user = s.user ?? null;
      setSession(user);
      if (user) void apiGet<PortfolioResponse>("/api/portfolio").then(setPortfolio).catch(() => undefined);
    }).catch(() => undefined).finally(() => setLoaded(true));
  }, []);

  const markets    = live.markets as ExtMarket[];
  const playerMap  = new Map(live.players.map((p) => [p.id, p]));
  const open       = markets.filter((m) => m.status === "OPEN");
  const ana        = portfolio?.analytics;
  const pnlPos     = (ana?.allTimePnl ?? 0) >= 0;
  const openCount  = (portfolio?.positions ?? []).filter((p) => p.status === "OPEN" || p.status === "LOCKED").length;

  const topVolume  = [...open].sort((a, b) => b.volume - a.volume).slice(0, 8);
  const gainers    = [...open]
    .filter((m) => m.openingPrice > 0 && m.yesPrice > m.openingPrice)
    .sort((a, b) => (b.yesPrice - b.openingPrice) / b.openingPrice - (a.yesPrice - a.openingPrice) / a.openingPrice)
    .slice(0, 5);
  const losers     = [...open]
    .filter((m) => m.openingPrice > 0 && m.yesPrice < m.openingPrice)
    .sort((a, b) => (a.yesPrice - a.openingPrice) / a.openingPrice - (b.yesPrice - b.openingPrice) / b.openingPrice)
    .slice(0, 5);
  const lockingSoon = [...open]
    .filter((m) => { const t = new Date(m.kickoffTime).getTime() - Date.now(); return t > 0 && t < 6 * 3600 * 1000; })
    .slice(0, 4);
  const topTraders  = live.leaderboard.slice(0, 5);

  return (
    <div className="space-y-6 pb-6">

      {/* ── Terminal status bar ──────────────────────────────── */}
      <div className="rounded-lg border border-neon/20 bg-panel px-3 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
          <div className="flex min-w-0 items-center gap-2.5">
            <LiveBadge isLive={live.isConnected} />
            <span className="whitespace-nowrap font-mono text-[11px] font-black text-frost">FX EXCHANGE</span>
            <span className="font-mono text-[10px] text-muted hidden sm:inline">NFL 2026 · WEEK 1</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {loaded && session ? (
              <>
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <StatPill label="BALANCE" value={credits(portfolio?.user.mockBalance ?? 0)} />
                  <StatPill label="P&L" value={`${pnlPos ? "+" : ""}${credits(ana?.allTimePnl ?? 0)}`} tone={pnlPos ? "neon" : "crimson"} />
                  <StatPill label="OPEN" value={String(openCount)} />
                </div>
                <Link href="/markets/board" className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-neon/30 bg-neon/10 px-2.5 font-mono text-[9px] font-black text-neon transition-colors hover:bg-neon/20">
                  <Activity className="h-3 w-3" aria-hidden /> BOARD
                </Link>
              </>
            ) : loaded ? (
              <Link href="/signup" className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded bg-neon px-2.5 font-mono text-[9px] font-black text-surface transition-colors hover:bg-neon/90">
                START FREE <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Main grid: board left / tape+side right ────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* Left: live quote board sections */}
        <div className="space-y-4">

          {/* Most active */}
          <TerminalPanel label="MOST ACTIVE — VOLUME LEADERS">
            {topVolume.length === 0 ? (
              <div className="py-8 text-center font-mono text-[10px] text-muted">LOADING MARKETS…</div>
            ) : (
              <div>
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 border-b border-rim/40 bg-panel2/50 px-3 py-1.5">
                  {["INSTRUMENT","YES","NO","Δ%","VOL"].map((h) => (
                    <span key={h} className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted/60 text-right first:text-left">{h}</span>
                  ))}
                </div>
                {topVolume.map((m) => {
                  const p = playerMap.get(m.playerId);
                  if (!p) return null;
                  const change = m.openingPrice > 0 ? (m.yesPrice - m.openingPrice) / m.openingPrice : 0;
                  return (
                    <Link key={m.id} href={`/markets/${m.id}` as Route}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-3 py-2.5 border-b border-rim/30 last:border-0 hover:bg-panel2 transition-colors group">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-black text-frost group-hover:text-neon transition-colors truncate">{p.name}</p>
                        <p className="font-mono text-[9px] text-muted">{p.team} · {thresholdLabel(m.threshold)} {m.position}</p>
                      </div>
                      <PriceFlash value={m.yesPrice}>
                        <PriceCell value={m.yesPrice} direction={change > 0 ? "up" : change < 0 ? "down" : "flat"} />
                      </PriceFlash>
                      <PriceCell value={m.noPrice} direction={change < 0 ? "up" : change > 0 ? "down" : "flat"} size="xs" />
                      <div className="hidden sm:block"><ChangeCell change={change} /></div>
                      <div className="hidden sm:block"><VolumeCell volume={m.volume} /></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TerminalPanel>

          {/* Gainers / Losers */}
          {(gainers.length > 0 || losers.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {gainers.length > 0 && (
                <TerminalPanel label="TOP GAINERS">
                  {gainers.map((m) => {
                    const p = playerMap.get(m.playerId);
                    if (!p) return null;
                    const change = (m.yesPrice - m.openingPrice) / m.openingPrice;
                    return (
                      <Link key={m.id} href={`/markets/${m.id}` as Route}
                        className="flex items-center gap-2 px-3 py-2 border-b border-rim/30 last:border-0 hover:bg-panel2 transition-colors group">
                        <TrendingUp className="h-3 w-3 text-neon shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] font-black text-frost group-hover:text-neon truncate">{p.name}</p>
                          <p className="font-mono text-[9px] text-muted">{thresholdLabel(m.threshold)}</p>
                        </div>
                        <ChangeCell change={change} />
                        <PriceCell value={m.yesPrice} direction="up" size="xs" />
                      </Link>
                    );
                  })}
                </TerminalPanel>
              )}
              {losers.length > 0 && (
                <TerminalPanel label="TOP LOSERS">
                  {losers.map((m) => {
                    const p = playerMap.get(m.playerId);
                    if (!p) return null;
                    const change = (m.yesPrice - m.openingPrice) / m.openingPrice;
                    return (
                      <Link key={m.id} href={`/markets/${m.id}` as Route}
                        className="flex items-center gap-2 px-3 py-2 border-b border-rim/30 last:border-0 hover:bg-panel2 transition-colors group">
                        <TrendingDown className="h-3 w-3 text-crimson shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] font-black text-frost group-hover:text-neon truncate">{p.name}</p>
                          <p className="font-mono text-[9px] text-muted">{thresholdLabel(m.threshold)}</p>
                        </div>
                        <ChangeCell change={change} />
                        <PriceCell value={m.yesPrice} direction="down" size="xs" />
                      </Link>
                    );
                  })}
                </TerminalPanel>
              )}
            </div>
          )}

          {/* Locking soon */}
          {lockingSoon.length > 0 && (
            <TerminalPanel label="LOCKING SOON — FINAL WINDOW">
              {lockingSoon.map((m) => {
                const p = playerMap.get(m.playerId);
                if (!p) return null;
                return (
                  <Link key={m.id} href={`/markets/${m.id}` as Route}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-rim/30 last:border-0 hover:bg-panel2 transition-colors group">
                    <Clock className="h-3 w-3 text-amber shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-black text-frost group-hover:text-neon truncate">{p.name}</p>
                      <p className="font-mono text-[9px] text-muted">{p.team} · {thresholdLabel(m.threshold)}</p>
                    </div>
                    <Countdown kickoffTime={m.kickoffTime} status={m.status} className="font-mono text-[10px] font-black" />
                    <PriceFlash value={m.yesPrice}>
                      <PriceCell value={m.yesPrice} />
                    </PriceFlash>
                  </Link>
                );
              })}
            </TerminalPanel>
          )}
        </div>

        {/* Right column: tape + leaderboard + account */}
        <div className="space-y-4">

          <div>
            <TerminalHeader label="TAPE — LIVE TRADES" right={<LiveBadge isLive={live.isConnected} />} />
            <ExchangeFeed events={live.feed} maxItems={12} />
          </div>

          {topTraders.length > 0 && (
            <TerminalPanel label="LEADERBOARD" action={
              <Link href="/leaderboard" className="text-neon hover:underline font-mono text-[9px]">FULL ▶</Link>
            }>
              {topTraders.map((entry, i) => {
                const pos = (entry.totalPnl ?? 0) >= 0;
                return (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-2 border-b border-rim/30 last:border-0">
                    <span className="font-mono text-[10px] font-black text-muted w-5 text-center">{i + 1}</span>
                    <p className="font-mono text-[10px] font-black text-frost flex-1 truncate">{entry.name}</p>
                    <span className={`font-mono text-[10px] font-black tabular-nums ${pos ? "text-neon" : "text-crimson"}`}>
                      {pos ? "+" : ""}{credits(entry.totalPnl)}
                    </span>
                  </div>
                );
              })}
            </TerminalPanel>
          )}

          {loaded && !session && (
            <TerminalPanel label="ABOUT FX EXCHANGE">
              <div className="space-y-0">
                {[
                  { icon: Zap,        color: "text-neon",   label: "FREE PLAY",       desc: "10,000 mock credits on signup. Zero real money." },
                  { icon: TrendingUp, color: "text-charge", label: "PREDICTION MKT",  desc: "Trade YES/NO on NFL weekly rank outcomes." },
                  { icon: Trophy,     color: "text-gold",   label: "SETTLE AT RANK",  desc: "Markets resolve after Sunday scoring closes." },
                ].map(({ icon: Icon, color, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 px-3 py-2.5 border-b border-rim/30 last:border-0">
                    <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${color}`} aria-hidden />
                    <div>
                      <p className={`font-mono text-[9px] font-black ${color}`}>{label}</p>
                      <p className="font-mono text-[9px] text-muted mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3 pt-1">
                <Link href="/signup" className="flex w-full items-center justify-center gap-2 rounded border border-neon/30 bg-neon/10 py-2.5 font-mono text-[10px] font-black text-neon hover:bg-neon/20 transition-colors">
                  OPEN ACCOUNT — FREE <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </TerminalPanel>
          )}

          {loaded && session && portfolio && (
            <TerminalPanel label="YOUR ACCOUNT">
              <div className="px-3 py-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] text-muted">BALANCE</span>
                  <span className="font-mono text-xs font-black text-frost tabular-nums">{credits(portfolio.user.mockBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] text-muted">ALL-TIME P&L</span>
                  <span className={`font-mono text-xs font-black tabular-nums ${pnlPos ? "text-neon" : "text-crimson"}`}>
                    {pnlPos ? "+" : ""}{credits(ana?.allTimePnl ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] text-muted">OPEN POSITIONS</span>
                  <span className="font-mono text-xs font-black text-frost tabular-nums">{openCount}</span>
                </div>
              </div>
              <div className="flex gap-2 px-3 pb-3">
                <Link href="/portfolio" className="flex-1 text-center rounded border border-rim bg-panel2 py-2 font-mono text-[9px] font-bold text-muted hover:text-frost transition-colors">PORTFOLIO</Link>
                <Link href="/markets" className="flex-1 text-center rounded border border-neon/30 bg-neon/10 py-2 font-mono text-[9px] font-bold text-neon hover:bg-neon/20 transition-colors">TRADE →</Link>
              </div>
            </TerminalPanel>
          )}
        </div>
      </div>

      {/* ── Full board CTA ───────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-rim bg-panel2 px-4 py-3">
        <div>
          <p className="font-mono text-xs font-black text-frost">VIEW FULL MARKET BOARD</p>
          <p className="font-mono text-[10px] text-muted mt-0.5">
            Sort by volume · gainers · losers · locking · {markets.length} instruments
          </p>
        </div>
        <Link href="/markets/board" className="inline-flex items-center gap-2 rounded border border-neon/30 bg-neon/10 px-4 py-2 font-mono text-[10px] font-black text-neon hover:bg-neon/20 transition-colors">
          <Activity className="h-3.5 w-3.5" aria-hidden /> OPEN BOARD
        </Link>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone?: "neon" | "crimson" }) {
  const color = tone === "neon" ? "text-neon" : tone === "crimson" ? "text-crimson" : "text-frost";
  return (
    <div className="grid min-w-[72px] grid-cols-[auto_1fr] items-baseline gap-1.5 rounded border border-rim/50 bg-panel2/50 px-2 py-1">
      <p className="whitespace-nowrap font-mono text-[8px] font-bold uppercase text-muted/60">{label}</p>
      <p className={`truncate text-right font-mono text-[11px] font-black tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
