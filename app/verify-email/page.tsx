"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { apiPost } from "@/lib/client-api";

export default function VerifyEmailPage() { return <Suspense><VerifyContent /></Suspense>; }
function VerifyContent() {
  const router = useRouter(); const query = useSearchParams(); const token = query.get("token"); const email = query.get("email") || ""; const preview = query.get("preview");
  const [state, setState] = useState<"waiting" | "verifying" | "error">(token ? "verifying" : "waiting"); const [message, setMessage] = useState("");
  useEffect(() => { if (!token) return; apiPost("/api/auth/verify-email", { token }).then(() => { window.dispatchEvent(new Event("fantasyx:data-changed")); router.replace("/onboarding" as Route); router.refresh(); }).catch((reason) => { setState("error"); setMessage(reason instanceof Error ? reason.message : "Verification failed"); }); }, [router, token]);
  async function resend() { if (!email) return; await apiPost("/api/auth/resend-verification", { email }); setMessage("A new link has been sent."); }
  return <div className="mx-auto max-w-md py-12 text-center"><MailCheck className="mx-auto mb-4 h-10 w-10 text-neon" /><h1 className="text-2xl font-black text-frost">{state === "verifying" ? "Verifying your email" : state === "error" ? "Link could not be verified" : "Check your email"}</h1><p className="mx-auto mt-3 max-w-sm text-sm font-normal text-slate-400">{state === "waiting" ? `We sent a verification link${email ? ` to ${email}` : ""}. Open it to activate your account.` : state === "verifying" ? "This will only take a moment." : message}</p>{state === "waiting" && <div className="mt-6 space-y-3"><button type="button" onClick={resend} className="h-10 rounded-lg border border-rim px-4 text-sm font-bold text-frost hover:border-slate-500">Resend email</button>{preview && <p><a href={preview} className="text-xs font-semibold text-neon underline">Open development verification link</a></p>}</div>}{state === "error" && <p className="mt-6"><Link href={"/login" as Route} className="font-bold text-neon hover:underline">Return to sign in</Link></p>}{message && state === "waiting" && <p className="mt-4 text-sm font-semibold text-neon">{message}</p>}</div>;
}
