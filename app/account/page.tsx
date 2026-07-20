"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Wallet, Trophy, Target, Zap,
  Calendar, Star, Shield, BarChart2, ChevronRight, Copy, Users
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/client-api";
import { credits, pct } from "@/lib/format";
import { getTeamColors } from "@/lib/team-colors";
import { LoadingFeed } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { AuthRequiredState } from "@/components/auth-required-state";

type AccountResponse = {
  account: {
    id: string; firstName: string; lastName: string;
    displayName: string; email: string | null;
    role: "TRADER" | "ADMIN"; isAdmin: boolean;
    mockBalance: number; startingBalance: number;
    joinedAt: string; openPositions: number;
    totalTrades: number; portfolioPnl: number;
    favoriteTeam?: string | null; winRate?: number;
    referralCode: string; referralUrl: string; referralCount: number; referredByName: string | null;
  };
};

type Achievement = { id: string; icon: string; title: string; desc: string; earned: boolean };

function computeAchievements(a: AccountResponse["account"]): Achievement[] {
  const pnl = a.portfolioPnl;
  const wr  = a.winRate ?? 0;
  return [
    { id: "first_trade", icon: "⚡", title: "First Trade",   desc: "Placed your first trade",          earned: a.totalTrades >= 1    },
    { id: "on_fire",     icon: "🔥", title: "On Fire",       desc: "5 trades placed",                  earned: a.totalTrades >= 5    },
    { id: "in_money",    icon: "💰", title: "In the Money",  desc: "Portfolio above starting balance", earned: pnl > 0               },
    { id: "sharp",       icon: "🎯", title: "Sharp",         desc: "Win rate above 60%",               earned: wr > 0.6              },
    { id: "veteran",     icon: "🏆", title: "Veteran",       desc: "25+ trades placed",                earned: a.totalTrades >= 25   },
    { id: "whale",       icon: "🐋", title: "Whale",         desc: "100+ trades placed",               earned: a.totalTrades >= 100  },
  ];
}

