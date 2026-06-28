"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, TrendingUp, Trophy, Zap, BarChart2, Star } from "lucide-react";
import { apiGet, defaultWeekId, type SlateResponse, type SessionResponse } from "@/lib/client-api";
import { pct, credits, thresholdLabel } from "@/lib/format";
import { getYesPrice, getNoPrice } from "@/lib/amm";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { TrendBadge } from "@/components/ui/trend-badge";
import type { Market, Player } from "@/lib/types";

type ExtMarket = Market & { weekId: string; kickoffTime: string; yesPrice: number; noPrice: number; openingPrice: number; volume: number; openInterest: number };

export default function Home() {
  const [slate, setSlate] = useState<SlateResponse | null>(null);
  const [session, setSession] = useState<SessionResponse["user"] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sess] = await Promise.all([
        apiGet<SlateResponse>(`/api/slate?weekId=${defaultWeekId}`).catch(() => null),
        apiGet<SessionResponse>("/api/session").catch(() => null)
      ]);
      setSlate(s);
      setSession(sess?.user ?? null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markets = (slate?.markets ?? []) as ExtMarket[];
  const playerMap = new Map((slate?.players ?? []).map((p) => [p.id, p]));

  const openMarkets = markets.filter((m) => m.status === "OPEN");
  const trending = [...openMarkets].sort((a, b) => b.volume - a.volume).slice(0, 4);
  const movingUp = [...openMarkets].filter((m) => m.yesPrice > m.openingPrice).sort((a, b) => (b.yesPrice - b.openingPrice) - (a.yesPrice - a.openingPrice)).slice(0, 4);
  const lockingSoon = [...openMarkets].filter((m) => {
    const t = new Date(m.kickoffTime).getTime() - Date.now();
    return t > 0 && t < 6 * 3600 * 1000;
  }).slice(0, 3);

  return (
    <div className="space-y-10 pb-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-hero-gradient border border-rim/40 p-6 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,212,106,0.12),transparent_60%)]" aria-hidden />
        <div className="relative">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-neon">
            Free-play · Week 1 · No deposits
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-tight text-frost sm:text-5xl">
            The Fantasy Football{" "}
            <span className="text-gradient-neon">Prediction Market</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm font-semibold leading-relaxed text-muted sm:text-base">
            Trade mock-credit YES/NO shares on whether NFL stars finish Top 3, 5, or 10 in weekly half-PPR scoring.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {session ? (
              <Link
                href="/markets"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neon px-6 text-sm font-black text-surface transition hover:bg-neon/90 active:scale-[0.97]"
              >
                Trade Now
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neon px-6 text-sm font-black text-surface transition hover:bg-neon/90"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/markets"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-rim px-6 text-sm font-semibold text-frost transition hover:bg-panel2"
                >
                  Browse Markets
                </Link>
              </>
            )}
          </div>

          {/* Quick stats */}
          <div className="mt-6 flex gap-6">
            <div>
              <p className="text-2xl font-black text-frost">{openMarkets.length}</p>
              <p className="text-xs font-semibold text-muted">Live markets</p>
            </div>
            <div>
              <p className="text-2xl font-black text-frost">3</p>
              <p className="text-xs font-semibold text-muted">Thresholds</p>
            </div>
            <div>
              <p className="text-2xl font-black text-neon">10K</p>
              <p className="text-xs font-semibold text-muted">Starting credits</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted mb-4">How It Works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { Icon: Zap, color: "text-neon", bg: "bg-neon/10 border-neon/20", title: "Get 10,000 Credits", desc: "Sign up free and receive mock credits — no real money, no deposits." },
            { Icon: TrendingUp, color: "text-charge", bg: "bg-charge/10 border-charge/20", title: "Pick YES or NO", desc: "Trade YES or NO shares on whether a player hits their fantasy threshold." },
            { Icon: Trophy, color: "text-gold", bg: "bg-gold/10 border-gold/20", title: "Win on Rank", desc: "If your prediction is correct at settlement, your shares pay out 1:1." }
          ].map(({ Icon, color, bg, title, desc }) => (
            <div key={title} className={`rounded-xl border p-4 ${bg}`}>
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-panel2 ${color}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="font-black text-frost text-sm">{title}</p>
              <p className="mt-1 text-xs font-semibold text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trending markets */}
      {loaded && trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted">
              <TrendingUp className="h-4 w-4 text-neon" aria-hidden /> Trending Markets
            </h2>
            <Link href="/markets" className="text-xs font-bold text-field hover:text-neon transition-colors">
              See all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {trending.map((market) => {
              const player = playerMap.get(market.playerId);
              if (!player) return null;
              return <MiniMarketCard key={market.id} market={market} player={player} />;
            })}
          </div>
        </section>
      )}

      {/* Biggest movers */}
      {loaded && movingUp.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted">
              <BarChart2 className="h-4 w-4 text-charge" aria-hidden /> Biggest Movers
            </h2>
            <Link href="/markets?sort=yes-desc" className="text-xs font-bold text-field hover:text-neon transition-colors">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {movingUp.map((market) => {
              const player = playerMap.get(market.playerId);
              if (!player) return null;
              const move = ((market.yesPrice - market.openingPrice) / Math.max(market.openingPrice, 0.01)) * 100;
              return (
                <Link
                  key={market.id}
                  href={`/markets/${market.id}`}
                  className="flex items-center gap-3 rounded-xl border border-rim bg-panel px-4 py-3 hover:border-neon/30 hover:bg-panel2 transition-all"
                >
                  <PlayerAvatar name={player.name} team={player.team} position={player.position} size="sm" showPosition={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-frost truncate">{player.name}</p>
                    <p className="text-[10px] font-semibold text-muted">{thresholdLabel(market.threshold)} · {player.position}</p>
                  </div>
                  <TrendBadge value={move} label={`+${move.toFixed(1)}%`} />
                  <span className="text-sm font-black text-neon">{pct(market.yesPrice)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Markets locking soon */}
      {loaded && lockingSoon.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted mb-4">
            <Star className="h-4 w-4 text-amber" aria-hidden /> Locking Soon
          </h2>
          <div className="space-y-2">
            {lockingSoon.map((market) => {
              const player = playerMap.get(market.playerId);
              if (!player) return null;
              const kickoff = new Date(market.kickoffTime);
              const minutesLeft = Math.round((kickoff.getTime() - Date.now()) / 60000);
              return (
                <div key={market.id} className="flex items-center gap-3 rounded-xl border border-amber/20 bg-amber/5 px-4 py-3">
                  <PlayerAvatar name={player.name} team={player.team} position={player.position} size="sm" showPosition={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-frost truncate">{player.name}</p>
                    <p className="text-[10px] font-semibold text-amber">{minutesLeft}m until kickoff</p>
                  </div>
                  <Link href={`/markets/${market.id}`} className="text-xs font-black text-amber hover:text-gold transition-colors">
                    Trade →
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA for logged-out */}
      {loaded && !session && (
        <section className="rounded-2xl border border-neon/20 bg-neon/5 p-6 text-center">
          <p className="text-xl font-black text-frost">Ready to trade?</p>
          <p className="mt-2 text-sm font-semibold text-muted">Create your free account and start with 10,000 mock credits.</p>
          <Link
            href="/signup"
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neon px-8 text-sm font-black text-surface hover:bg-neon/90 transition"
          >
            Create Free Account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}

function MiniMarketCard({ market, player }: { market: ExtMarket; player: Player }) {
  const yes = getYesPrice(market);
  const no  = getNoPrice(market);
  return (
    <Link
      href={`/markets/${market.id}`}
      className="flex items-center gap-3 rounded-xl border border-rim bg-panel p-4 hover:border-neon/30 hover:bg-panel2 transition-all group"
    >
      <PlayerAvatar name={player.name} team={player.team} position={player.position} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-frost truncate group-hover:text-neon transition-colors">{player.name}</p>
        <p className="text-[10px] font-semibold text-muted">{thresholdLabel(market.threshold)} · {player.team}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-black text-neon">{pct(yes)}</span>
        <span className="text-[10px] font-semibold text-muted">vol {credits(market.volume)}</span>
      </div>
    </Link>
  );
}
