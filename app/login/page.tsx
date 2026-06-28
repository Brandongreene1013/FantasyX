"use client";

import { Suspense, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <>
      <PageHeading title="Log In" kicker="FantasyX account">
        <span>Use your FantasyX account to access mock-credit markets.</span>
      </PageHeading>
    </>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/markets";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<SessionResponse>("/api/session")
      .then((data) => {
        if (active && data.user) {
          router.replace(next as Route);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [next, router]);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiPost("/api/auth/login", { email, password });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      router.push(next as Route);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeading title="Log In" kicker="FantasyX account">
        <span>Trade NFL fantasy markets with your own mock-credit portfolio.</span>
      </PageHeading>

      <section className="mx-auto max-w-xl rounded border border-ink/10 bg-white p-5 shadow-soft" aria-labelledby="login-heading">
        <h2 id="login-heading" className="text-lg font-black">Welcome back</h2>
        <form className="mt-4 grid gap-4" onSubmit={submitLogin}>
          <div>
            <label className="text-sm font-black" htmlFor="email">Email</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="password">Password</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error ? <p className="rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{error}</p> : null}
          <button className="rounded bg-field px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm font-semibold text-ink/70">
          New to FantasyX? <Link className="font-black text-field underline" href={"/signup" as Route}>Create an account</Link>
        </p>
      </section>
    </>
  );
}
