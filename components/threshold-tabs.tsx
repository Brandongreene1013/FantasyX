"use client";

import clsx from "clsx";
import { thresholdLabel } from "@/lib/format";
import type { Threshold } from "@/lib/types";

const thresholds: Threshold[] = ["TOP_3", "TOP_5", "TOP_10"];

export function ThresholdTabs({
  active,
  onChange
}: {
  active: Threshold | "ALL";
  onChange: (value: Threshold | "ALL") => void;
}) {
  return (
    <div className="grid grid-cols-4 rounded border border-ink/10 bg-white p-1 shadow-soft" role="group" aria-label="Filter markets by finish threshold">
      {(["ALL", ...thresholds] as const).map((threshold) => (
        <button
          className={clsx(
            "rounded px-2 py-2 text-sm font-black transition",
            active === threshold ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"
          )}
          key={threshold}
          onClick={() => onChange(threshold)}
          aria-pressed={active === threshold}
          type="button"
        >
          {threshold === "ALL" ? "All" : thresholdLabel(threshold)}
        </button>
      ))}
    </div>
  );
}
