import Link from "next/link";
import type { Route } from "next";
import { LogIn, UserPlus } from "lucide-react";

export function AuthRequiredState({
  title = "Log in to continue",
  description = "Sign in to access your FantasyX account, portfolio, and personalized activity.",
  next = "/markets",
  compact = false
}: {
  title?: string;
  description?: string;
  next?: string;
  compact?: boolean;
}) {
  const loginHref = `/login?next=${encodeURIComponent(next)}` as Route;

  return (
    <section className={`${compact ? "p-5" : "mx-auto max-w-2xl px-5 py-12"} rounded-xl border border-rim bg-panel text-center`} aria-label="Authentication required">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-neon/25 bg-neon/10 text-neon">
        <LogIn className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-black text-frost">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-muted">{description}</p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href={loginHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-neon px-5 text-sm font-black text-surface">
          <LogIn className="h-4 w-4" aria-hidden /> Log in
        </Link>
        <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rim bg-panel2 px-5 text-sm font-black text-frost">
          <UserPlus className="h-4 w-4" aria-hidden /> Create account
        </Link>
      </div>
    </section>
  );
}
