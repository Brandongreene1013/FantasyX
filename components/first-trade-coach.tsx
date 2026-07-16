"use client";

import { ArrowRight, CheckCircle2, Search, Zap } from "lucide-react";

export function FirstTradeCoach({
  visible,
  onDismiss
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <section className="rounded-xl border border-neon/25 bg-neon/8 p-4" aria-label="First trade guide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[10px] font-black text-neon">
            <Zap className="h-3 w-3" aria-hidden />
            FIRST TRADE
          </div>
          <h2 className="text-base font-black text-frost">Pick one player, choose YES or NO, start with 25 credits.</h2>
          <div className="mt-3 grid gap-2 text-xs font-semibold text-muted sm:grid-cols-3">
            <GuideStep icon={<Search className="h-3.5 w-3.5" />} text="Find a player you know" />
            <GuideStep icon={<ArrowRight className="h-3.5 w-3.5" />} text="Tap a YES or NO price" />
            <GuideStep icon={<CheckCircle2 className="h-3.5 w-3.5" />} text="Confirm a small trade" />
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="h-10 rounded-lg border border-rim bg-panel px-3 text-xs font-black text-muted transition hover:text-frost"
        >
          Got it
        </button>
      </div>
    </section>
  );
}

function GuideStep({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-rim/60 bg-panel/70 px-3 py-2">
      <span className="text-neon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
