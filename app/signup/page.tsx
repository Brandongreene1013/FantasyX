"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { apiPost } from "@/lib/client-api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiPost("/api/auth/signup", form);
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      router.push("/markets" as Route);
      router.refresh();
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeading title="Create Account" kicker="10,000 mock credits">
        <span>Start trading free-play NFL fantasy markets with your own portfolio identity.</span>
      </PageHeading>
      <section className="mx-auto max-w-2xl rounded border border-ink/10 bg-white p-5 shadow-soft" aria-labelledby="signup-heading">
        <h2 id="signup-heading" className="text-lg font-black">Join FantasyX</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submitSignup}>
          <div>
            <label className="text-sm font-black" htmlFor="firstName">First Name</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="firstName" autoComplete="given-name" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="lastName">Last Name</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="lastName" autoComplete="family-name" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-black" htmlFor="email">Email</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="password">Password</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="password" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="confirmPassword">Confirm Password</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} required />
          </div>
          {error ? <p className="rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush sm:col-span-2" role="alert">{error}</p> : null}
          <button className="rounded bg-field px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm font-semibold text-ink/70">
          Already have an account? <Link className="font-black text-field underline" href={"/login" as Route}>Log in</Link>
        </p>
      </section>
    </>
  );
}
