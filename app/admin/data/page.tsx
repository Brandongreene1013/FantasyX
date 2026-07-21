"use client";

import { useEffect, useState } from "react";

interface ProviderStatus {
  provider: {
    name: string;
    mode: string;
    isConfigured: boolean;
    requiresApiKey: boolean;
    hasApiKey: boolean;
    warning?: string;
  };
  cron: {
    cronSecretSet: boolean;
    lastSync: { at: string; durationMs: number | null } | null;
    lastSyncFailed: { at: string; error: string | null } | null;
    lastLiveSync: { at: string; durationMs: number | null } | null;
    lastLiveSyncFailed: { at: string; error: string | null } | null;
    lastKickoffLock: { at: string } | null;
  };
}

interface SyncResult {
  provider?: string;
  players?: { created: number; updated: number };
  games?:   { created: number; updated: number };
  weeks?:   { created: number; updated: number };
  markets?: { created: number; skipped: number };
  teams?:   { total: number };
  errors?:  string[];
  received?: number;
  updated?: number;
  skipped?: number;
}

interface SyncLog {
  at: string;
  op: string;
  providerName: string;
  result: SyncResult;
}

interface OpLog {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

const MODE_COLOR: Record<string, string> = {
  demo: "text-yellow-400",
  live: "text-green-400",
  disabled: "text-red-400"
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-green-400",
  RUNNING: "text-blue-400",
  FAILED: "text-red-400",
  PARTIAL: "text-yellow-400"
};

export default function AdminDataPage() {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [opHistory, setOpHistory] = useState<OpLog[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    loadHistory();
  }, []);

