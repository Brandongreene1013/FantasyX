"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Database, Lock, RefreshCw, Unlock } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { getNoPrice, getYesPrice } from "@/lib/amm";
import { apiGet, apiPost, defaultWeekId, type NflStatsResponse, type NflSyncResponse, type SessionResponse, type SlateResponse } from "@/lib/client-api";
import { pct, thresholdLabel } from "@/lib/format";
import type { Player } from "@/lib/types";

type SlateMarket = SlateResponse["markets"][number];

export default function AdminPage() {
  const [weekId, setWeekId] = useState(defaultWeekId);
  const [session, setSession] = useState<SessionResponse["user"]>(null);
  const [slate, setSlate] = useState<SlateResponse | null>(null);
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [nflStats, setNflStats] = useState<NflStatsResponse["stats"] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<NflSyncResponse["result"] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadSlate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSlate(await apiGet<SlateResponse>(`/api/slate?weekId=${weekId}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load admin slate");
    } finally {
      setIsLoading(false);
    }
  }, [weekId]);

  const loadNflStats = useCallback(async () => {
    try {
      const data = await apiGet<NflStatsResponse>("/api/admin/nfl/stats");
      setNflStats(data.stats);
    } catch {
      // non-critical; silently ignore
    }
  }, []);

  useEffect(() => {
    apiGet<SessionResponse>("/api/session").then((data) => setSession(data.user)).catch(() => setSession(null));
    void loadSlate();
    void loadNflStats();
  }, [loadSlate, loadNflStats]);

  async function syncDemoData() {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const data = await apiPost<NflSyncResponse>("/api/admin/nfl/sync-demo", {});
      setSyncResult(data.result);
      setLiveMessage("Demo NFL data synced successfully.");
      void loadNflStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncError(msg);
      setLiveMessage(msg);
    } finally {
      setIsSyncing(false);
    }
  }

  const markets = useMemo(() => slate?.markets ?? [], [slate]);
  const playerMap = useMemo(() => new Map((slate?.players ?? []).map((player) => [player.id, player])), [slate]);
  const playerRows = useMemo(() => {
    const playerIds = Array.from(new Set(markets.map((market) => market.playerId)));
    return playerIds
      .map((playerId) => ({
        player: playerMap.get(playerId),
        markets: markets.filter((market) => market.playerId === playerId)
      }))
      .filter((row): row is { player: Player; markets: SlateMarket[] } => Boolean(row.player))
      .sort((a, b) => a.player.position.localeCompare(b.player.position) || a.player.name.localeCompare(b.player.name));
  }, [markets, playerMap]);

  function updateRank(playerId: string, value: number) {
    setRanks((current) => ({ ...current, [playerId]: value }));
  }

  async function mutate(body: unknown) {
    setIsMutating(true);
    setError(null);
    try {
      await apiPost("/api/settlements", body);
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      setLiveMessage("Admin action completed. Markets updated.");
      await loadSlate();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Admin action failed";
      setError(message);
      setLiveMessage(message);
    } finally {
      setIsMutating(false);
    }
  }

  function settlePlayer(playerId: string) {
    const rank = ranks[playerId];
    if (!rank || rank < 1) {
      return;
    }
    void mutate({
      action: "SETTLE_PLAYER",
      playerId,
      weekId,
      rank,
      reason: reason || undefined
    });
  }

  return (
    <>
      <PageHeading title="Settlement Admin" kicker="Manual MVP tool">
        <span>Enter final half-PPR positional ranks, settle all thresholds, and credit winning shares.</span>
      </PageHeading>

      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[18rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">NFL week</span>
          <select
            className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
            onChange={(event) => setWeekId(event.target.value)}
            aria-describedby="admin-week-help"
            value={weekId}
          >
            <option value="nfl_2026_w1">Week 1</option>
          </select>
          <span id="admin-week-help" className="mt-1 block text-xs font-semibold text-ink/70">Choose the NFL week to review and settle.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">Admin reason</span>
          <input
            className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional audit note"
            type="text"
            value={reason}
          />
          <span className="mt-1 block text-xs font-semibold text-ink/70">Stored immutably on admin audit records.</span>
        </label>
        </div>
      </section>

      {/* ── NFL Data Section ─────────────────────────────────────────────── */}
      <section className="mb-5 rounded border border-ink/10 bg-white p-4 shadow-soft" aria-labelledby="nfl-data-heading">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-field" aria-hidden />
          <h2 id="nfl-data-heading" className="text-sm font-black uppercase tracking-widest">NFL Data</h2>
        </div>

        {nflStats ? (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox label="Weeks"   value={nflStats.weeks} />
            <StatBox label="Players" value={nflStats.players} />
            <StatBox label="Games"   value={nflStats.games} />
            <StatBox label="Markets" value={nflStats.markets} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded bg-field px-4 text-sm font-black text-white transition hover:bg-field/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSyncing}
            onClick={() => void syncDemoData()}
            type="button"
            aria-describedby="sync-demo-help"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden />
            {isSyncing ? "Syncing…" : "Sync Demo NFL Data"}
          </button>
          <span id="sync-demo-help" className="text-xs font-semibold text-ink/60">
            Idempotent — safe to run multiple times. Does not affect ledger, trades, or settlement.
          </span>
        </div>

        {syncError ? (
          <p className="mt-3 text-xs font-bold text-rush" role="alert">{syncError}</p>
        ) : null}

        {syncResult ? (
          <div className="mt-3 rounded border border-field/20 bg-field/5 p-3 text-xs font-bold text-field">
            <p className="mb-1">Sync complete — provider: {syncResult.provider}</p>
            <ul className="list-inside list-disc space-y-0.5 font-semibold text-ink/70">
              <li>Weeks: {syncResult.weeks.created} created, {syncResult.weeks.updated} updated</li>
              <li>Players: {syncResult.players.created} created, {syncResult.players.updated} updated</li>
              <li>Games: {syncResult.games.created} created, {syncResult.games.updated} updated</li>
              <li>Markets: {syncResult.markets.created} created, {syncResult.markets.skipped} skipped (existing)</li>
            </ul>
          </div>
        ) : null}
      </section>

      {/* ── Settlement Section ────────────────────────────────────────────── */}
      {isLoading ? <StatePanel text="Loading markets for settlement..." /> : null}
      {error ? <StatePanel text={error} tone="error" actionLabel="Retry" onAction={loadSlate} /> : null}
      {!isLoading && session && !session.isAdmin ? <StatePanel text="Admin access is required for settlement tools." tone="error" /> : null}
      {!isLoading && !error && playerRows.length === 0 ? <StatePanel text="No markets found for this week." /> : null}

      <section className="grid gap-4 pb-20">
        {!isLoading && !error && session?.isAdmin
          ? playerRows.map(({ player, markets: playerMarkets }) => {
              const rank = ranks[player.id] ?? "";
              return (
                <article className="rounded border border-ink/10 bg-white p-4 shadow-soft" key={player.id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{player.position}</span>
                        <span className="text-xs font-bold text-ink/70">{player.team}</span>
                        <span className="text-xs font-bold text-ink/70">{player.team} vs {player.opponent}</span>
                      </div>
                      <h2 className="mt-2 text-xl font-black">{player.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-ink/70">
                        Rank 3 or better settles Top 3 YES. Rank 5 or better settles Top 5 YES. Rank 10 or better settles Top 10 YES.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <label>
                        <span className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">Final fantasy rank</span>
                        <input
                          className="h-11 w-full rounded border border-ink/15 bg-chalk px-3 text-sm font-black outline-none focus:border-field"
                          min={1}
                          onChange={(event) => updateRank(player.id, Number(event.target.value))}
                          placeholder={`${player.position} rank`}
                          aria-describedby={`rank-help-${player.id}`}
                          type="number"
                          value={rank}
                        />
                        <span id={`rank-help-${player.id}`} className="mt-1 block text-xs font-semibold text-ink/70">Enter the player&apos;s final weekly rank at {player.position}.</span>
                      </label>
                      <button
                        className="inline-flex h-11 items-center justify-center gap-2 rounded bg-ink px-4 text-sm font-black text-white transition hover:bg-field disabled:cursor-not-allowed disabled:bg-ink/30"
                        disabled={!rank || isMutating}
                        onClick={() => settlePlayer(player.id)}
                        type="button"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        {isMutating ? "Working..." : "Settle player markets"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {playerMarkets
                      .slice()
                      .sort((a, b) => thresholdOrder(a) - thresholdOrder(b))
                      .map((market) => (
                        <MarketSettlementCard
                          key={market.id}
                          isMutating={isMutating}
                          market={market}
                          onLock={() => mutate({ action: "LOCK_MARKET", marketId: market.id, reason: reason || undefined })}
                          onOpen={() => mutate({ action: "OPEN_MARKET", marketId: market.id, reason: reason || undefined })}
                          onVoid={() => mutate({ action: "VOID_MARKET", marketId: market.id, reason: reason || undefined })}
                        />
                      ))}
                  </div>
                </article>
              );
            })
          : null}
      </section>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>
    </>
  );
}

function MarketSettlementCard({
  market,
  isMutating,
  onLock,
  onOpen,
  onVoid
}: {
  market: SlateMarket;
  isMutating: boolean;
  onLock: () => void;
  onOpen: () => void;
  onVoid: () => void;
}) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">{thresholdLabel(market.threshold)}</p>
          <p className="text-xs font-bold text-ink/70">YES {pct(getYesPrice(market))} / NO {pct(getNoPrice(market))}</p>
        </div>
        <span className={statusClass(market.status)}>{market.status}</span>
      </div>
      <p className="mt-3 text-sm font-bold">Result: {market.result ?? "Pending"}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="rounded border border-ink/10 bg-white px-2 py-2 text-xs font-black hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isMutating || market.status === "SETTLED" || market.status === "VOID" || market.status === "LOCKED"}
          onClick={onLock}
          type="button"
        >
          <Lock className="mx-auto mb-1 h-4 w-4" aria-hidden />
          Lock
        </button>
        <button
          className="rounded border border-rush/20 bg-rush/10 px-2 py-2 text-xs font-black text-rush hover:bg-rush/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isMutating || market.status === "SETTLED" || market.status === "VOID"}
          onClick={onVoid}
          type="button"
        >
          <Ban className="mx-auto mb-1 h-4 w-4" aria-hidden />
          Void
        </button>
        <button
          className="rounded border border-ink/10 bg-white px-2 py-2 text-xs font-black hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isMutating || market.status !== "LOCKED"}
          onClick={onOpen}
          type="button"
        >
          <Unlock className="mx-auto mb-1 h-4 w-4" aria-hidden />
          Open
        </button>
      </div>
    </div>
  );
}

function thresholdOrder(market: SlateMarket) {
  if (market.threshold === "TOP_3") {
    return 3;
  }
  if (market.threshold === "TOP_5") {
    return 5;
  }
  return 10;
}

function statusClass(status: SlateMarket["status"]) {
  const base = "rounded px-2 py-1 text-xs font-black";
  if (status === "OPEN") {
    return `${base} bg-field/10 text-field`;
  }
  if (status === "LOCKED") {
    return `${base} bg-gold/20 text-ink`;
  }
  if (status === "VOID") {
    return `${base} bg-rush/10 text-rush`;
  }
  return `${base} bg-ink text-white`;
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3 text-center">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-black uppercase tracking-widest text-ink/50">{label}</p>
    </div>
  );
}

function StatePanel({ text, tone = "default", actionLabel, onAction }: { text: string; tone?: "default" | "error"; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className={tone === "error" ? "mb-4 rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush" : "mb-4 rounded border border-ink/10 bg-white p-5 text-sm font-bold text-ink/70 shadow-soft"}>
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="mt-3 rounded bg-ink px-4 py-2 text-xs font-black text-white hover:bg-field" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
