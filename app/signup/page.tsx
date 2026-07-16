"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<SessionResponse>("/api/session").then((d) => { if (active && d.user) router.replace("/markets" as Route); }).catch(() => undefined);
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24));
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((cur) => ({ ...cur, [field]: value }));
  }

  async function submitSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setIsSubmitting(true);
    try {
      await apiPost("/api/auth/signup", { ...form, referralCode: referralCode || undefined });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      router.push("/onboarding" as Route); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally { setIsSubmitting(false); }
  }

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-rim bg-panel2 px-3 text-sm font-semibold text-frost placeholder:text-muted outline-none focus:border-neon/50 transition-colors";
  const labelClass = "text-xs font-black text-frost";

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neon text-surface font-black text-lg">FX</div>
        <h1 className="text-2xl font-black text-frost">Join FantasyX</h1>
        {referralCode && (
          <div className="mx-auto mt-4 flex max-w-sm items-center justify-center gap-2 rounded-xl border border-neon/25 bg-neon/10 px-3 py-2 text-xs font-black text-neon">
            <Users className="h-3.5 w-3.5" aria-hidden />
            INVITED WITH CODE {referralCode}
          </div>
        )}
        <p className="mt-1 text-sm font-semibold text-muted">Free account · 10,000 mock credits · No deposits</p>
      </div>

      <section className="rounded-2xl border border-rim bg-panel p-6" aria-labelledby="signup-heading">
        <h2 id="signup-heading" className="sr-only">Create account</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitSignup}>
          <div>
            <label className={labelClass} htmlFor="firstName">First Name</label>
            <input className={inputClass} id="firstName" autoComplete="given-name" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} required placeholder="Josh" />
          </div>
          <div>
            <label className={labelClass} htmlFor="lastName">Last Name</label>
            <input className={inputClass} id="lastName" autoComplete="family-name" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} required placeholder="Allen" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="email">Email</label>
            <input className={inputClass} id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required placeholder="you@example.com" />
          </div>
          <div>
            <label className={labelClass} htmlFor="password">Password</label>
            <input className={inputClass} id="password" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => updateField("password", e.target.value)} required placeholder="8+ characters" />
          </div>
          <div>
            <label className={labelClass} htmlFor="confirmPassword">Confirm</label>
            <input className={inputClass} id="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} required placeholder="Repeat password" />
          </div>
          {error && <p className="rounded-xl bg-crimson/10 border border-crimson/20 px-4 py-2.5 text-sm font-bold text-crimson sm:col-span-2" role="alert">{error}</p>}
          <button
            className="h-12 w-full rounded-xl bg-neon font-black text-surface hover:bg-neon/90 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed sm:col-span-2"
            disabled={isSubmitting} type="submit"
          >
            {isSubmitting ? "Creating account…" : "Create free account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm font-semibold text-muted">
          Already have an account?{" "}
          <Link className="font-black text-neon hover:underline" href={"/login" as Route}>Log in</Link>
        </p>
      </section>
    </div>
  );
}
