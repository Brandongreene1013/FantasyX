"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { apiPost } from "@/lib/client-api";
import { PasswordField } from "@/components/auth/password-field";

export default function ResetPasswordPage() { return <Suspense><ResetContent /></Suspense>; }
function ResetContent() {
  const router = useRouter(); const token = useSearchParams().get("token") || ""; const [password, setPassword] = useState(""); const [confirmPassword, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await apiPost("/api/auth/reset-password", { token, password, confirmPassword }); router.push("/login?reset=1" as Route); } catch (reason) { setError(reason instanceof Error ? reason.message : "Reset failed"); } finally { setBusy(false); } }
  const input = "mt-1.5 h-11 w-full rounded-lg border border-rim bg-panel2 px-3 text-sm text-frost placeholder:text-slate-600 focus:border-neon/60 focus:outline-none";
  return <div className="mx-auto max-w-md py-12"><div className="mb-6 text-center"><h1 className="text-2xl font-black text-frost">Choose a new password</h1><p className="mt-2 text-sm text-slate-400">Use a password you do not use on another service.</p></div><form onSubmit={submit} className="space-y-4 rounded-lg border border-rim bg-panel p-6"><div><label htmlFor="password" className="text-xs font-semibold text-slate-300">New password</label><PasswordField id="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="At least 8 characters" /></div><div><label htmlFor="confirm" className="text-xs font-semibold text-slate-300">Confirm password</label><PasswordField id="confirm" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} className={input} placeholder="Enter it again" /></div>{error && <p role="alert" className="text-sm font-semibold text-crimson">{error}</p>}<button disabled={busy || !token} className="h-11 w-full rounded-lg bg-neon text-sm font-black text-surface disabled:opacity-60">{busy ? "Updating..." : "Update password"}</button></form></div>;
}
