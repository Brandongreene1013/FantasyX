"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, PlusCircle, RefreshCw } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPatch, apiPost } from "@/lib/client-api";
import type { AdminWeeksResponse } from "@/lib/client-api";

type WeekRow = AdminWeeksResponse["weeks"][number];

const SEASONS = [2026, 2027];
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function AdminWeeksPage() {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  const [newSeason, setNewSeason] = useState(2026);
  const [newWeek, setNewWeek] = useState(2);
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const loadWeeks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<AdminWeeksResponse>("/api/admin/weeks");
      setWeeks(data.weeks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weeks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadWeeks(); }, [loadWeeks]);

  async function createWeek() {
    if (!newStartsAt || !newEndsAt) {
      setCreateError("Please fill in all fields.");
      return;
    }
    setIsMutating(true);
    setCreateError(null);
    try {
      await apiPost<{ week: WeekRow }>("/api/admin/weeks", {
        season: newSeason,
        week: newWeek,
        startsAt: new Date(newStartsAt).toISOString(),
        endsAt: new Date(newEndsAt).toISOString()
      });
      setLiveMessage(`Week ${newSeason} W${newWeek} created.`);
      setShowCreate(false);
      await loadWeeks();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create week");
    } finally {
      setIsMutating(false);
    }
  }

  async function updateWeekStatus(weekId: string, status: string) {
    setIsMutating(true);
    try {
      await apiPatch<{ week: WeekRow }>(`/api/admin/weeks/${weekId}`, { status });
      setLiveMessage(`Week updated to ${status}.`);
      await loadWeeks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update week");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <>
      <PageHeading title="Week Manager" kicker="Admin — FX-011">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-xs font-bold text-field hover:underline">← Settlement Admin</a>
          <a href="/admin/markets" className="text-xs font-bold text-field hover:underline">Market Dashboard →</a>
        </div>
      </PageHeading>

      {/* ── Create week form ──────────────────────────────────────── */}
      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-field" aria-hidden />
            <h2 className="text-sm font-black uppercase tracking-widest">NFL Weeks</h2>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded bg-field px-4 text-xs font-black text-white transition hover:bg-field/80"
            onClick={() => setShowCreate(!showCreate)}
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            New Week
          </button>
        </div>

        {showCreate && (
          <div className="mb-4 rounded border border-ink/10 bg-chalk p-4">
            <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-ink/70">Create Week</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-black text-ink/70">Season</span>
                <select
                  className="h-11 w-full rounded border border-ink/15 bg-white px-3 text-sm font-black outline-none focus:border-field"
                  value={newSeason}
                  onChange={(e) => setNewSeason(Number(e.target.value))}
                >
                  {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-ink/70">Week #</span>
                <select
                  className="h-11 w-full rounded border border-ink/15 bg-white px-3 text-sm font-black outline-none focus:border-field"
                  value={newWeek}
                  onChange={(e) => setNewWeek(Number(e.target.value))}
                >
                  {WEEKS.map((w) => <option key={w} value={w}>Week {w}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-ink/70">Starts At</span>
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded border border-ink/15 bg-white px-3 text-sm font-black outline-none focus:border-field"
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-ink/70">Ends At</span>
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded border border-ink/15 bg-white px-3 text-sm font-black outline-none focus:border-field"
                  value={newEndsAt}
                  onChange={(e) => setNewEndsAt(e.target.value)}
                />
              </label>
            </div>
            {createError && <p className="mt-2 text-xs font-bold text-rush" role="alert">{createError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded bg-ink px-5 text-sm font-black text-white transition hover:bg-field disabled:opacity-50"
                onClick={() => void createWeek()}
                disabled={isMutating}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {isMutating ? "Creating..." : "Create Week"}
              </button>
              <button
                className="h-10 rounded border border-ink/15 px-4 text-sm font-bold hover:bg-chalk"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 rounded border border-rush/20 bg-rush/10 p-4 text-sm font-bold text-rush" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm font-bold text-ink/50">Loading weeks...</p>
      ) : weeks.length === 0 ? (
        <div className="rounded border border-ink/10 bg-white p-8 text-center shadow-soft">
          <p className="text-sm font-bold text-ink/50">No weeks found. Create one above to get started.</p>
        </div>
      ) : (
        <section className="grid gap-4">
          {weeks.map((w) => (
            <WeekCard
              key={w.id}
              week={w}
              isMutating={isMutating}
              onActivate={() => void updateWeekStatus(w.id, "ACTIVE")}
              onDeactivate={() => void updateWeekStatus(w.id, "SCHEDULED")}
              onArchive={() => void updateWeekStatus(w.id, "ARCHIVED")}
            />
          ))}
        </section>
      )}

      <div className="mt-5">
        <button
          className="inline-flex h-9 items-center gap-2 rounded border border-ink/15 px-4 text-xs font-bold hover:bg-chalk disabled:opacity-50"
          onClick={() => void loadWeeks()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic>{liveMessage}</p>
    </>
  );
}

function WeekCard({
  week,
  isMutating,
  onActivate,
  onDeactivate,
  onArchive
}: {
  week: WeekRow;
  isMutating: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onArchive: () => void;
}) {
  const isActive = week.status === "ACTIVE";
  const isArchived = week.status === "ARCHIVED";

  const progress = week.marketCount > 0
    ? Math.round((week.settledMarkets / week.marketCount) * 100)
    : 0;

  return (
    <article className="rounded border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={weekStatusClass(week.status)}>{week.status}</span>
            {isActive && <span className="rounded bg-field/10 px-2 py-0.5 text-xs font-black text-field">CURRENT</span>}
          </div>
          <h2 className="mt-1 text-xl font-black">{week.season} — Week {week.week}</h2>
          <p className="text-sm font-semibold text-ink/60">
            {new Date(week.startsAt).toLocaleDateString()} – {new Date(week.endsAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          {!isActive && !isArchived && (
            <button
              className="h-9 rounded bg-field px-4 text-xs font-black text-white transition hover:bg-field/80 disabled:opacity-50"
              onClick={onActivate}
              disabled={isMutating}
            >
              Activate
            </button>
          )}
          {isActive && (
            <button
              className="h-9 rounded border border-ink/15 px-4 text-xs font-bold transition hover:bg-chalk disabled:opacity-50"
              onClick={onDeactivate}
              disabled={isMutating}
            >
              Deactivate
            </button>
          )}
          {!isArchived && (
            <button
              className="h-9 rounded border border-rush/20 bg-rush/5 px-4 text-xs font-bold text-rush transition hover:bg-rush/10 disabled:opacity-50"
              onClick={onArchive}
              disabled={isMutating}
            >
              Archive
            </button>
          )}
          <a
            href={`/admin/markets?weekId=${week.id}`}
            className="inline-flex h-9 items-center rounded border border-ink/15 px-4 text-xs font-bold hover:bg-chalk"
          >
            View Markets
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Markets"  value={week.marketCount} />
        <StatChip label="Players"  value={week.playerCount} />
        <StatChip label="Open"     value={week.openMarkets} />
        <StatChip label="Settled"  value={week.settledMarkets} />
      </div>

      {week.marketCount > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-bold text-ink/60">
            <span>Settlement progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink/10">
            <div
              className="h-2 rounded-full bg-field transition-all"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3 text-center">
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-black uppercase tracking-widest text-ink/50">{label}</p>
    </div>
  );
}

function weekStatusClass(status: string) {
  const base = "rounded px-2 py-1 text-xs font-black";
  if (status === "ACTIVE")   return `${base} bg-field/10 text-field`;
  if (status === "ARCHIVED") return `${base} bg-ink/10 text-ink/50`;
  return `${base} bg-gold/20 text-ink`;
}
