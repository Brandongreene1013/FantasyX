"use client";

import { AlertTriangle, CloudSun, Crosshair, HeartPulse, LineChart, ShieldAlert, Sparkles, Target } from "lucide-react";
import type { FantasyMarketIntelligence } from "@/lib/client-api";

export function FantasyIntelligencePanel({ intelligence }: { intelligence: FantasyMarketIntelligence | null }) {
  if (!intelligence) {
    return (
      <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Fantasy intelligence">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">Fantasy Intelligence</p>
        <p className="mt-2 text-sm font-semibold text-muted">Intelligence is warming up for this market.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Fantasy intelligence">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-neon">Fantasy Intelligence</p>
          <h2 className="mt-1 text-base font-black text-frost">{intelligence.playerName} signal stack</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {intelligence.signals.slice(0, 4).map((signal) => (
            <span key={signal} className="rounded border border-rim bg-panel2 px-2 py-1 font-mono text-[9px] font-black uppercase text-muted">
              {signal}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <CaseBlock tone="bull" title="Bull Case" body={intelligence.bullCase} />
        <CaseBlock tone="bear" title="Bear Case" body={intelligence.bearCase} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Score icon={<Sparkles className="h-4 w-4" />} label="Confidence" value={intelligence.confidenceScore} tone="text-neon" />
        <Score icon={<LineChart className="h-4 w-4" />} label="Trend" value={intelligence.trendScore} tone="text-charge" />
        <Score icon={<Target className="h-4 w-4" />} label="Opportunity" value={intelligence.opportunityRating} tone="text-amber" />
        <Score icon={<ShieldAlert className="h-4 w-4" />} label="Risk" value={intelligence.riskRating} tone="text-crimson" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-2">
          <ImpactRow icon={<HeartPulse className="h-4 w-4" />} label="Injury impact" value={intelligence.injuryImpact} />
          <ImpactRow icon={<CloudSun className="h-4 w-4" />} label="Weather impact" value={intelligence.weatherImpact} />
          <ImpactRow icon={<Crosshair className="h-4 w-4" />} label="Vegas movement" value={intelligence.vegasLineMovement.replace("_", " ")} />
        </div>

        <div className="rounded-lg border border-rim bg-panel2 p-3">
          <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-wider text-muted">Historical Similar Games</p>
          <div className="grid gap-2">
            {intelligence.historicalSimilarGames.map((game) => (
              <div key={game.label} className="grid grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] font-black text-frost">{game.label}</p>
                  <p className="font-mono text-[9px] text-muted">{game.outcome}</p>
                </div>
                <span className="font-mono text-xs font-black text-neon">{game.hitRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CaseBlock({ tone, title, body }: { tone: "bull" | "bear"; title: string; body: string }) {
  const color = tone === "bull" ? "text-neon border-neon/25 bg-neon/8" : "text-crimson border-crimson/25 bg-crimson/8";
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center gap-2">
        {tone === "bull" ? <Sparkles className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        <h3 className="font-mono text-[10px] font-black uppercase tracking-wider">{title}</h3>
      </div>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-frost/85">{body}</p>
    </div>
  );
}

function Score({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-rim bg-panel2 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-wider text-muted">{icon}{label}</p>
      <p className={`mt-1 font-mono text-2xl font-black ${tone}`}>{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rim">
        <div className="h-full bg-current transition-all" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ImpactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rim bg-panel2 px-3 py-2">
      <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider text-muted">{icon}{label}</span>
      <span className="font-mono text-[10px] font-black text-frost">{value}</span>
    </div>
  );
}
