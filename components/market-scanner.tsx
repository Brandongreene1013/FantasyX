"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Activity, AlertTriangle, Clock, Eye, Flame, MoveUpRight, Radio, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { TerminalPanel } from "@/components/ui/terminal-panel";
import { apiGet, defaultWeekId, type FantasyMarketIntelligence, type MarketScannerResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";

type ScannerKey = keyof MarketScannerResponse["scanner"];

const SCANNERS: Array<{ key: ScannerKey; label: string; icon: React.ReactNode }> = [
  { key: "trending", label: "Trending", icon: <Flame className="h-3.5 w-3.5 text-neon" /> },
  { key: "breaking", label: "Breaking", icon: <AlertTriangle className="h-3.5 w-3.5 text-amber" /> },
  { key: "mostActive", label: "Most Active", icon: <Activity className="h-3.5 w-3.5 text-charge" /> },
  { key: "highestConviction", label: "Conviction", icon: <Sparkles className="h-3.5 w-3.5 text-neon" /> },
  { key: "biggestMovers", label: "Movers", icon: <MoveUpRight className="h-3.5 w-3.5 text-crimson" /> },
  { key: "sharpMoney", label: "Sharp", icon: <Zap className="h-3.5 w-3.5 text-amber" /> },
  { key: "publicMoney", label: "Public", icon: <Users className="h-3.5 w-3.5 text-muted" /> },
  { key: "watchlistMovers", label: "Watchlist", icon: <Eye className="h-3.5 w-3.5 text-amber" /> },
  { key: "lockingSoon", label: "Locking", icon: <Clock className="h-3.5 w-3.5 text-crimson" /> }
];

export function MarketScanner({ weekId = defaultWeekId, compact = false }: { weekId?: string; compact?: boolean }) {
  const [data, setData] = useState<MarketScannerResponse | null>(null);
  const [active, setActive] = useState<ScannerKey>("trending");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiGet<MarketScannerResponse>(`/api/intelligence?weekId=${weekId}`);
        if (!mounted) return;
        setData(response);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Scanner offline");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    const timer = setInterval(load, 12000);
    return () => { mounted = false; clearInterval(timer); };
  }, [weekId]);

  const rows = useMemo(() => data?.scanner[active] ?? [], [data, active]);
  const activeMeta = SCANNERS.find((scanner) => scanner.key === active) ?? SCANNERS[0];

  return (
    <TerminalPanel
      label="MARKET SCANNER"
      action={<span className="inline-flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse text-neon" aria-hidden />AUTO</span>}
    >
      <div className="border-b border-rim/50 bg-panel2/70 px-3 py-2">
        <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Market scanner sections">
          {SCANNERS.map((scanner) => (
            <button
              key={scanner.key}
              type="button"
              onClick={() => setActive(scanner.key)}
              className={`flex shrink-0 items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] font-black uppercase transition-colors ${
                active === scanner.key ? "border-neon/30 bg-neon/15 text-neon" : "border-rim bg-panel text-muted hover:text-frost"
              }`}
              role="tab"
              aria-selected={active === scanner.key}
            >
              {scanner.icon}
              {scanner.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-1 p-3">
          {Array.from({ length: compact ? 4 : 7 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded border border-rim/40 bg-panel2/50" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 font-mono text-xs text-crimson" role="status">{error}</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted">No {activeMeta.label} signals yet</div>
      ) : (
        <div className="divide-y divide-rim/40">
          {rows.slice(0, compact ? 5 : 8).map((market, index) => (
            <ScannerRow key={`${active}-${market.marketId}`} market={market} rank={index + 1} compact={compact} />
          ))}
        </div>
      )}
    </TerminalPanel>
  );
}

function ScannerRow({ market, rank, compact }: { market: FantasyMarketIntelligence; rank: number; compact: boolean }) {
  const direction = market.priceChange >= 0 ? "text-neon" : "text-crimson";
  const primarySignal = market.signals[0] ?? "Stable market";

  return (
    <Link
      href={`/markets/${market.marketId}` as Route}
      className="scanner-row grid grid-cols-[26px_1fr_auto] items-center gap-2 px-3 py-2 transition-colors hover:bg-panel2"
    >
      <span className="grid h-6 w-6 place-items-center rounded bg-panel2 font-mono text-[10px] font-black text-muted">{rank}</span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-mono text-xs font-black text-frost">{market.playerName}</span>
          <span className="font-mono text-[9px] font-bold text-muted">{market.team}</span>
          <span className="font-mono text-[9px] font-bold text-amber">{market.position}</span>
        </div>
        <p className="truncate font-mono text-[9px] text-muted">
          {thresholdLabel(market.threshold)} - {primarySignal}{compact ? "" : ` - ${credits(market.volume)} vol`}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs font-black text-neon">{pct(market.yesPrice)}</p>
        <p className={`font-mono text-[9px] font-black ${direction}`}>
          {market.priceChange >= 0 ? "+" : ""}{pct(market.priceChange)}
        </p>
      </div>
    </Link>
  );
}