export default function AccountPage() {
  const [data,      setData]      = useState<AccountResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied,    setCopied]    = useState(false);
  const [isGuest,   setIsGuest]   = useState(false);

  useEffect(() => {
    apiGet<AccountResponse>("/api/account")
      .then(setData)
      .catch((e) => {
        if (e instanceof Error && e.message === "Authentication required") setIsGuest(true);
        else setError(e instanceof Error ? e.message : "Could not load account");
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingFeed count={3} />;
  if (isGuest) return <AuthRequiredState title="Your account starts here" description="Log in to view your balance, achievements, referrals, and personalized FantasyX profile." next="/account" />;
  if (error)     return <ErrorState message={error} />;

  const a = data?.account;
  if (!a) return null;

  const pnlPos       = a.portfolioPnl >= 0;
  const profitPct    = ((a.mockBalance - a.startingBalance) / a.startingBalance) * 100;
  const achievements = computeAchievements(a);
  const earned       = achievements.filter((x) => x.earned);
  const initials     = `${a.firstName[0]}${a.lastName[0]}`.toUpperCase();
  const teamColors   = a.favoriteTeam ? getTeamColors(a.favoriteTeam) : null;
  const avatarBg     = teamColors ? `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})` : "linear-gradient(135deg, #00D46A, #12664F)";
  const wr           = a.winRate ?? 0;

  async function copyInvite() {
    const inviteUrl = data?.account.referralUrl;
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      void apiPost("/api/beta-events", { type: "INVITE_COPY", source: "account" }).catch(() => undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">

      {/* Hero profile card */}
      <section className="rounded-2xl border border-rim bg-panel overflow-hidden card-depth" aria-label="Profile">
        <div className="h-24 bg-exchange-gradient relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,106,0.12),transparent_70%)]" aria-hidden />
        </div>
        <div className="px-5 pb-5">
          {/* Avatar overlaps gradient */}
          <div
            className="h-20 w-20 -mt-10 rounded-2xl flex items-center justify-center text-2xl font-black text-white border-4 border-panel shadow-depth"
            style={{ background: avatarBg }}
            aria-hidden
          >
            {initials}
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-frost">{a.firstName} {a.lastName}</h1>
              <p className="text-sm font-semibold text-muted">{a.displayName}</p>
              {a.favoriteTeam && (
                <p className="mt-1 text-xs font-bold" style={{ color: teamColors?.primary ?? "#00D46A" }}>
                  {a.favoriteTeam} fan
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {a.isAdmin && (
                <span className="rounded-full bg-amber/15 border border-amber/30 px-2.5 py-0.5 text-[10px] font-black text-amber">Admin</span>
              )}
              <span className="rounded-full bg-panel2 border border-rim px-2.5 py-0.5 text-[10px] font-semibold text-muted capitalize">
                {a.role.toLowerCase()}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rim/40 pt-4">
            <ProfileStat icon={<Calendar className="h-3.5 w-3.5" />} label="Member since" value={new Date(a.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })} />
            <ProfileStat icon={<BarChart2 className="h-3.5 w-3.5" />} label="Total trades"   value={String(a.totalTrades)} />
            <ProfileStat icon={<Target className="h-3.5 w-3.5" />}    label="Open positions" value={String(a.openPositions)} />
          </div>
        </div>
      </section>

      {/* Balance + P&L */}
      <section className="grid grid-cols-2 gap-3" aria-label="Portfolio summary">
        <div className="rounded-2xl border border-rim bg-panel p-4 card-depth">
          <div className="flex items-center gap-1.5 text-muted mb-2">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            <p className="text-[10px] font-black uppercase tracking-wider">Balance</p>
          </div>
          <p className="text-2xl font-black text-frost">{credits(a.mockBalance)}</p>
          <p className="text-[10px] font-semibold text-muted mt-1">Started {credits(a.startingBalance)}</p>
        </div>
        <div className={`rounded-2xl border p-4 card-depth ${pnlPos ? "border-neon/25 bg-neon/5" : "border-crimson/25 bg-crimson/5"}`}>
          <div className={`flex items-center gap-1.5 mb-2 ${pnlPos ? "text-neon" : "text-crimson"}`}>
            {pnlPos ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            <p className="text-[10px] font-black uppercase tracking-wider">All-Time P&L</p>
          </div>
          <p className={`text-2xl font-black ${pnlPos ? "text-neon" : "text-crimson"}`}>
            {pnlPos ? "+" : ""}{credits(a.portfolioPnl)}
          </p>
          <p className={`text-[10px] font-semibold mt-1 ${pnlPos ? "text-neon/70" : "text-crimson/70"}`}>
            {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(1)}% return
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-neon/20 bg-neon/5 p-5 card-depth" aria-label="Invite friends">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-black text-frost">
              <Users className="h-4 w-4 text-neon" aria-hidden /> Invite League Mates
            </h2>
            <p className="mt-1 text-xs font-semibold text-muted">
              Share your free-play invite link before kickoff. {a.referralCount} joined from your code.
            </p>
            {a.referredByName && (
              <p className="mt-1 text-[10px] font-bold text-muted">Invited by {a.referredByName}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-xl border border-rim bg-panel px-3 py-2 font-mono text-xs font-black text-neon">{a.referralCode}</span>
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 px-3 text-xs font-black text-neon transition hover:bg-neon/20"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Trading stats">
        <StatCard label="Win Rate"      value={wr > 0 ? pct(wr) : "—"}          icon={<Target className="h-4 w-4 text-neon" />}    tone={wr > 0.5 ? "neon" : "muted"} />
        <StatCard label="Open Positions" value={String(a.openPositions)}         icon={<Zap className="h-4 w-4 text-charge" />}    tone="charge" />
        <StatCard label="Total Trades"   value={String(a.totalTrades)}           icon={<BarChart2 className="h-4 w-4 text-amber" />} tone="amber" />
        <StatCard label="Role"           value={a.isAdmin ? "Admin" : "Trader"}  icon={<Shield className="h-4 w-4 text-violet" />}  tone="violet" />
      </section>

      {/* Achievements */}
      <section className="rounded-2xl border border-rim bg-panel p-5 card-depth" aria-label="Achievements">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-black text-frost">
            <Trophy className="h-4 w-4 text-gold" aria-hidden /> Achievements
          </h2>
          <span className="text-xs font-bold text-muted">{earned.length}/{achievements.length} earned</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`rounded-xl border px-3 py-3 transition-all ${
                ach.earned
                  ? "border-gold/25 bg-gold/8 badge-shine"
                  : "border-rim bg-panel2 opacity-50"
              }`}
            >
              <p className="text-xl mb-1" aria-hidden>{ach.icon}</p>
              <p className={`text-xs font-black ${ach.earned ? "text-frost" : "text-muted"}`}>{ach.title}</p>
              <p className="text-[10px] font-semibold text-muted leading-tight mt-0.5">{ach.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="space-y-2" aria-label="Account actions">
        {[
          { href: "/portfolio" as Route, label: "View Portfolio",  icon: <BarChart2 className="h-4 w-4" />,  desc: "Positions, P&L, equity curve" },
          { href: "/leaderboard" as Route, label: "Leaderboard",   icon: <Trophy className="h-4 w-4" />,     desc: "See where you rank" },
          { href: "/settings" as Route, label: "Settings",         icon: <Star className="h-4 w-4" />,       desc: "Edit profile and preferences" }
        ].map(({ href, label, icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-rim bg-panel px-4 py-3 hover:border-neon/20 hover:bg-panel2 transition-all group"
          >
            <span className="text-muted group-hover:text-neon transition-colors">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-frost">{label}</p>
              <p className="text-[10px] font-semibold text-muted">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted group-hover:text-frost transition-colors" aria-hidden />
          </Link>
        ))}
      </section>
    </div>
  );
}

function ProfileStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-muted mb-1">{icon}</div>
      <p className="text-sm font-black text-frost">{value}</p>
      <p className="text-[9px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "neon" | "charge" | "amber" | "violet" | "muted" }) {
  const textColor = { neon: "text-neon", charge: "text-charge", amber: "text-amber", violet: "text-violet", muted: "text-muted" }[tone];
  return (
    <div className="rounded-xl border border-rim bg-panel p-3">
      <div className="mb-2">{icon}</div>
      <p className={`text-lg font-black ${textColor}`}>{value}</p>
      <p className="text-[10px] font-semibold text-muted mt-0.5">{label}</p>
    </div>
  );
}
