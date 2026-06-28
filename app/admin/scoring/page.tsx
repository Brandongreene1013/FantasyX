"use client";

import { useState, useRef } from "react";

interface ImportResult {
  importId: string;
  weekId: string;
  rowCount: number;
  importedCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  unknownPlayers: string[];
}

interface PreviewMarket {
  marketId: string;
  thresholdType: string;
  status: string;
  yesWins: boolean;
  totalPositions: number;
  totalPayout: number;
  volume: number;
}

interface PreviewItem {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  fantasyPoints: number;
  positionalRank: number;
  overallRank: number | null;
  markets: PreviewMarket[];
  warnings: string[];
}

interface SettlementPreview {
  weekId: string;
  generatedAt: string;
  totalPlayers: number;
  totalMarkets: number;
  totalPositions: number;
  estimatedPayout: number;
  alreadySettled: number;
  items: PreviewItem[];
}

interface BatchResult {
  weekId: string;
  playersSettled: number;
  marketsSettled: number;
  skipped: number;
  errors: Array<{ playerId: string; message: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "text-green-400",
  LOCKED: "text-yellow-400",
  SETTLED: "text-blue-400",
  VOID: "text-red-400",
  DRAFT: "text-gray-400"
};

export default function AdminScoringPage() {
  const [weekId, setWeekId] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function getCsrf(): Promise<string> {
    const res = await fetch("/api/auth/csrf");
    if (!res.ok) throw new Error("Could not get CSRF token");
    const data = await res.json();
    return data.csrfToken as string;
  }

  async function handleImport() {
    if (!weekId.trim()) { setError("Enter a week ID first"); return; }
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a CSV file to upload"); return; }

    setLoading("import");
    setError(null);
    setImportResult(null);
    setPreview(null);
    setBatchResult(null);

    try {
      const csrf = await getCsrf();
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/admin/scoring/import?weekId=${encodeURIComponent(weekId)}`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: form
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  async function handlePreview() {
    if (!weekId.trim()) { setError("Enter a week ID"); return; }
    setLoading("preview");
    setError(null);
    setPreview(null);
    setBatchResult(null);

    try {
      const res = await fetch(`/api/admin/scoring/preview/${encodeURIComponent(weekId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  async function handleApprove() {
    setShowConfirm(false);
    setLoading("approve");
    setError(null);
    setBatchResult(null);

    try {
      const csrf = await getCsrf();
      const res = await fetch("/api/admin/scoring/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ weekId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approval failed");
      setBatchResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  async function handleKickoffLock() {
    if (!weekId.trim()) { setError("Enter a week ID"); return; }
    setLoading("lock");
    setError(null);

    try {
      const csrf = await getCsrf();
      const res = await fetch("/api/admin/markets/lock-by-kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ weekId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lock failed");
      setError(null);
      alert(`Locked ${data.result.locked} markets past kickoff.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  const CSV_TEMPLATE = "player_name,team,position,pass_yards,pass_tds,interceptions,rush_yards,rush_tds,receptions,rec_yards,rec_tds,fumbles,two_point_conv\nPatrick Mahomes,KC,QB,312,2,0,18,0,0,0,0,0,0\nCMC,SF,RB,0,0,0,110,1,6,52,0,0,0";

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fx_scoring_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Scoring Import & Settlement</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Import weekly fantasy scores, preview settlement outcomes, and approve batch settlement.
        </p>
      </div>

      {/* Week ID + Kickoff Lock */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-white">1. Select Week</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Week ID (e.g. nfl_2026_w1)"
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 text-sm flex-1 min-w-[220px]"
          />
          <button
            onClick={handleKickoffLock}
            disabled={loading !== null}
            className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading === "lock" ? "Locking…" : "Lock Markets Past Kickoff"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Lock Markets Past Kickoff immediately locks all OPEN markets where kickoff time has passed. Trading is already
          rejected server-side for these markets, but this updates their status for UI accuracy.
        </p>
      </div>

      {/* CSV Upload */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">2. Import Scores (CSV)</h2>
          <button onClick={downloadTemplate} className="text-xs text-blue-400 hover:underline">
            Download Template
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 font-mono">
            player_name, team, position, pass_yards, pass_tds, interceptions, rush_yards, rush_tds,
            receptions, rec_yards, rec_tds, fumbles, two_point_conv
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Or use <code>player_id</code> instead of <code>player_name</code> for exact matching.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 space-y-1">
          <p className="text-xs text-gray-400 font-semibold">Half-PPR Scoring:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-400">
            <span>Pass: 1pt/25 yd, 4pt TD, -2pt INT</span>
            <span>Rush: 1pt/10 yd, 6pt TD</span>
            <span>Rec: 0.5pt catch, 1pt/10 yd, 6pt TD</span>
            <span>Fumble: -2pt</span>
            <span>2-pt conversion: 2pt</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="text-sm text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white file:text-sm" />
          <button
            onClick={handleImport}
            disabled={loading !== null}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading === "import" ? "Importing…" : "Import CSV"}
          </button>
        </div>

        {importResult && (
          <div className={`rounded-lg border p-4 space-y-2 ${importResult.importedCount > 0 ? "border-green-700 bg-green-900/20" : "border-red-700 bg-red-900/20"}`}>
            <div className="flex gap-4 text-sm">
              <span className="text-green-400 font-semibold">✓ {importResult.importedCount} players imported</span>
              {importResult.errorCount > 0 && <span className="text-red-400">{importResult.errorCount} errors</span>}
              {importResult.unknownPlayers.length > 0 && <span className="text-yellow-400">{importResult.unknownPlayers.length} unknown players</span>}
            </div>
            {importResult.errors.length > 0 && (
              <ul className="text-xs text-red-300 space-y-0.5 max-h-32 overflow-y-auto">
                {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
            {importResult.unknownPlayers.length > 0 && (
              <p className="text-xs text-yellow-300">Unknown: {importResult.unknownPlayers.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {/* Settlement Preview */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">3. Settlement Preview</h2>
          <button
            onClick={handlePreview}
            disabled={loading !== null}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading === "preview" ? "Generating…" : "Generate Preview"}
          </button>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Players",       value: preview.totalPlayers,    color: "text-blue-400" },
                { label: "Markets",       value: preview.totalMarkets,    color: "text-blue-400" },
                { label: "Positions",     value: preview.totalPositions,  color: "text-white" },
                { label: "Est. Payout",   value: `${preview.estimatedPayout.toFixed(1)} cr`, color: "text-green-400" },
                { label: "Already Settled", value: preview.alreadySettled, color: preview.alreadySettled > 0 ? "text-yellow-400" : "text-gray-500" }
              ].map((s) => (
                <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                    <th className="pb-2 pr-4">Player</th>
                    <th className="pb-2 pr-4">Pos</th>
                    <th className="pb-2 pr-4">Pts</th>
                    <th className="pb-2 pr-4">Rank</th>
                    <th className="pb-2 pr-4">Markets</th>
                    <th className="pb-2">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.playerId} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 pr-4 font-medium text-white">{item.playerName} <span className="text-gray-500 text-xs">{item.team}</span></td>
                      <td className="py-2 pr-4 text-gray-300">{item.position}</td>
                      <td className="py-2 pr-4 text-white">{item.fantasyPoints.toFixed(1)}</td>
                      <td className="py-2 pr-4 text-white">#{item.positionalRank}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {item.markets.map((m) => (
                            <span
                              key={m.marketId}
                              className={`text-xs px-2 py-0.5 rounded-full ${m.yesWins ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
                            >
                              {m.thresholdType} {m.yesWins ? "YES" : "NO"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2">
                        {item.warnings.length > 0 && (
                          <span className="text-xs text-yellow-400">⚠ {item.warnings[0]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!showConfirm && !batchResult && (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-6 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-white font-semibold transition"
              >
                Approve Settlement →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Approval Confirmation */}
      {showConfirm && (
        <div className="bg-gray-900 border border-yellow-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-yellow-400">4. Confirm Settlement</h2>
          <p className="text-sm text-gray-300">
            This will settle all eligible markets for week <strong>{weekId}</strong> based on the imported scores.
            Payouts will be credited to winning positions. <strong>This cannot be undone.</strong>
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="px-6 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-white font-semibold transition disabled:opacity-50"
            >
              {loading === "approve" ? "Settling…" : "Confirm & Settle All"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Batch Result */}
      {batchResult && (
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-green-400">Settlement Complete</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xl font-bold text-green-400">{batchResult.playersSettled}</p>
              <p className="text-xs text-gray-400">Players Settled</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xl font-bold text-blue-400">{batchResult.marketsSettled}</p>
              <p className="text-xs text-gray-400">Markets Settled</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-400">{batchResult.skipped}</p>
              <p className="text-xs text-gray-400">Skipped</p>
            </div>
          </div>
          {batchResult.errors.length > 0 && (
            <div className="text-xs text-red-300 space-y-1">
              <p className="text-red-400 font-semibold">Errors:</p>
              {batchResult.errors.map((e, i) => <p key={i}>{e.playerId}: {e.message}</p>)}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-3 text-sm">
        <a href="/admin" className="text-blue-400 hover:underline">← Admin Home</a>
        <a href="/admin/data" className="text-blue-400 hover:underline">Data Sync</a>
        <a href="/admin/markets" className="text-blue-400 hover:underline">Markets</a>
        <a href="/admin/weeks" className="text-blue-400 hover:underline">Weeks</a>
      </div>
    </div>
  );
}
