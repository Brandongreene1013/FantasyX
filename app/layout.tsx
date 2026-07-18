import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import { SiteNav } from "@/components/site-nav";
import { ExchangeTicker } from "@/components/ui/exchange-ticker";
import { ExchangeStatusBar } from "@/components/ui/exchange-status";
import { PwaShell } from "@/components/pwa-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "FantasyX OS - NFL Fantasy Prediction Markets",
  description: "Installable free-play NFL fantasy prediction market command center. No deposits, withdrawals, crypto, or real-money wagering.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FantasyX"
  }
};

export const viewport: Viewport = {
  themeColor: "#00D46A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <PwaShell />
        <div className="flex min-h-screen flex-col">
          <div className="sticky top-0 z-20">
            <header className="border-b border-rim/60 bg-surface/95 backdrop-blur-xl">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
                <Link href="/" className="inline-flex min-h-10 items-center gap-2.5 rounded-lg px-1" aria-label="FantasyX home">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-neon text-xs font-black text-surface shadow-glow-sm">FX</span>
                  <span className="text-lg font-black tracking-tight text-frost">FantasyX</span>
                </Link>
                <SiteNav />
              </div>
              <div className="border-t border-rim/50 bg-panel/60">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 overflow-hidden px-4 py-1.5">
                  <ExchangeStatusBar />
                  <AccountBar />
                </div>
              </div>
            </header>
            <ExchangeTicker />
          </div>

          <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:py-8 sm:pb-8" tabIndex={-1}>
            {children}
          </main>

          <footer className="mx-auto hidden max-w-6xl px-4 pb-8 text-xs font-semibold text-muted sm:block">
            FantasyX is a free-play mock-credit platform. No real-money wagering. No crypto. No deposits or withdrawals.
          </footer>
        </div>
      </body>
    </html>
  );
}
