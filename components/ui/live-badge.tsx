"use client";

export function LiveBadge({ isLive, className = "" }: { isLive: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
        isLive
          ? "border border-neon/30 bg-neon/10 text-neon"
          : "border border-rim bg-panel2 text-muted"
      } ${className}`}
      aria-label={isLive ? "Exchange live" : "Exchange offline"}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-neon animate-pulse" : "bg-muted"}`}
        aria-hidden
      />
      {isLive ? "LIVE" : "OFFLINE"}
    </span>
  );
}