  async function loadStatus() {
    try {
      const res = await fetch("/api/admin/provider-status");
      if (res.ok) setProviderStatus(await res.json());
    } catch { /* non-critical */ }
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/operations/history");
      if (res.ok) {
        const data = await res.json();
        setOpHistory(data.logs ?? []);
      }
    } catch { /* non-critical */ }
  }

  async function getCsrf(): Promise<string> {
    const res = await fetch("/api/auth/csrf");
    const data = await res.json();
    return data.csrfToken as string;
  }

  async function runSync(op: string, label: string) {
    setLoading(label);
    setError(null);
    try {
      const csrf = await getCsrf();
      const res = await fetch("/api/admin/nfl/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ op, season: 2026, week: 1 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncLogs((prev) => [{ at: new Date().toISOString(), op: label, providerName: data.providerName, result: data.result }, ...prev].slice(0, 10));
      await loadStatus();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  const SYNC_ACTIONS = [
    { id: "teams",     label: "Sync Teams",       desc: "Pull NFL team list" },
    { id: "players",   label: "Sync Players",     desc: "Pull active players + statuses" },
    { id: "schedule",  label: "Sync Schedule",    desc: "Pull games + kickoff times" },
    { id: "week",      label: "Sync Current Week",desc: "Sync current week metadata" },
    { id: "live",      label: "Sync Live Scores", desc: "Update score, clock, possession, and game status" },
    { id: "everything",label: "Sync Everything",  desc: "Full sync: teams, players, games, markets" }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">NFL Data Sync</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Manage NFL data provider configuration and sync operations.
        </p>
      </div>

      {/* Provider Status */}
      {providerStatus && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-white">Provider Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded-lg p-3">
              <p className={`text-sm font-bold ${MODE_COLOR[providerStatus.provider.mode] ?? "text-white"}`}>
                {providerStatus.provider.name}
              </p>
              <p className="text-xs text-gray-400">Provider</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className={`text-sm font-bold ${MODE_COLOR[providerStatus.provider.mode] ?? "text-white"}`}>
                {providerStatus.provider.mode.toUpperCase()}
              </p>
              <p className="text-xs text-gray-400">Mode</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className={`text-sm font-bold ${providerStatus.provider.isConfigured ? "text-green-400" : "text-red-400"}`}>
                {providerStatus.provider.isConfigured ? "Ready" : "Not Configured"}
              </p>
              <p className="text-xs text-gray-400">Config</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className={`text-sm font-bold ${providerStatus.cron.cronSecretSet ? "text-green-400" : "text-yellow-400"}`}>
                {providerStatus.cron.cronSecretSet ? "Set" : "Not Set"}
              </p>
              <p className="text-xs text-gray-400">CRON_SECRET</p>
            </div>
          </div>

          {providerStatus.provider.warning && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-2 text-yellow-300 text-xs">
              ⚠ {providerStatus.provider.warning}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-gray-400">
            <div>
              <p className="text-gray-500">Last successful sync</p>
              <p className="text-white mt-0.5">
                {providerStatus.cron.lastSync ? new Date(providerStatus.cron.lastSync.at ?? "").toLocaleString() : "Never"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Last failed sync</p>
              <p className={providerStatus.cron.lastSyncFailed ? "text-red-400 mt-0.5" : "text-white mt-0.5"}>
                {providerStatus.cron.lastSyncFailed ? new Date(providerStatus.cron.lastSyncFailed.at ?? "").toLocaleString() : "None"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Last live-score sync</p>
              <p className={providerStatus.cron.lastLiveSyncFailed ? "text-red-400 mt-0.5" : "text-white mt-0.5"}>
                {providerStatus.cron.lastLiveSync
                  ? new Date(providerStatus.cron.lastLiveSync.at ?? "").toLocaleString()
                  : providerStatus.cron.lastLiveSyncFailed
                    ? "Failed"
                    : "Never"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Last kickoff lock</p>
              <p className="text-white mt-0.5">
                {providerStatus.cron.lastKickoffLock ? new Date(providerStatus.cron.lastKickoffLock.at ?? "").toLocaleString() : "Never"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Provider config */}
      {providerStatus?.provider.mode !== "live" && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-white">Connect a Live Provider</h2>
          <p className="text-sm text-gray-400">
            Set these environment variables to enable live NFL data:
          </p>
          <div className="bg-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1">
            <p><span className="text-yellow-400">NFL_DATA_PROVIDER</span>=sleeper</p>
            <p className="text-gray-500"># beta provider: api-sports (requires API key)</p>
            <p><span className="text-yellow-400">NFL_DATA_API_KEY</span>=your-key-here</p>
            <p className="text-gray-500"># not required for Sleeper (free public API)</p>
            <p><span className="text-yellow-400">CRON_SECRET</span>=a-random-secret</p>
            <p className="text-gray-500"># protects /api/cron/* endpoints</p>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong className="text-white">Sleeper</strong> — Free, no API key. Provides active NFL players + current week state.</p>
            <p><strong className="text-white">API-Sports Beta</strong> — Schedules, live game state, and normalized player box scores.</p>
          </div>
        </div>
      )}

      {/* Sync buttons */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white">Manual Sync</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYNC_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => runSync(action.id, action.label)}
              disabled={loading !== null}
              className="flex flex-col items-start bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 text-left transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-semibold text-white text-sm">
                {loading === action.label ? "Syncing…" : action.label}
              </span>
              <span className="text-xs text-gray-400 mt-1">{action.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Sync result */}
      {syncLogs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Recent Syncs</h2>
          {syncLogs.map((log, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">{log.op}</span>
                <span className="text-xs text-gray-400">{new Date(log.at).toLocaleString()} via {log.providerName}</span>
              </div>
              {log.result && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {log.result.players && <div className="bg-gray-900 rounded p-2 text-center"><p className="text-green-400 font-bold">{log.result.players.created}</p><p className="text-xs text-gray-400">Players+</p></div>}
                  {log.result.players && <div className="bg-gray-900 rounded p-2 text-center"><p className="text-blue-400 font-bold">{log.result.players.updated}</p><p className="text-xs text-gray-400">Players↑</p></div>}
                  {log.result.games && <div className="bg-gray-900 rounded p-2 text-center"><p className="text-green-400 font-bold">{log.result.games.created}</p><p className="text-xs text-gray-400">Games+</p></div>}
                  {log.result.markets && <div className="bg-gray-900 rounded p-2 text-center"><p className="text-green-400 font-bold">{log.result.markets.created}</p><p className="text-xs text-gray-400">Markets+</p></div>}
                  {log.result.markets && <div className="bg-gray-900 rounded p-2 text-center"><p className="text-gray-400 font-bold">{log.result.markets.skipped}</p><p className="text-xs text-gray-400">Skipped</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Operation history */}
      {opHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Operation Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Started</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {opHistory.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800">
                    <td className="py-1.5 pr-4 font-mono text-gray-300">{log.type}</td>
                    <td className={`py-1.5 pr-4 font-bold ${STATUS_COLOR[log.status] ?? "text-white"}`}>{log.status}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{new Date(log.startedAt).toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{log.durationMs != null ? `${log.durationMs}ms` : "—"}</td>
                    <td className="py-1.5 text-red-400 truncate max-w-xs">{log.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provider arch docs */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-lg font-semibold text-white mb-2">Provider Architecture</h2>
        <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300 space-y-1">
          <p className="text-gray-500">{"// lib/nfl-data/provider.ts"}</p>
          <p>{"export interface INflDataProvider {"}</p>
          <p>{"  readonly name: string;"}</p>
          <p>{"  getTeams(): Promise<NflTeam[]>;"}</p>
          <p>{"  getPlayers(): Promise<NflPlayerRecord[]>;"}</p>
          <p>{"  getGames(season, week): Promise<NflGameRecord[]>;"}</p>
          <p>{"  getWeeks(season): Promise<NflWeekRecord[]>;"}</p>
          <p>{"  getSlate(season, week): Promise<NflSlateRecord>;"}</p>
          <p>{"}"}</p>
        </div>
        <div className="mt-3 text-xs text-gray-400 space-y-1">
          <p><strong className="text-white">Implementations:</strong></p>
          <p>• <code className="bg-gray-800 px-1 rounded">DemoNflDataProvider</code> — bundled static data (default)</p>
          <p>• <code className="bg-gray-800 px-1 rounded">SleeperNflDataProvider</code> — free Sleeper API (players + week state)</p>
          <p>• <code className="bg-gray-800 px-1 rounded">ApiSportsNflProvider</code> — API-Sports beta (schedule + live player stats, requires API key)</p>
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        <a href="/admin" className="text-blue-400 hover:underline">← Admin Home</a>
        <a href="/admin/weeks" className="text-blue-400 hover:underline">Weeks</a>
        <a href="/admin/markets" className="text-blue-400 hover:underline">Markets</a>
        <a href="/admin/scoring" className="text-blue-400 hover:underline">Scoring & Settlement</a>
      </div>
    </div>
  );
}
