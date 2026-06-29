"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft, Clock, TrendingUp, ShieldCheck, AlertTriangle,
  BarChart2, Activity, Zap, Target, ChevronRight
} from "lucide-react";
import { TradePanel } from "@/components/trade-panel";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { getPositionColor } from "@/lib/team-colors";
import { apiGet } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { PlayerDetailResponse, PortfolioResponse } from "@/lib/client-api";

export default function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const [playerId,      setPlayerId]      = useState<string | null>(null);
  const [detail,        setDetail]        = useState<PlayerDetailResponse | null>(null);
  const [balance,       setBalance]       = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);

  useEffect(() => { void params.then((p) => setPlayerId(p.playerId)); }, [params]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true); setError(null);
    try {
      const [pd, pf] = await Promise.all([
        apiGet<PlayerDetailResponse>(`/api/players/${id}`),
        apiGet<PortfolioResponse>("/api/portfolio")
      ]);
      setDetail(pd); setBalance(pf.user.mockBalance);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load player"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (playerId) void load(playerId); }, [playerId, load]);

  if (isLoading) return <div className="space-y-4"><BackLink /><LoadingFeed count={3} /></div>;
  if (error || !detail) return <div className="space-y-4"><BackLink /><ErrorState message={error ?? "Player not found."} onRetry={playerId ? () => void load(playerId) : undefined} /></div>;

  const { player, markets, sentiment, intelligence } = detail;
  const activeMarket = markets.find((m) => m.id === activeMarketId) ?? null;
  const posColor = getPositionColor(player.position);

  const injuryColor = {
    ACTIVE:       "text-neon",
    QUESTIONABLE: "text-amber",
    DOUBTFUL:     "text-crimson",
    OUT:          "text-crimson"
  }[intelligence.injuryStatus] ?? "text-muted";

  const InjuryIcon = intelligence.injuryStatus === "ACTIVE" ? ShieldCheck : AlertTriangle;

  return (
    <div className="space-y-4 pb-6">
      <BackLink />

      {/* Player hero */}
      <div className="rounded-2xl border border-rim bg-panel overflow-hidden card-depth">
        <div className="h-1 w-full" style={{ background: posColor.text }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <PlayerAvatar name={player.name} team={player.team} position={player.position} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: posColor.bg, color: posColor.text }}>{player.position}</span>
                <span className="text-xs font-bold text-steel">{player.team}</span>
                {player.opponent && <span className="text-xs text-muted">vs {player.opponent}</span>}
                <span className={`flex items-center gap-1 text-[10px] font-black ${injuryColor}`}>
                  <InjuryIcon className="h-3 w-3" aria-hidden />{intelligence.injuryStatus}
                </span>
              </div>
              <h1 className="text-2xl font-black text-frost leading-tight">{player.name}</h1>
              <p className="text-xs font-semibold text-muted mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3" aria-hidden />
                Kickoff {new Date(player.kickoff).toLocaleString()}
              </p>
            </div>
            {/* Projected pts */}
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">Projected</p>
              <p className="text-3xl font-black text-neon">{intelligence.projectedPoints}</p>
              <p className="text-[10px] font-semibold text-muted">pts</p>
            </div>
          </div>

          {/* Quick stat strip */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <QuickStat label="Confidence" value={`${intelligence.confidenceScore}%`} icon={<Target className="h-3 w-3" />} />
            <QuickStat label="Proj. Rank" value={intelligence.projectedRank} icon={<TrendingUp className="h-3 w-3" />} />
            <QuickStat label="Vol (all mkts)" value={sentiment ? credits(sentiment.totalVolume) : "—"} icon={<BarChart2 className="h-3 w-3" />} />
          </div>
        </div>
      </div>

      {/* Markets */}
      <section aria-label="Player markets">
        <h2 className="text-sm font-black text-frost mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-neon" aria-hidden />
          Markets
        </h2>
        {markets.length === 0 ? (
          <div className="rounded-xl border border-rim bg-panel px-4 py-6 text-center text-sm font-semibold text-muted">
            No markets for this player this week.
          </div>
        ) : (
          <div className="space-y-2">
            {markets.map((market) => (
              <PlayerMarketRow
                key={market.id}
                market={market}
                isActive={activeMarketId === market.id}
                onTrade={() => setActiveMarketId(activeMarketId === market.id ? null : market.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inline trade panel */}
      {activeMarket && (
        <div className="animate-slide-up">
          <TradePanel
            market={activeMarket}
            player={{ id: player.id, name: player.name, team: player.team, position: player.position, opponent: player.opponent, kickoff: player.kickoff, projection: intelligence.projectedPoints }}
            balance={balance}
            onTradeComplete={() => { void load(playerId!); setActiveMarketId(null); }}
          />
        </div>
      )}

      {/* Intelligence + Sentiment grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Intelligence */}
        <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Player intelligence">
          <h2 className="flex items-center gap-2 text-sm font-black text-frost mb-3">
            <TrendingUp className="h-4 w-4 text-charge" aria-hidden /> Intelligence
          </h2>
          <div className="space-y-2">
            <IntelRow label="Projected rank"  value={intelligence.projectedRank} />
            <IntelRow label="Confidence"      value={`${intelligence.confidenceScore}%`} />
            <IntelRow label="Projected pts"   value={`${intelligence.projectedPoints} pts`} />
            <IntelRow label="Injury status"   value={intelligence.injuryStatus} valueClass={injuryColor} />
          </div>
          <div className="mt-3 rounded-lg bg-panel2 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted mb-1">Matchup Notes</p>
            <p className="text-sm font-semibold text-steel">{intelligence.matchupNotes}</p>
          </div>
          <p className="mt-3 text-[10px] font-semibold text-muted/60">Demo projection model · live NFL stats in a future sprint</p>
        </section>

        {/* Market sentiment */}
        {sentiment ? (
          <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Market sentiment">
            <h2 className="flex items-center gap-2 text-sm font-black text-frost mb-3">
              <Activity className="h-4 w-4 text-neon" aria-hidden /> Market Sentiment
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <SentStat label="Avg YES price"   value={pct(sentiment.avgYesPrice)} />
              <SentStat label="Total volume"    value={credits(sentiment.totalVolume)} />
              <SentStat label="Open interest"   value={sentiment.totalOpenInterest.toFixed(1)} />
              <SentStat label="Markets"         value={`${markets.length}`} />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-neon/8 border border-neon/15 px-3 py-2">
                <p className="text-[10px] font-black text-neon">Highest Confidence</p>
                <p className="text-xs font-black text-frost">{thresholdLabel(sentiment.highestConfidenceMarket.threshold)} · {pct(sentiment.highestConfidenceMarket.yesPrice)}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-crimson/8 border border-crimson/15 px-3 py-2">
                <p className="text-[10px] font-black text-crimson">Lowest Confidence</p>
                <p className="text-xs font-black text-frost">{thresholdLabel(sentiment.lowestConfidenceMarket.threshold)} · {pct(sentiment.lowestConfidenceMarket.yesPrice)}</p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* Historical performance */}
      <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Historical performance">
        <h2 className="flex items-center gap-2 text-sm font-black text-frost mb-3">
          <BarChart2 className="h-4 w-4 text-amber" aria-hidden /> Historical Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim">
                <th className="pb-2 text-left text-[10px] font-black uppercase tracking-wider text-muted">Week</th>
                <th className="pb-2 text-right text-[10px] font-black uppercase tracking-wider text-muted">Finish</th>
                <th className="pb-2 text-right text-[10px] font-black uppercase tracking-wider text-muted">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rim/40">
              {intelligence.historicalFinishes.map((row) => (
                <tr key={row.week}>
                  <td className="py-2 text-xs font-semibold text-muted">Week {row.week}</td>
                  <td className="py-2 text-right text-sm font-black text-frost">#{row.finish}</td>
                  <td className="py-2 text-right text-xs font-semibold text-steel">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intelligence.historicalFinishes.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-rim/40 pt-3">
            <HistStat label="Avg pts" value={avgPoints(intelligence.historicalFinishes)} />
            <HistStat label="Best finish" value={`#${Math.min(...intelligence.historicalFinishes.map((r) => r.finish))}`} tone="positive" />
            <HistStat label="Worst finish" value={`#${Math.max(...intelligence.historicalFinishes.map((r) => r.finish))}`} tone="negative" />
          </div>
        )}
        <p className="mt-3 text-[10px] font-semibold text-muted/60">Demo performance history · live integration in a future sprint</p>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/markets" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-frost transition-colors" aria-label="Back to markets">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Markets
    </Link>
  );
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-panel2 px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted mb-0.5">{icon}<span className="text-[9px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-sm font-black text-frost">{value}</p>
    </div>
  );
}

function PlayerMarketRow({ market, isActive, onTrade }: {
  market: PlayerDetailResponse["markets"][number]; isActive: boolean; onTrade: () => void;
}) {
  const isOpen = market.status === "OPEN";
  return (
    <div className={`rounded-xl border transition-all ${isActive ? "border-neon/30 bg-neon/5" : "border-rim bg-panel"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-frost">{thresholdLabel(market.threshold)}</p>
          <p className="text-[10px] font-semibold text-muted">{market.status}{market.result ? ` · ${market.result}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-neon/25 bg-neon/8 px-2.5 py-1 text-xs font-black text-neon">{pct(market.yesPrice)}</span>
          <span className="rounded-lg border border-crimson/25 bg-crimson/8 px-2.5 py-1 text-xs font-black text-crimson">{pct(market.noPrice)}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <Link href={`/markets/${market.id}` as Route} className="p-1.5 text-muted hover:text-frost transition-colors" aria-label={`View detail for ${thresholdLabel(market.threshold)}`}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          {isOpen && (
            <button
              type="button"
              onClick={onTrade}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition-all ${isActive ? "bg-rim text-muted" : "bg-neon/10 text-neon border border-neon/25 hover:bg-neon/20"}`}
            >
              {isActive ? "Cancel" : "Trade"}
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-rim/40 px-4 py-2 flex gap-4 text-[10px] font-semibold text-muted">
        <span>Pool {credits(market.liquidity)}</span>
        <span>Vol {credits(market.volume)}</span>
        <span>OI {Number(market.openInterest).toFixed(1)}</span>
      </div>
    </div>
  );
}

function IntelRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-panel2 px-3 py-2">
      <span className="text-[10px] font-bold text-muted">{label}</span>
      <span className={`text-sm font-black ${valueClass || "text-frost"}`}>{value}</span>
    </div>
  );
}

function SentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel2 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-black text-frost">{value}</p>
    </div>
  );
}

function HistStat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-neon" : tone === "negative" ? "text-crimson" : "text-frost";
  return (
    <div className="rounded-lg bg-panel2 p-2.5 text-center">
      <p className="text-[9px] font-bold text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

function avgPoints(finishes: Array<{ points: number }>) {
  if (!finishes.length) return "—";
  return `${(finishes.reduce((s, r) => s + r.points, 0) / finishes.length).toFixed(1)}`;
}
