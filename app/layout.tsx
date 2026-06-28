import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "FantasyX",
  description: "Weekly NFL fantasy football prediction market MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="min-h-screen">
          <header className="sticky top-0 z-20 border-b border-ink/10 bg-chalk/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded px-1" aria-label="FantasyX home">
                <span className="grid h-9 w-9 place-items-center rounded bg-field text-sm font-black text-white">FX</span>
                <span className="text-lg font-black tracking-normal">FantasyX</span>
              </Link>
              <nav className="hidden items-center gap-1 text-sm font-semibold text-ink/70 sm:flex" aria-label="Primary navigation">
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href="/markets">Markets</Link>
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href="/portfolio">Portfolio</Link>
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href={"/history" as Route}>History</Link>
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href="/leaderboard">Leaderboard</Link>
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href="/admin">Admin</Link>
                <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href={"/login" as Route}>Login</Link>
              </nav>
            </div>
            <AccountBar />
          </header>
          <main id="main-content" className="mx-auto max-w-6xl px-4 py-5 sm:py-8" tabIndex={-1}>{children}</main>
          <footer className="mx-auto hidden max-w-6xl px-4 pb-8 text-xs font-semibold text-ink/70 sm:block">
            FantasyX is a free-play mock-credit MVP. No real-money wagering or crypto settlement.
          </footer>
          <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-ink/10 bg-chalk/95 text-center text-xs font-bold text-ink/70 backdrop-blur sm:hidden" aria-label="Mobile navigation">
            <Link className="inline-flex min-h-11 items-center justify-center py-3" href="/markets">Markets</Link>
            <Link className="inline-flex min-h-11 items-center justify-center py-3" href="/portfolio">Portfolio</Link>
            <Link className="inline-flex min-h-11 items-center justify-center py-3" href={"/history" as Route}>History</Link>
            <Link className="inline-flex min-h-11 items-center justify-center py-3" href="/leaderboard">Rank</Link>
            <Link className="inline-flex min-h-11 items-center justify-center py-3" href="/admin">Admin</Link>
          </nav>
        </div>
      </body>
    </html>
  );
}
