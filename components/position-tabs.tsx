"use client";

import clsx from "clsx";
import type { Position } from "@/lib/types";

const positions: Position[] = ["QB", "RB", "WR", "TE"];

export function PositionTabs({ active, onChange }: { active: Position | "ALL"; onChange: (value: Position | "ALL") => void }) {
  return (
    <div className="mb-4 grid grid-cols-5 rounded border border-ink/10 bg-white p-1 shadow-soft" role="group" aria-label="Filter markets by player position">
      {(["ALL", ...positions] as const).map((position) => (
        <button
          className={clsx(
            "rounded px-2 py-2 text-sm font-black transition",
            active === position ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"
          )}
          key={position}
          onClick={() => onChange(position)}
          aria-pressed={active === position}
          type="button"
        >
          {position}
        </button>
      ))}
    </div>
  );
}
