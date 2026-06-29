"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client-api";
import { credits } from "@/lib/format";
import { LiveBadge } from "@/components/ui/live-badge";
import type { ExchangeStatus } from "@/lib/live-types";

export function ExchangeStatusBar() {
  const [status, setStatus] = useState<ExchangeStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const s = await apiGet<ExchangeStatus>("/api/exchange-status?weekId=nfl_2026_w1");
        if (mounted) setStatus(s);
      } catch { /* ignore */ }
    }

    void load();
    const t = setInterval(() => void load(), 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  if (!status) return null;

  return (
    <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-muted">
      <LiveBadge isLive={status.isLive} />
      {status.openMarkets > 0 && (
        <span className="text-muted">
          <span className="text-frost font-black">{status.openMarkets}</span> open
        </span>
      )}
      {status.lockedMarkets > 0 && (
        <span className="text-amber font-black">{status.lockedMarkets} locking</span>
      )}
      <span className="text-muted hidden lg:inline">
        Vol <span className="text-frost font-black">{credits(status.totalVolume)}</span>
      </span>
      <span className="text-muted">{status.weekLabel}</span>
    </div>
  );
}
