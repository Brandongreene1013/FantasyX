"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart2, Clock, ShieldCheck, AlertTriangle, Target, TrendingUp, Zap } from "lucide-react";
import { MarketTimeline } from "@/components/market-timeline";
import { PlayerMarketChart } from "@/components/player-market-chart";
import { MarketTimeRangeSelector, PlayerThresholdSelector, type MarketTimeRange } from "@/components/player-market-controls";
import { TradePanel } from "@/components/trade-panel";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { getPositionColor } from "@/lib/team-colors";
import { apiGet } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { PlayerDetailResponse } from "@/lib/client-api";
import type { Threshold } from "@/lib/types";

const THRESHOLD_PRIORITY: Threshold[] = ["TOP_5", "TOP_10", "TOP_3"];
export default function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedThreshold = searchParams.get("threshold") as Threshold | null;

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<MarketTimeRange>("ALL");

  useEffect(() => { void params.then((p) => setPlayerId(p.playerId)); }, [params]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      setDetail(await apiGet<PlayerDetailResponse>(`/api/players/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load player");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (playerId) void load(playerId); }, [playerId, load]);

  const availableThresholds = useMemo(() => new Set((detail?.markets ?? []).map((market) => market.threshold)), [detail]);
  const selectedThreshold = useMemo(() => {
    if (requestedThreshold && availableThresholds.has(requestedThreshold)) return requestedThreshold;
    return THRESHOLD_PRIORITY.find((threshold) => availableThresholds.has(threshold)) ?? detail?.markets[0]?.threshold ?? "TOP_5";
  }, [availableThresholds, detail?.markets, requestedThreshold]);

  useEffect(() => {
    if (!detail || detail.markets.length === 0) return;
    if (requestedThreshold === selectedThreshold) return;
    const paramsForUrl = new URLSearchParams(searchParams.toString());
    paramsForUrl.set("threshold", selectedThreshold);
    router.replace(`${pathname}?${paramsForUrl.toString()}` as Route, { scroll: false });
  }, [detail, pathname, requestedThreshold, router, searchParams, selectedThreshold]);

  if (isLoading) return <div className="space-y-4"><BackLink /><LoadingFeed count={3} /></div>;
  if (error || !detail) return <div className="space-y-4"><BackLink /><ErrorState message={error ?? "Player not found."} onRetry={playerId ? () => void load(playerId) : undefined} /></div>;

  const { player, markets, sentiment, intelligence, account } = detail;
  const selectedMarket = markets.find((market) => market.threshold === selectedThreshold) ?? markets[0] ?? null;
  const posColor = getPositionColor(player.position);
  const injuryColor = {
    ACTIVE: "text-neon",
    QUESTIONABLE: "text-amber",
    DOUBTFUL: "text-crimson",
    OUT: "text-crimson"
  }[intelligence.injuryStatus] ?? "text-muted";
  const InjuryIcon = intelligence.injuryStatus === "ACTIVE" ? ShieldCheck : AlertTriangle;

  function changeThreshold(threshold: Threshold) {
    const paramsForUrl = new URLSearchParams(searchParams.toString());
    paramsForUrl.set("threshold", threshold);
    router.push(`${pathname}?${paramsForUrl.toString()}` as Route, { scroll: false });
  }

  return (
    <div className="space-y-4 pb-6">
      <BackLink />

      <div className="rounded-2xl border border-rim bg-panel overflow-hidden card-depth">
        <div className="h-1 w-full" style={{ background: posColor.text }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <PlayerAvatar name={player.name} team={player.team} position={player.position} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded px-2 py-0.5 text-[10px] font-black" style={{ background: posColor.bg, color: posColor.text }}>{player.position}</span>
                <span className="text-xs font-bold text-steel">{player.team}</span>
                {player.opponent && <span className="text-xs text-muted">vs {player.opponent}</span>}
                <span className={`flex items-center gap-1 text-[10px] font-black ${injuryColor}`}>
                  <InjuryIcon className="h-3 w-3" aria-hidden />{intelligence.injuryStatus}
                </span>
              </div>
              <h1 className="text-2xl font-black leading-tight text-frost">{player.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Clock className="h-3 w-3" aria-hidden />
                Kickoff {new Date(player.kickoff).toLocaleString()}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">Projected</p>
              <p className="text-3xl font-black text-neon">{intelligence.projectedPoints}</p>
              <p className="text-[10px] font-semibold text-muted">pts</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <QuickStat label="Confidence" value={`${intelligence.confidenceScore}%`} icon={<Target className="h-3 w-3" />} />
            <QuickStat label="Proj. Rank" value={intelligence.projectedRank} icon={<TrendingUp className="h-3 w-3" />} />
            <QuickStat label="All Volume" value={sentiment ? credits(sentiment.totalVolume) : "-"} icon={<BarChart2 className="h-3 w-3" />} />
          </div>
        </div>
      </div>

      {markets.length === 0 || !selectedMarket ? (
        <div className="rounded-xl border border-rim bg-panel px-4 py-8 text-center text-sm font-semibold text-muted">
          No markets are available for this player this week.
        </div>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]" aria-label="Player market controls">
            <PlayerThresholdSelector
              playerName={player.name}
              markets={markets}
              activeThreshold={selectedMarket.threshold}
              onChange={(market) => changeThreshold(market.threshold)}
              sticky
            />
            <MarketTimeRangeSelector value={chartRange} onChange={setChartRange} />
          </section>

          <div id="selected-player-market" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <main className="min-w-0 space-y-4">
              <MarketSummary market={selectedMarket} />
              <PlayerMarketChart
                history={selectedMarket.history}
                openingPrice={selectedMarket.openingPrice}
                currentPrice={selectedMarket.yesPrice}
                label={`${player.name} ${thresholdLabel(selectedMarket.threshold)}`}
                range={chartRange}
              />
              <PositionSummary market={selectedMarket} />
              <MarketStats market={selectedMarket} />
              <IntelligencePanel intelligence={intelligence} injuryColor={injuryColor} />
              <section aria-label="Selected market timeline">
                <MarketTimeline events={selectedMarket.events} compact />
              </section>
            </main>

            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <TradePanel
                market={selectedMarket}
                player={{ ...player, projection: intelligence.projectedPoints }}
                balance={account.balance}
                position={selectedMarket.position}
                onTradeComplete={() => { if (playerId) void load(playerId); }}
                isAuthenticated={account.isAuthenticated}
                returnTo={`/players/${player.id}?threshold=${selectedMarket.threshold}`}
              />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/markets" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-frost" aria-label="Back to markets">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Markets
    </Link>
  );
}

function MarketSummary({ market }: { market: PlayerDetailResponse["markets"][number] }) {
  const movement = market.yesPrice - market.openingPrice;
  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Selected market price summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-frost">
            <Zap className="h-4 w-4 text-neon" aria-hidden />
            {thresholdLabel(market.threshold)} Contract
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">Free-play prediction-market shares for this weekly player outcome.</p>
        </div>
        <span className="rounded-full border border-rim bg-panel2 px-3 py-1 text-[10px] font-black text-muted">
          {market.status}{market.result ? ` - ${market.result}` : ""}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="YES" value={pct(market.yesPrice)} tone="positive" />
        <Metric label="NO" value={pct(market.noPrice)} tone="negative" />
        <Metric label="Open" value={pct(market.openingPrice)} />
        <Metric label="Move" value={`${movement >= 0 ? "+" : ""}${pct(movement)}`} tone={movement >= 0 ? "positive" : "negative"} />
      </div>
    </section>
  );
}

function PositionSummary({ market }: { market: PlayerDetailResponse["markets"][number] }) {
  const position = market.position;
  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Your selected market position">
      <h2 className="text-sm font-black text-frost">Your Position</h2>
      {position ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="YES Shares" value={position.yesShares.toFixed(3)} tone="positive" />
          <Metric label="NO Shares" value={position.noShares.toFixed(3)} tone="negative" />
          <Metric label="Cost Basis" value={credits(position.costBasis)} />
          <Metric label="Value" value={credits(position.currentValue)} />
          <Metric label="Unrealized" value={`${position.unrealizedPnl >= 0 ? "+" : ""}${credits(position.unrealizedPnl)}`} tone={position.unrealizedPnl >= 0 ? "positive" : "negative"} />
        </div>
      ) : (
        <p className="mt-2 rounded-lg bg-panel2 px-3 py-3 text-sm font-semibold text-muted">No position in this threshold yet.</p>
      )}
    </section>
  );
}

function MarketStats({ market }: { market: PlayerDetailResponse["markets"][number] }) {
  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Selected market statistics">
      <h2 className="text-sm font-black text-frost">Market Stats</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Volume" value={credits(market.volume)} />
        <Metric label="Liquidity" value={credits(market.liquidity)} />
        <Metric label="Open Interest" value={market.openInterest.toFixed(3)} />
        <Metric label="History Points" value={`${market.history.length}`} />
      </div>
    </section>
  );
}

function IntelligencePanel({ intelligence, injuryColor }: { intelligence: PlayerDetailResponse["intelligence"]; injuryColor: string }) {
  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Player intelligence">
      <h2 className="text-sm font-black text-frost">Player Intelligence</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Projected Rank" value={intelligence.projectedRank} />
        <Metric label="Confidence" value={`${intelligence.confidenceScore}%`} tone="positive" />
        <Metric label="Projected Pts" value={`${intelligence.projectedPoints} pts`} />
        <div className="rounded-xl bg-panel2 px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-muted">Availability</p>
          <p className={`mt-0.5 text-sm font-black ${injuryColor}`}>{intelligence.injuryStatus}</p>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-panel2 px-3 py-2.5 text-sm font-semibold text-steel">{intelligence.matchupNotes}</p>
    </section>
  );
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-panel2 px-3 py-2 text-center">
      <div className="mb-0.5 flex items-center justify-center gap-1 text-muted">{icon}<span className="text-[9px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-sm font-black text-frost">{value}</p>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-neon" : tone === "negative" ? "text-crimson" : "text-frost";
  return (
    <div className="rounded-xl bg-panel2 px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}
