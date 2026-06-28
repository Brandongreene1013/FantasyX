"use client";

import { Suspense, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";
import { safeInternalPath } from "@/lib/redirects";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginLoading() {
  return <div className="mx-auto max-w-md py-10 text-center text-sm font-semibold text-muted">Loading…</div>;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<SessionResponse>("/api/session").then((d) => { if (active && d.user) router.replace("/markets" as Route); }).catch(() => undefined);
    return () => { active = false; };
  }, [next, router]);

  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setIsSubmitting(true);
    try {
      await apiPost("/api/auth/login", { email, password });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      router.push(next as Route); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neon text-surface font-black text-lg">FX</div>
        <h1 className="text-2xl font-black text-frost">Welcome back</h1>
        <p className="mt-1 text-sm font-semibold text-muted">Sign in to your FantasyX account</p>
      </div>

      <section className="rounded-2xl border border-rim bg-panel p-6" aria-labelledby="login-heading">
        <h2 id="login-heading" className="sr-only">Log in</h2>
        <form className="space-y-4" onSubmit={submitLogin}>
          <div>
            <label className="text-xs font-black text-frost" htmlFor="email">Email</label>
            <input
              id="email" name="email" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-1.5 h-11 w-full rounded-xl border border-rim bg-panel2 px-3 text-sm font-semibold text-frost placeholder:text-muted outline-none focus:border-neon/50 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-black text-frost" htmlFor="password">Password</label>
            <input
              id="password" name="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
              className="mt-1.5 h-11 w-full rounded-xl border border-rim bg-panel2 px-3 text-sm font-semibold text-frost placeholder:text-muted outline-none focus:border-neon/50 transition-colors"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="rounded-xl bg-crimson/10 border border-crimson/20 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p>}
          <button
            className="h-12 w-full rounded-xl bg-neon font-black text-surface hover:bg-neon/90 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting} type="submit"
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm font-semibold text-muted">
          New to FantasyX?{" "}
          <Link className="font-black text-neon hover:underline" href={"/signup" as Route}>Create an account</Link>
        </p>
      </section>
    </div>
  );
}
