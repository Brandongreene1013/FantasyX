"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, CheckCircle2, TrendingUp, Trophy, Zap, Star } from "lucide-react";
import { apiPost } from "@/lib/client-api";
import { ALL_TEAMS } from "@/lib/team-colors";

const STEPS = ["welcome", "how-it-works", "credits", "team", "done"] as const;
type Step = typeof STEPS[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [favTeam, setFavTeam] = useState("");
  const [saving, setSaving] = useState(false);

  const stepIdx   = STEPS.indexOf(step);
  const progress  = ((stepIdx + 1) / STEPS.length) * 100;

  async function finish() {
    setSaving(true);
    try {
      await apiPost("/api/auth/onboarding", { favoriteTeam: favTeam || null, onboardingDone: true });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
    } catch { /* non-blocking */ }
    router.push("/markets?coach=first-trade" as Route);
  }

  function next() {
    const nextIdx = stepIdx + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx]);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-[10px] font-bold text-muted mb-2">
          <span>Step {stepIdx + 1} of {STEPS.length}</span>
          <button
            onClick={finish}
            className="text-muted hover:text-frost transition-colors"
            type="button"
          >
            Skip
          </button>
        </div>
        <div className="h-1 w-full rounded-full bg-panel2">
          <div
            className="h-1 rounded-full bg-neon transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step === "welcome" && (
        <StepCard
          icon={<Zap className="h-8 w-8 text-neon" />}
          title="Welcome to FantasyX"
          description="The free-play NFL fantasy prediction market. No real money. No risk. Pure football strategy."
          onNext={next}
        />
      )}

      {step === "how-it-works" && (
        <StepCard
          icon={<TrendingUp className="h-8 w-8 text-charge" />}
          title="Pick YES or NO"
          description="Every week, markets open on whether an NFL player finishes Top 3, Top 5, or Top 10 at their position in half-PPR fantasy scoring."
          onNext={next}
          detail={
            <div className="mt-4 space-y-2">
              {[
                { label: "YES", desc: "They hit the threshold", color: "text-neon border-neon/30 bg-neon/10" },
                { label: "NO",  desc: "They miss the threshold", color: "text-crimson border-crimson/30 bg-crimson/10" }
              ].map(({ label, desc, color }) => (
                <div key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${color}`}>
                  <span className="font-black">{label}</span>
                  <span className="text-sm font-semibold text-muted">{desc}</span>
                </div>
              ))}
            </div>
          }
        />
      )}

      {step === "credits" && (
        <StepCard
          icon={<Star className="h-8 w-8 text-gold" />}
          title="10,000 Mock Credits"
          description="You start with 10,000 free mock credits — use them to trade markets all season. They replenish each season. No real money involved."
          onNext={next}
          detail={
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-4 text-center">
              <p className="text-3xl font-black text-gradient-gold">10,000</p>
              <p className="text-xs font-semibold text-muted mt-1">mock credits · season 2026</p>
            </div>
          }
        />
      )}

      {step === "team" && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-panel2 border border-rim mx-auto">
              <Trophy className="h-8 w-8 text-gold" />
            </div>
            <h1 className="text-2xl font-black text-frost">Pick Your Team</h1>
            <p className="mt-2 text-sm font-semibold text-muted">Optional — helps personalize your experience.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
            {ALL_TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => setFavTeam(team === favTeam ? "" : team)}
                className={`rounded-lg border py-2 px-1 text-xs font-black transition-colors ${
                  favTeam === team
                    ? "border-neon/40 bg-neon/15 text-neon"
                    : "border-rim bg-panel text-muted hover:text-frost hover:border-frost/20"
                }`}
                type="button"
              >
                {team}
              </button>
            ))}
          </div>
          <button
            onClick={next}
            className="w-full h-12 rounded-xl bg-neon font-black text-surface hover:bg-neon/90 transition flex items-center justify-center gap-2"
            type="button"
          >
            {favTeam ? `Go with ${favTeam}` : "Skip — pick later"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neon/15 border border-neon/30 mx-auto">
            <CheckCircle2 className="h-10 w-10 text-neon" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-frost">You&apos;re all set!</h1>
            <p className="mt-2 text-sm font-semibold text-muted">Head to the markets and make your first trade.</p>
          </div>
          <button
            onClick={finish}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-neon font-black text-surface hover:bg-neon/90 transition flex items-center justify-center gap-2 disabled:opacity-70"
            type="button"
          >
            {saving ? "Getting ready…" : "Go to Markets"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function StepCard({ icon, title, description, onNext, detail }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onNext: () => void;
  detail?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-panel2 border border-rim mx-auto">
          {icon}
        </div>
        <h1 className="text-2xl font-black text-frost">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-muted leading-relaxed">{description}</p>
      </div>
      {detail}
      <button
        onClick={onNext}
        className="w-full h-12 rounded-xl bg-neon font-black text-surface hover:bg-neon/90 transition flex items-center justify-center gap-2"
        type="button"
      >
        Next
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
