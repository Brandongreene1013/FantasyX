"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { apiGet, defaultWeekId, type LeaderboardResponse, type SessionResponse } from "@/lib/client-api";
import { credits } from "@/lib/format";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [session, setSession] = useState<SessionResponse["user"]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setLeaderboard(await apiGet<LeaderboardResponse>(`/api/leaderboard?weekId=${defaultWeekId}`));
      apiGet<SessionResponse>("/api/session").then((data) => setSession(data.user)).catch(() => setSession(null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const entries = leaderboard?.entries ?? [];

  return (
    <>
      <PageHeading title="Leaderboard" kicker="Week 1 standings">
        <span>Weekly and total P&L are based on mock-credit trading performance.</span>
      </PageHeading>

      <section className="overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
        <div className="hidden grid-cols-[4rem_1fr_1fr_1fr] gap-3 border-b border-ink/10 bg-chalk px-4 py-3 text-xs font-black uppercase tracking-widest text-ink/70 sm:grid">
          <span>Rank</span>
          <span>User</span>
          <span>Weekly P&L</span>
          <span>Total P&L</span>
        </div>

        {isLoading ? <StatePanel text="Loading leaderboard..." /> : null}
        {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadLeaderboard} /> : null}
        {!isLoading && !error && entries.length === 0 ? <StatePanel text="No leaderboard entries yet." /> : null}

        {!isLoading && !error
          ? entries.map((row, index) => (
              <div className="grid gap-3 border-b border-ink/10 p-4 last:border-b-0 sm:grid-cols-[4rem_1fr_1fr_1fr] sm:items-center" key={row.id}>
                <div className="flex items-center gap-3 sm:block">
                  <div className="grid h-10 w-10 place-items-center rounded bg-chalk font-black">
                    {index === 0 ? <Trophy className="h-5 w-5 text-gold" /> : row.rank ?? index + 1}
                  </div>
                  <p className="font-black sm:hidden">{row.name} {row.userId === session?.id ? <span className="text-xs text-field">YOU</span> : null}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="font-black">{row.name} {row.userId === session?.id ? <span className="text-xs text-field">YOU</span> : null}</p>
                  <p className="text-sm font-semibold text-ink/70">{credits(row.balance)} balance</p>
                </div>
                <Pnl label="Weekly P&L" value={row.weeklyPnl} />
                <Pnl label="Total P&L" value={row.totalPnl} />
              </div>
            ))
          : null}
      </section>
    </>
  );
}

function Pnl({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-ink/70 sm:hidden">{label}</p>
      <p className={value >= 0 ? "font-black text-field" : "font-black text-rush"}>{value >= 0 ? "+" : ""}{credits(value)}</p>
    </div>
  );
}

function StatePanel({ text, tone = "default", actionLabel, onAction }: { text: string; tone?: "default" | "error"; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className={tone === "error" ? "p-6 text-sm font-bold text-rush" : "p-6 text-sm font-semibold text-ink/70"}>
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="mt-3 rounded bg-ink px-4 py-2 text-xs font-black text-white hover:bg-field" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
