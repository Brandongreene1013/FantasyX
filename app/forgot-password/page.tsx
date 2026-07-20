"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Mail } from "lucide-react";
import { apiPost } from "@/lib/client-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await apiPost("/api/auth/forgot-password", { email }); setSent(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed"); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-md py-12"><div className="mb-6 text-center"><Mail className="mx-auto mb-3 h-8 w-8 text-neon" /><h1 className="text-2xl font-black text-frost">Reset your password</h1><p className="mt-2 text-sm font-normal text-slate-400">We will send a secure reset link if the address belongs to an account.</p></div><section className="rounded-lg border border-rim bg-panel p-6">{sent ? <div className="text-center"><p className="font-bold text-frost">Check your inbox</p><p className="mt-2 text-sm font-normal text-slate-400">The link expires in one hour.</p></div> : <form onSubmit={submit} className="space-y-4"><div><label htmlFor="email" className="text-xs font-semibold text-slate-300">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-rim bg-panel2 px-3 text-sm text-frost placeholder:text-slate-600 focus:border-neon/60 focus:outline-none" placeholder="name@example.com" /></div>{error && <p role="alert" className="text-sm font-semibold text-crimson">{error}</p>}<button disabled={busy} className="h-11 w-full rounded-lg bg-neon text-sm font-black text-surface disabled:opacity-60">{busy ? "Sending..." : "Send reset link"}</button></form>}<p className="mt-5 text-center text-sm text-slate-400"><Link href={"/login" as Route} className="font-bold text-neon hover:underline">Back to sign in</Link></p></section></div>;
}
