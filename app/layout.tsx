import type { Metadata } from "next";
import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import { SiteNav } from "@/components/site-nav";
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
              <SiteNav />
            </div>
            <AccountBar />
          </header>
          <main id="main-content" className="mx-auto max-w-6xl px-4 py-5 sm:py-8" tabIndex={-1}>{children}</main>
          <footer className="mx-auto hidden max-w-6xl px-4 pb-8 text-xs font-semibold text-ink/70 sm:block">
            FantasyX is a free-play mock-credit MVP. No real-money wagering or crypto settlement.
          </footer>
        </div>
      </body>
    </html>
  );
}
