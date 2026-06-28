"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Clock, TrendingUp, ShieldCheck, AlertCircle, BarChart2, Activity } from "lucide-react";
import { TradePanel } from "@/components/trade-panel";
import { apiGet } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { PlayerDetailResponse, PortfolioResponse } from "@/lib/client-api";

export default function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetailResponse | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setPlayerId(p.playerId));
  }, [params]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [playerData, portfolioData] = await Promise.all([
        apiGet<PlayerDetailResponse>(`/api/players/${id}`),
        apiGet<PortfolioResponse>("/api/portfolio")
      ]);
      setDetail(playerData);
      setBalance(portfolioData.user.mockBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load player");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (playerId) void load(playerId);
  }, [playerId, load]);

  if (isLoading) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 rounded border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/60 shadow-soft">
          Loading player…
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush">
          {error ?? "Player not found."}
        </div>
      </div>
    );
  }

  const { player, markets, sentiment, intelligence } = detail;
  const activeMarket = markets.find((m) => m.id === activeMarketId) ?? null;

  const positionColors: Record<string, string> = {
    QB: "bg-field/10 text-field",
    RB: "bg-gold/20 text-gold",
    WR: "bg-rush/10 text-rush",
    TE: "bg-ink/10 text-ink/70"
  };

  const injuryColors: Record<string, string> = {
    ACTIVE: "text-field",
    QUESTIONABLE: "text-gold",
    DOUBTFUL: "text-rush",
    OUT: "text-rush font-black"
  };

  return (
    <div>
      <BackLink />

      {/* Player header */}
      <div className="mt-4 rounded border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start gap-4">
          {/* Avatar placeholder */}
          <div
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-field/10 text-2xl font-black text-field"
            aria-hidden
          >
            {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-1 text-xs font-black ${positionColors[player.position] ?? "bg-ink/10 text-ink/70"}`}>
                {player.position}
              </span>
              <span className="text-sm font-bold text-ink/70">{player.team}</span>
              <span className="text-sm font-bold text-ink/50">vs {player.opponent}</span>
              <span className={`flex items-center gap-1 text-xs font-bold ${injuryColors[intelligence.injuryStatus]}`}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {intelligence.injuryStatus}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black">{player.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-ink/60">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Kickoff {new Date(player.kickoff).toLocaleString()}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-ink/50">Projected</p>
            <p className="text-3xl font-black text-field">{intelligence.projectedPoints}</p>
            <p className="text-xs font-bold text-ink/60">pts</p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        {/* Left column: intelligence + sentiment */}
        <div className="grid gap-5">

          {/* Intelligence panel */}
          <section aria-label="Player intelligence" className="rounded border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-ink/70">
              <TrendingUp className="h-4 w-4" aria-hidden /> Intelligence
            </h2>
            <dl className="grid gap-3">
              <IntelRow label="Projected finish" value={intelligence.projectedRank} />
              <IntelRow label="Confidence score" value={`${intelligence.confidenceScore}%`} />
              <IntelRow label="Projected points" value={`${intelligence.projectedPoints} pts`} />
              <IntelRow label="Injury status" value={intelligence.injuryStatus} valueClass={injuryColors[intelligence.injuryStatus]} />
              <div className="rounded border border-ink/10 bg-chalk p-3">
                <dt className="text-xs font-black uppercase tracking-widest text-ink/60">Matchup notes</dt>
                <dd className="mt-1 text-sm font-semibold text-ink/80">{intelligence.matchupNotes}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs font-semibold text-ink/40">
              Placeholder data. Real NFL stats integration planned for a future sprint.
            </p>
          </section>

          {/* Market sentiment */}
          {sentiment ? (
            <section aria-label="Market sentiment" className="rounded border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-ink/70">
                <Activity className="h-4 w-4" aria-hidden /> Market Sentiment
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <SentimentStat label="Avg YES price" value={pct(sentiment.avgYesPrice)} />
                <SentimentStat label="Total volume" value={credits(sentiment.totalVolume)} />
                <SentimentStat label="Open interest" value={sentiment.totalOpenInterest.toFixed(2)} />
                <SentimentStat
                  label="Highest confidence"
                  value={`${thresholdLabel(sentiment.highestConfidenceMarket.threshold)} (${pct(sentiment.highestConfidenceMarket.yesPrice)})`}
                />
                <SentimentStat
                  label="Lowest confidence"
                  value={`${thresholdLabel(sentiment.lowestConfidenceMarket.threshold)} (${pct(sentiment.lowestConfidenceMarket.yesPrice)})`}
                />
              </dl>
            </section>
          ) : null}

          {/* Historical performance */}
          <section aria-label="Historical performance" className="rounded border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-ink/70">
              <BarChart2 className="h-4 w-4" aria-hidden /> Historical Performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="pb-2 text-left text-xs font-black uppercase tracking-widest text-ink/50">Week</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-widest text-ink/50">Finish</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-widest text-ink/50">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {intelligence.historicalFinishes.map((row) => (
                    <tr key={row.week}>
                      <td className="py-2 font-semibold text-ink/70">Week {row.week}</td>
                      <td className="py-2 text-right font-black">#{row.finish}</td>
                      <td className="py-2 text-right font-semibold text-ink/70">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3">
              <HistStat label="Avg pts" value={avgPoints(intelligence.historicalFinishes)} />
              <HistStat label="Best finish" value={`#${Math.min(...intelligence.historicalFinishes.map((r) => r.finish))}`} />
              <HistStat label="Worst finish" value={`#${Math.max(...intelligence.historicalFinishes.map((r) => r.finish))}`} />
            </div>
            <p className="mt-3 text-xs font-semibold text-ink/40">
              Placeholder data. Real performance history planned for a future sprint.
            </p>
          </section>
        </div>

        {/* Right column: markets + trade panel */}
        <div className="grid gap-5 content-start">
          <section aria-label="Player markets">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-ink/70">Markets</h2>
            <div className="grid gap-3">
              {markets.length === 0 ? (
                <div className="rounded border border-ink/10 bg-white p-5 text-sm font-bold text-ink/60 shadow-soft">
                  No markets found for this player this week.
                </div>
              ) : (
                markets.map((market) => (
                  <PlayerMarketCard
                    key={market.id}
                    market={market}
                    isActive={activeMarketId === market.id}
                    onTrade={() => setActiveMarketId(activeMarketId === market.id ? null : market.id)}
                  />
                ))
              )}
            </div>
          </section>

          {activeMarket ? (
            <TradePanel
              market={activeMarket}
              player={{ id: player.id, name: player.name, team: player.team, position: player.position, opponent: player.opponent, kickoff: player.kickoff, projection: intelligence.projectedPoints }}
              balance={balance}
              onTradeComplete={() => { void load(playerId!); setActiveMarketId(null); }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/markets"
      className="inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-bold text-ink/70 hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Markets
    </Link>
  );
}

function PlayerMarketCard({
  market,
  isActive,
  onTrade
}: {
  market: PlayerDetailResponse["markets"][number];
  isActive: boolean;
  onTrade: () => void;
}) {
  const isOpen = market.status === "OPEN";

  return (
    <div className="rounded border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black">{thresholdLabel(market.threshold)}</p>
          <p className="text-xs font-semibold text-ink/60">{market.status}{market.result ? ` — ${market.result}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <PricePill label="YES" price={market.yesPrice} />
          <PricePill label="NO" price={market.noPrice} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-ink/60">
        <span>Pool {credits(market.liquidity)}</span>
        <span>Vol {credits(market.volume)}</span>
        <span>OI {market.openInterest.toFixed(1)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/markets/${market.id}` as Route}
          className="inline-flex min-h-9 items-center rounded border border-ink/15 px-3 text-xs font-bold text-ink/70 hover:border-ink/30 hover:text-ink"
        >
          View detail
        </Link>
        {isOpen ? (
          <button
            type="button"
            onClick={onTrade}
            className={`inline-flex min-h-9 items-center rounded px-3 text-xs font-black transition ${isActive ? "bg-field text-white" : "bg-ink text-white hover:bg-field"}`}
          >
            {isActive ? "Cancel" : "Trade"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PricePill({ label, price }: { label: string; price: number }) {
  return (
    <div className="rounded bg-chalk px-2 py-1 text-center">
      <p className="text-xs font-bold text-ink/50">{label}</p>
      <p className="text-sm font-black">{pct(price)}</p>
    </div>
  );
}

function IntelRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-ink/10 bg-chalk px-3 py-2">
      <dt className="text-xs font-bold text-ink/60">{label}</dt>
      <dd className={`text-sm font-black ${valueClass}`}>{value}</dd>
    </div>
  );
}

function SentimentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <dt className="text-xs font-black uppercase tracking-widest text-ink/50">{label}</dt>
      <dd className="mt-1 text-base font-black">{value}</dd>
    </div>
  );
}

function HistStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-2 text-center">
      <p className="text-xs font-bold text-ink/50">{label}</p>
      <p className="mt-0.5 text-base font-black">{value}</p>
    </div>
  );
}

function avgPoints(finishes: Array<{ points: number }>) {
  if (finishes.length === 0) return "—";
  const avg = finishes.reduce((s, r) => s + r.points, 0) / finishes.length;
  return `${Math.round(avg * 10) / 10}`;
}
