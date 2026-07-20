"use client";

import { Suspense, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { apiPost } from "@/lib/client-api";
import { safeInternalPath } from "@/lib/redirects";

export default function TwoFactorPage() { return <Suspense><TwoFactorContent /></Suspense>; }

function TwoFactorContent() {
  const router = useRouter(); const query = useSearchParams(); const next = safeInternalPath(query.get("next"));
  const [code, setCode] = useState(""); const [remember, setRemember] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await apiPost("/api/auth/2fa/verify", { code, trustDevice: remember }); window.dispatchEvent(new Event("fantasyx:data-changed")); router.push(next as Route); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Verification failed"); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-sm py-12"><div className="mb-6 text-center"><ShieldCheck className="mx-auto mb-3 h-9 w-9 text-neon" /><h1 className="text-xl font-black text-frost">Two-step verification</h1><p className="mt-2 text-sm font-normal text-slate-400">Enter the 6-digit code from your authenticator app, or use a recovery code.</p></div><form onSubmit={submit} className="space-y-4 rounded-lg border border-rim bg-panel p-6"><div><label htmlFor="code" className="text-xs font-semibold text-slate-300">Verification code</label><input id="code" autoFocus autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required className="mt-1.5 h-12 w-full rounded-lg border border-rim bg-panel2 px-3 text-center font-mono text-lg font-bold tracking-widest text-frost placeholder:text-slate-600 focus:border-neon/60 focus:outline-none" placeholder="000000" /></div><label className="flex items-center gap-2 text-sm font-normal text-slate-400"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#00D46A]" />Trust this device for 30 days</label>{error && <p role="alert" className="text-sm font-semibold text-crimson">{error}</p>}<button disabled={busy} className="h-11 w-full rounded-lg bg-neon text-sm font-black text-surface disabled:opacity-60">{busy ? "Verifying..." : "Verify and continue"}</button></form></div>;
}
