"use client";

import { useEffect, useState } from "react";
import { Activity, Copy, Share2, Target, TrendingUp, UserPlus, Users, Zap } from "lucide-react";
import { apiGet } from "@/lib/client-api";

type BetaMetrics = {
  beta: {
    since: string;
    totalUsers: number;
    counts: Record<string, number>;
    activation: {
      signupToOnboardingPct: number;
      signupToFirstTradePct: number;
      referralSignupPct: number;
    };
    topReferrers: Array<{ id: string; name: string; referralCode: string | null; referrals: number }>;
  };
};

const metricCards = [
  { key: "SIGNUP", label: "Signups", Icon: UserPlus },
  { key: "REFERRAL_SIGNUP", label: "Referral Signups", Icon: Users },
  { key: "ONBOARDING_COMPLETE", label: "Onboarding Done", Icon: Target },
  { key: "FIRST_TRADE", label: "First Trades", Icon: Zap },
  { key: "MARKET_SHARE", label: "Market Shares", Icon: Share2 },
  { key: "INVITE_COPY", label: "Invite Copies", Icon: Copy }
];

export default function AdminBetaPage() {
  const [data, setData] = useState<BetaMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<BetaMetrics>("/api/admin/beta")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load beta metrics"));
  }, []);

  if (error) {
    return <div className="rounded border border-rush/20 bg-rush/10 p-5 text-sm font-bold text-rush">{error}</div>;
  }

  if (!data) {
    return <div className="rounded border border-rim bg-panel p-5 text-sm font-bold text-muted">Loading beta metrics...</div>;
  }

  const beta = data.beta;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-neon">Beta Launch</p>
        <h1 className="mt-1 text-2xl font-black text-frost">Activation Dashboard</h1>
        <p className="mt-1 text-sm font-semibold text-muted">Last 30 days since {new Date(beta.since).toLocaleDateString()}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Activation rates">
        <RateCard label="Signup to Onboarding" value={beta.activation.signupToOnboardingPct} />
        <RateCard label="Signup to First Trade" value={beta.activation.signupToFirstTradePct} />
        <RateCard label="Referral Signup Share" value={beta.activation.referralSignupPct} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Event counts">
        {metricCards.map(({ key, label, Icon }) => (
          <div key={key} className="rounded-xl border border-rim bg-panel p-4">
            <div className="mb-3 flex items-center gap-2 text-muted">
              <Icon className="h-4 w-4 text-neon" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-black text-frost">{beta.counts[key] ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-rim bg-panel p-4" aria-label="Referral leaders">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-frost">
          <TrendingUp className="h-4 w-4 text-neon" aria-hidden /> Referral Leaders
        </h2>
        {beta.topReferrers.length === 0 ? (
          <p className="text-sm font-semibold text-muted">No referrals yet.</p>
        ) : (
          <div className="divide-y divide-rim/50">
            {beta.topReferrers.map((referrer, index) => (
              <div key={referrer.id} className="flex items-center gap-3 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-neon/10 text-xs font-black text-neon">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-frost">{referrer.name}</p>
                  <p className="font-mono text-[10px] font-bold text-muted">{referrer.referralCode ?? "No code"}</p>
                </div>
                <span className="text-sm font-black text-neon">{referrer.referrals}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Activity className="h-3.5 w-3.5" aria-hidden /> Counts are internal beta events, not third-party analytics.
      </p>
    </div>
  );
}

function RateCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neon/20 bg-neon/5 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-neon">{value}%</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rim">
        <div className="h-full rounded-full bg-neon" style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
