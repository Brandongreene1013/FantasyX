"use client";

import { Suspense, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";
import { safeInternalPath } from "@/lib/redirects";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { PasswordField } from "@/components/auth/password-field";

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-rim bg-panel2 px-3 text-sm font-semibold text-frost placeholder:font-normal placeholder:text-slate-600 outline-none transition-colors focus:border-neon/60";

export default function LoginPage() { return <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading...</div>}><LoginContent /></Suspense>; }

function LoginContent() {
  const router = useRouter();
  const query = useSearchParams();
  const next = safeInternalPath(query.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(oauthErrorMessage(query.get("error")));

  useEffect(() => { apiGet<SessionResponse>("/api/session").then((data) => { if (data.user) router.replace(next as Route); }).catch(() => undefined); }, [next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await apiPost<{ authenticated?: boolean; requiresTwoFactor?: boolean }>("/api/auth/login", { email, password });
      if (result.requiresTwoFactor) router.push(`/login/2fa?next=${encodeURIComponent(next)}` as Route);
      else { window.dispatchEvent(new Event("fantasyx:data-changed")); router.push(next as Route); router.refresh(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md py-8 sm:py-12">
      <div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-neon text-sm font-black text-surface">FX</div><h1 className="text-2xl font-black text-frost">Sign in to FantasyX</h1><p className="mt-1.5 text-sm font-normal text-slate-400">Access your portfolio, watchlist, and trades.</p></div>
      <section className="rounded-lg border border-rim bg-panel p-5 sm:p-6" aria-label="Sign in">
        <SocialAuthButtons next={next} />
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <div><label className="text-xs font-semibold text-slate-300" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@example.com" /></div>
          <div><div className="flex items-center justify-between"><label className="text-xs font-semibold text-slate-300" htmlFor="password">Password</label><Link href={"/forgot-password" as Route} className="text-xs font-semibold text-neon hover:underline">Forgot password?</Link></div><PasswordField id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Enter your password" /></div>
          {error && <p role="alert" className="rounded-lg border border-crimson/25 bg-crimson/10 px-3 py-2.5 text-sm font-semibold text-crimson">{error}</p>}
          <button disabled={busy} className="h-11 w-full rounded-lg bg-neon text-sm font-black text-surface transition hover:bg-neon/90 disabled:opacity-60">{busy ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="mt-5 text-center text-sm font-normal text-slate-400">New to FantasyX? <Link href={"/signup" as Route} className="font-bold text-neon hover:underline">Create an account</Link></p>
      </section>
      <p className="mt-4 text-center text-xs font-normal text-slate-500">FantasyX uses free mock credits. No deposits or real-money wagering.</p>
    </div>
  );
}

function oauthErrorMessage(code: string | null) {
  if (!code) return null;
  if (code === "oauth_cancelled") return "Provider sign-in was cancelled.";
  if (code === "oauth_expired") return "That provider sign-in expired. Please try again.";
  if (code === "oauth_unverified_email") return "Google did not return a verified email address for that account.";
  if (code === "oauth_not_configured") return "Provider sign-in is not configured yet.";
  return "Provider sign-in could not be completed. Please try again.";
}
