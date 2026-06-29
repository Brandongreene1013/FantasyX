"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, Medal, TrendingUp, TrendingDown, Crown, Radio } from "lucide-react";
import { apiGet, defaultWeekId, type SessionResponse } from "@/lib/client-api";
import { useLiveExchange } from "@/hooks/use-live-exchange";
import { credits } from "@/lib/format";
import { LiveBadge } from "@/components/ui/live-badge";
import { ErrorState } from "@/components/ui/empty-state";
import type { LeaderboardResponse } from "@/lib/client-api";

export default function LeaderboardPage() {
  const live = useLiveExchange(defaultWeekId);
  const [session, setSession] = useState<SessionResponse["user"]>(null);
  const [error,   setError]   = useState<string | null>(null);

  // Track previous ranks to animate climbers
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [climbers, setClimbers] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiGet<SessionResponse>("/api/session")
      .then((s) => setSession(s.user ?? null))
      .catch(() => setError("Could not load session"));
  }, []);

  // Detect rank changes and animate climbers
  useEffect(() => {
    const entries = live.leaderboard;
    if (entries.length === 0) return;
    const newClimbers = new Set<string>();
    for (const e of entries) {
      const prev = prevRanksRef.current.get(e.userId);
      if (prev !== undefined && e.rank !== null && prev > e.rank) {
        newClimbers.add(e.userId);
      }
    }
    if (newClimbers.size > 0) {
      setClimbers(newClimbers);
      const t = setTimeout(() => setClimbers(new Set()), 1500);
      // update refs
      for (const e of entries) if (e.rank !== null) prevRanksRef.current.set(e.userId, e.rank);
      return () => clearTimeout(t);
    }
    for (const e of entries) if (e.rank !== null) prevRanksRef.current.set(e.userId, e.rank);
  }, [live.leaderboard]);

  const entries = live.leaderboard;
  const top3    = entries.slice(0, 3);
  const rest    = entries.slice(3);
  const isLoading = entries.length === 0 && !error;

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-frost flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" aria-hidden /> Leaderboard
          </h1>
          <p className="text-xs font-semibold text-muted mt-1 flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-neon animate-pulse" aria-hidden />
            Week 1 standings · ranked by total P&L · live
          </p>
        </div>
        <LiveBadge isLive={live.isConnected} />
      </div>

      {/* Podium — top 3 */}
      {!isLoading && top3.length > 0 && (
        <section aria-label="Top 3 traders">
          <div className="flex items-end justify-center gap-3 pb-2">
            {top3[1] && <PodiumCard entry={top3[1]} rank={2} currentUserId={session?.id} isClimbing={climbers.has(top3[1].userId)} />}
            {top3[0] && <PodiumCard entry={top3[0]} rank={1} currentUserId={session?.id} elevated isClimbing={climbers.has(top3[0].userId)} />}
            {top3[2] && <PodiumCard entry={top3[2]} rank={3} currentUserId={session?.id} isClimbing={climbers.has(top3[2].userId)} />}
          </div>
        </section>
      )}

      {/* Full table */}
      <section className="rounded-xl border border-rim bg-panel overflow-hidden">
        <div className="hidden grid-cols-[3rem_1fr_1fr_1fr_1fr] gap-3 border-b border-rim bg-panel2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted sm:grid">
          <span>#</span><span>Trader</span><span>Weekly P&L</span><span>Total P&L</span><span>Balance</span>
        </div>

        {isLoading && (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-shimmer h-16 border-b border-rim" />
            ))}
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="py-12 text-center text-sm font-semibold text-muted">
            No entries yet. Start trading to appear here.
          </div>
        )}

        {!isLoading && entries.map((row, i) => {
          const isMe = row.userId === session?.id;
          const isTop3 = i < 3;
          const isClimbing = climbers.has(row.userId);
          return (
            <div
              key={row.id}
              className={`grid grid-cols-[3rem_1fr_1fr_1fr] sm:grid-cols-[3rem_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-rim/60 px-4 py-3 last:border-b-0 transition-all ${
                isClimbing ? "bg-neon/8 animate-climb" : isMe ? "bg-neon/5 border-neon/20" : "hover:bg-panel2"
              }`}
            >
              {/* Rank */}
              <div className="flex items-center justify-center">
                {i === 0 ? <Crown className="h-5 w-5 text-gold" aria-label="1st place" /> :
                 i === 1 ? <Medal className="h-5 w-5 text-muted" aria-label="2nd place" /> :
                 i === 2 ? <Medal className="h-5 w-5 text-amber/60" aria-label="3rd place" /> : (
                  <span className={`text-sm font-black ${isTop3 ? "text-frost" : "text-muted"}`}>
                    {row.rank ?? i + 1}
                  </span>
                )}
                {isClimbing && <span className="ml-1 text-[10px] text-neon">↑</span>}
              </div>

              {/* Name */}
              <div>
                <p className={`text-sm font-black ${isMe ? "text-neon" : "text-frost"}`}>
                  {row.name}
                  {isMe && <span className="ml-1.5 text-[10px] font-black text-neon/70">YOU</span>}
                </p>
                <p className="text-[10px] font-semibold text-muted sm:hidden">
                  {credits(row.balance)} · {row.weeklyPnl >= 0 ? "+" : ""}{credits(row.weeklyPnl)} wk
                </p>
              </div>

              <PnlCell value={row.weeklyPnl} label="Week" />
              <PnlCell value={row.totalPnl} label="Total" />

              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-frost">{credits(row.balance)}</p>
              </div>
            </div>
          );
        })}
      </section>

      {session && entries.length > 0 && !entries.slice(0, 10).some((e) => e.userId === session.id) && (
        <div className="rounded-xl border border-neon/20 bg-neon/5 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted">You&apos;re not yet ranked. Trade more to climb!</p>
          <Link href="/markets" className="text-sm font-black text-neon hover:underline">Trade →</Link>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ entry, rank, currentUserId, elevated, isClimbing }: {
  entry: LeaderboardResponse["entries"][0]; rank: number; currentUserId?: string | null; elevated?: boolean; isClimbing?: boolean;
}) {
  const isMe = entry.userId === currentUserId;
  const RANK_COLORS: Record<number, string> = { 1: "text-gold border-gold/40 bg-gold/10", 2: "text-muted border-rim bg-panel", 3: "text-amber/70 border-amber/20 bg-amber/5" };
  const initials = entry.name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className={`flex flex-col items-center gap-2 ${elevated ? "mb-0 pb-0" : "mt-6"} ${isClimbing ? "animate-climb" : ""}`}>
      <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center font-black text-sm ${RANK_COLORS[rank]} ${elevated ? "h-16 w-16 text-base" : ""}`}>
        {initials}
        {isClimbing && <span className="absolute text-neon text-[10px] ml-8 -mt-4">↑</span>}
      </div>
      <div className="text-center">
        <p className={`text-xs font-black ${isMe ? "text-neon" : "text-frost"} max-w-[80px] truncate`}>{entry.name}</p>
        <p className={`text-xs font-bold ${entry.totalPnl >= 0 ? "text-neon" : "text-crimson"}`}>
          {entry.totalPnl >= 0 ? "+" : ""}{credits(entry.totalPnl)}
        </p>
      </div>
      <div className={`w-12 rounded-t-sm flex items-center justify-center py-1 ${RANK_COLORS[rank]} ${elevated ? "h-16 w-14" : rank === 2 ? "h-10" : "h-6"}`}>
        {rank === 1 ? <Crown className="h-4 w-4 text-gold" aria-hidden /> : <span className="text-xs font-black">{rank}</span>}
      </div>
    </div>
  );
}

function PnlCell({ value, label }: { value: number; label: string }) {
  const pos = value >= 0;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wider text-muted sm:hidden">{label}</p>
      <p className={`text-sm font-black flex items-center gap-1 ${pos ? "text-neon" : "text-crimson"}`}>
        {pos ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
        {pos ? "+" : ""}{credits(value)}
      </p>
    </div>
  );
}
