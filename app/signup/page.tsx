"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { PasswordField } from "@/components/auth/password-field";

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-rim bg-panel2 px-3 text-sm font-semibold text-frost placeholder:font-normal placeholder:text-slate-600 outline-none transition-colors focus:border-neon/60";
const labelClass = "text-xs font-semibold text-slate-300";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiGet<SessionResponse>("/api/session").then((d) => { if (d.user) router.replace("/markets" as Route); }).catch(() => undefined); const ref = new URLSearchParams(window.location.search).get("ref"); if (ref) setReferralCode(ref.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24)); }, [router]);
  function update(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await apiPost<{ email: string; verificationPreviewUrl?: string }>("/api/auth/signup", { ...form, referralCode: referralCode || undefined });
      const params = new URLSearchParams({ email: result.email });
      if (result.verificationPreviewUrl) params.set("preview", result.verificationPreviewUrl);
      router.push(`/verify-email?${params}` as Route);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Account creation failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-lg py-8 sm:py-12">
      <div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-neon text-sm font-black text-surface">FX</div><h1 className="text-2xl font-black text-frost">Create your account</h1><p className="mt-1.5 text-sm font-normal text-slate-400">Start with 10,000 free mock credits.</p></div>
      <section className="rounded-lg border border-rim bg-panel p-5 sm:p-6" aria-label="Create account">
        <SocialAuthButtons referralCode={referralCode} />
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div><label className={labelClass} htmlFor="firstName">First name</label><input id="firstName" autoComplete="given-name" required className={inputClass} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Your first name" /></div>
          <div><label className={labelClass} htmlFor="lastName">Last name</label><input id="lastName" autoComplete="family-name" required className={inputClass} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Your last name" /></div>
          <div className="sm:col-span-2"><label className={labelClass} htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="name@example.com" /></div>
          <div><label className={labelClass} htmlFor="password">Password</label><PasswordField id="password" autoComplete="new-password" minLength={8} required className={inputClass} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" /></div>
          <div><label className={labelClass} htmlFor="confirmPassword">Confirm password</label><PasswordField id="confirmPassword" autoComplete="new-password" minLength={8} required className={inputClass} value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="Enter it again" /></div>
          <p className="text-xs font-normal leading-5 text-slate-500 sm:col-span-2">Use a unique password. You can add an authenticator app after verifying your email.</p>
          {error && <p role="alert" className="rounded-lg border border-crimson/25 bg-crimson/10 px-3 py-2.5 text-sm font-semibold text-crimson sm:col-span-2">{error}</p>}
          <button disabled={busy} className="h-11 rounded-lg bg-neon text-sm font-black text-surface hover:bg-neon/90 disabled:opacity-60 sm:col-span-2">{busy ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="mt-5 text-center text-sm font-normal text-slate-400">Already registered? <Link href={"/login" as Route} className="font-bold text-neon hover:underline">Sign in</Link></p>
      </section>
    </div>
  );
}
