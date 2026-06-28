"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart2, CheckCircle2, Lock, RefreshCw, Trash2, Zap } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPost, defaultWeekId } from "@/lib/client-api";
import { MARKET_TEMPLATES } from "@/lib/market-template.service";
import type { AdminMarketsResponse, AdminWeeksResponse, GenerateMarketsResponse, BulkActionResponse } from "@/lib/client-api";

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;
const STATUSES = ["DRAFT", "SCHEDULED", "OPEN", "LOCKED", "SETTLED", "VOID"] as const;

export default function AdminMarketsPage() {
  const [weekId, setWeekId] = useState(defaultWeekId);
  const [markets, setMarkets] = useState<AdminMarketsResponse["markets"]>([]);
  const [weeks, setWeeks] = useState<AdminWeeksResponse["weeks"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<"DRAFT" | "OPEN">("OPEN");
  const [generateResult, setGenerateResult] = useState<GenerateMarketsResponse["result"] | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkActionResponse["result"] | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPosition, setFilterPosition] = useState<string>("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ weekId });
      if (filterStatus)   params.set("status", filterStatus);
      if (filterPosition) params.set("position", filterPosition);

      const [marketsData, weeksData] = await Promise.all([
        apiGet<AdminMarketsResponse>(`/api/admin/markets?${params}`),
        apiGet<AdminWeeksResponse>("/api/admin/weeks")
      ]);
      setMarkets(marketsData.markets);
      setWeeks(weeksData.weeks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [weekId, filterStatus, filterPosition]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function generateMarkets() {
    setIsMutating(true);
    setGenerateResult(null);
    try {
      const data = await apiPost<GenerateMarketsResponse>("/api/admin/markets/generate", {
        weekId,
        initialStatus: generateStatus
      });
      setGenerateResult(data.result);
      setLiveMessage(`Generated ${data.result.marketsCreated} markets.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLiveMessage("Market generation failed.");
    } finally {
      setIsMutating(false);
    }
  }

  async function runBulkAction(action: "OPEN" | "LOCK" | "VOID" | "ARCHIVE") {
    if (confirmAction !== action) {
      setConfirmAction(action);
      return;
    }
    setConfirmAction(null);
    setIsMutating(true);
    setBulkResult(null);
    try {
      const data = await apiPost<BulkActionResponse>("/api/admin/markets/bulk-action", { weekId, action });
      setBulkResult(data.result);
      setLiveMessage(`Bulk ${action}: ${data.result.affected} markets updated.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setIsMutating(false);
    }
  }

  const currentWeek = weeks.find((w) => w.id === weekId);
  const statusCounts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = markets.filter((m) => m.status === s).length;
    return acc;
  }, {});

  return (
    <>
      <PageHeading title="Market Dashboard" kicker="Admin — FX-011">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-xs font-bold text-field hover:underline">← Settlement Admin</a>
          <a href="/admin/weeks" className="text-xs font-bold text-field hover:underline">Week Manager →</a>
        </div>
      </PageHeading>

      {/* ── Week selector ─────────────────────────────────────────── */}
      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">NFL Week</span>
            <select
              className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.season} W{w.week} — {w.status}
                </option>
              ))}
              {weeks.length === 0 && <option value={defaultWeekId}>Week 1 (default)</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">Status filter</span>
            <select
              className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">Position filter</span>
            <select
              className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
            >
              <option value="">All positions</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="h-11 w-full rounded bg-field px-4 text-sm font-black text-white transition hover:bg-field/80 disabled:opacity-50"
              onClick={() => void loadData()}
              disabled={isLoading}
            >
              <RefreshCw className={`inline mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <section className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUSES.map((s) => (
          <div key={s} className="rounded border border-ink/10 bg-white p-3 text-center shadow-soft">
            <p className="text-2xl font-black tabular-nums">{statusCounts[s] ?? 0}</p>
            <p className="mt-0.5 text-xs font-black uppercase tracking-widest text-ink/50">{s}</p>
          </div>
        ))}
      </section>

      {/* ── Week status indicator ───────────────────────────────────── */}
      {currentWeek && (
        <div className="mb-5 flex items-center gap-3 rounded border border-ink/10 bg-white px-4 py-3 shadow-soft">
          <BarChart2 className="h-4 w-4 text-field" aria-hidden />
          <span className="text-sm font-bold">
            {currentWeek.season} Week {currentWeek.week} — {currentWeek.marketCount} markets / {currentWeek.playerCount} players
          </span>
          <span className={weekStatusClass(currentWeek.status)}>{currentWeek.status}</span>
        </div>
      )}

      {/* ── Generate markets panel ──────────────────────────────────── */}
      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft" aria-labelledby="generate-heading">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-field" aria-hidden />
          <h2 id="generate-heading" className="text-sm font-black uppercase tracking-widest">Generate Markets</h2>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MARKET_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded border border-ink/10 bg-chalk p-2.5">
              <p className="text-xs font-black">{t.name}</p>
              <p className="text-xs text-ink/60">{t.description}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <span className="text-xs font-black uppercase tracking-widest text-ink/70">Initial status:</span>
            <select
              className="h-9 rounded border border-ink/15 bg-chalk px-2 text-sm font-black outline-none focus:border-field"
              value={generateStatus}
              onChange={(e) => setGenerateStatus(e.target.value as "DRAFT" | "OPEN")}
            >
              <option value="OPEN">OPEN (live immediately)</option>
              <option value="DRAFT">DRAFT (review before opening)</option>
            </select>
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded bg-field px-5 text-sm font-black text-white transition hover:bg-field/80 disabled:opacity-50"
            disabled={isMutating}
            onClick={() => void generateMarkets()}
          >
            <Zap className="h-4 w-4" aria-hidden />
            {isMutating ? "Generating..." : "Generate All Markets"}
          </button>
        </div>

        {generateResult && (
          <div className="mt-3 rounded border border-field/20 bg-field/5 p-3 text-xs font-bold text-field">
            <p className="mb-1">Generation complete</p>
            <ul className="list-inside list-disc space-y-0.5 font-semibold text-ink/70">
              <li>Players processed: {generateResult.playersProcessed}</li>
              <li>Markets created: {generateResult.marketsCreated}</li>
              <li>Markets skipped (duplicates): {generateResult.marketsSkipped}</li>
              {generateResult.errors.length > 0 && (
                <li className="text-rush">Errors: {generateResult.errors.length} ({generateResult.errors[0]?.error})</li>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* ── Bulk actions ─────────────────────────────────────────────── */}
      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft" aria-labelledby="bulk-heading">
        <h2 id="bulk-heading" className="mb-3 text-sm font-black uppercase tracking-widest">Bulk Actions</h2>
        <div className="flex flex-wrap gap-3">
          {(["OPEN", "LOCK", "VOID", "ARCHIVE"] as const).map((action) => (
            <button
              key={action}
              className={`inline-flex h-10 items-center gap-2 rounded border px-4 text-sm font-black transition disabled:opacity-50 ${
                confirmAction === action
                  ? "border-rush bg-rush text-white"
                  : "border-ink/15 bg-chalk hover:bg-ink/5"
              }`}
              disabled={isMutating}
              onClick={() => void runBulkAction(action)}
            >
              {confirmAction === action ? "Confirm " : ""}
              {action === "OPEN" ? <><Zap className="h-4 w-4" aria-hidden />Open All</> :
               action === "LOCK" ? <><Lock className="h-4 w-4" aria-hidden />Lock All</> :
               action === "VOID" ? <><Trash2 className="h-4 w-4" aria-hidden />Void All</> :
               <><CheckCircle2 className="h-4 w-4" aria-hidden />Archive Week</>}
            </button>
          ))}
          {confirmAction && (
            <button
              className="text-sm font-bold text-ink/50 hover:text-ink"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </button>
          )}
        </div>
        {confirmAction && (
          <p className="mt-2 text-xs font-bold text-rush" role="alert">
            Click again to confirm bulk {confirmAction} for {markets.length} markets in this week.
          </p>
        )}
        {bulkResult && (
          <p className="mt-2 text-xs font-bold text-field">
            {bulkResult.action}: {bulkResult.affected} updated, {bulkResult.skipped} skipped.
          </p>
        )}
      </section>

      {/* ── Market table ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded border border-rush/20 bg-rush/10 p-4 text-sm font-bold text-rush" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm font-bold text-ink/50">Loading markets...</p>
      ) : markets.length === 0 ? (
        <div className="rounded border border-ink/10 bg-white p-8 text-center shadow-soft">
          <p className="text-sm font-bold text-ink/50">No markets found. Use Generate Markets to create the weekly slate.</p>
        </div>
      ) : (
        <section className="rounded border border-ink/10 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink/10 bg-chalk">
                <tr>
                  {["Player", "Position", "Threshold", "Status", "YES", "Volume", "Trades", "Kickoff"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-ink/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {markets.map((m) => (
                  <tr key={m.id} className="hover:bg-chalk/50">
                    <td className="px-4 py-2.5 font-bold">{m.playerName} <span className="text-ink/50 font-semibold">{m.playerTeam}</span></td>
                    <td className="px-4 py-2.5"><span className="rounded bg-field/10 px-2 py-0.5 text-xs font-black text-field">{m.position}</span></td>
                    <td className="px-4 py-2.5 text-xs font-bold">{m.thresholdType.replace("_", " ")}</td>
                    <td className="px-4 py-2.5"><span className={marketStatusClass(m.status)}>{m.status}</span></td>
                    <td className="px-4 py-2.5 font-bold tabular-nums">{(m.yesPrice * 100).toFixed(1)}¢</td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-ink/70">{m.volume.toFixed(0)}</td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-ink/70">{m.tradeCount}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-ink/60">
                      {new Date(m.kickoffTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink/10 px-4 py-3">
            <p className="text-xs font-bold text-ink/50">{markets.length} markets</p>
          </div>
        </section>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic>{liveMessage}</p>
    </>
  );
}

function weekStatusClass(status: string) {
  const base = "rounded px-2 py-1 text-xs font-black";
  if (status === "ACTIVE")   return `${base} bg-field/10 text-field`;
  if (status === "ARCHIVED") return `${base} bg-ink/10 text-ink/60`;
  return `${base} bg-gold/20 text-ink`;
}

function marketStatusClass(status: string) {
  const base = "rounded px-2 py-0.5 text-xs font-black";
  if (status === "OPEN")      return `${base} bg-field/10 text-field`;
  if (status === "LOCKED")    return `${base} bg-gold/20 text-ink`;
  if (status === "SETTLED")   return `${base} bg-ink text-white`;
  if (status === "VOID")      return `${base} bg-rush/10 text-rush`;
  if (status === "DRAFT")     return `${base} bg-ink/10 text-ink/60`;
  if (status === "SCHEDULED") return `${base} bg-ink/10 text-ink/70`;
  return base;
}
