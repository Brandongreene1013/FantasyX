"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { MarketStatus } from "@/lib/types";

function formatMs(ms: number): string {
  if (ms <= 0) return "LOCKING";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 4) return `${m}m`;
  return `${m}m ${s}s`;
}

export function Countdown({
  kickoffTime,
  status,
  className = ""
}: {
  kickoffTime: string;
  status: MarketStatus;
  className?: string;
}) {
  const [label, setLabel] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "OPEN") {
      setLabel(status === "LOCKED" ? "LOCKED" : status);
      return;
    }

    function tick() {
      const ms = new Date(kickoffTime).getTime() - Date.now();
      setLabel(formatMs(ms));
      // tick faster when < 5 minutes
      timerRef.current = setTimeout(tick, ms < 300000 ? 1000 : 30000);
    }

    tick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [kickoffTime, status]);

  const isLocked = status === "LOCKED" || label === "LOCKING";
  const isUrgent = !isLocked && label.includes("s") && !label.includes("h");

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {isLocked && <Lock className="h-3 w-3 text-amber" aria-hidden />}
      <span className={isLocked ? "text-amber" : isUrgent ? "text-crimson animate-pulse" : "text-muted"}>
        {label}
      </span>
    </span>
  );
}
