"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { apiGet } from "@/lib/client-api";
import { credits } from "@/lib/format";

type AccountResponse = {
  account: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    email: string | null;
    role: "TRADER" | "ADMIN";
    isAdmin: boolean;
    mockBalance: number;
    startingBalance: number;
    joinedAt: string;
    openPositions: number;
    totalTrades: number;
    portfolioPnl: number;
  };
};

export default function AccountPage() {
  const [data, setData] = useState<AccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiGet<AccountResponse>("/api/account")
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load account"))
      .finally(() => setIsLoading(false));
  }, []);

  const account = data?.account;

  return (
    <>
      <PageHeading title="Account" kicker="Platform identity">
        <span>Your FantasyX account, mock-credit balance, and portfolio summary.</span>
      </PageHeading>

      {isLoading ? <StatePanel text="Loading account..." /> : null}
      {error ? <StatePanel text={error} tone="error" /> : null}

      {account ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded border border-ink/10 bg-white p-5 shadow-soft" aria-labelledby="identity-heading">
            <h2 id="identity-heading" className="text-lg font-black">Identity</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold">
              <InfoRow label="Name" value={`${account.firstName} ${account.lastName}`} />
              <InfoRow label="Display Name" value={account.displayName} />
              <InfoRow label="Email" value={account.email ?? "Not set"} />
              <InfoRow label="Role" value={account.isAdmin ? "Admin" : "Trader"} />
              <InfoRow label="Joined" value={new Date(account.joinedAt).toLocaleDateString()} />
            </div>
            <Link className="mt-5 inline-flex rounded bg-ink px-4 py-2 text-sm font-black text-white hover:bg-field" href={"/settings" as Route}>Edit settings</Link>
          </section>

          <section className="rounded border border-ink/10 bg-white p-5 shadow-soft" aria-labelledby="portfolio-heading">
            <h2 id="portfolio-heading" className="text-lg font-black">Portfolio Summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric label="Mock Credit Balance" value={credits(account.mockBalance)} />
              <Metric label="Starting Balance" value={credits(account.startingBalance)} />
              <Metric label="Open Positions" value={String(account.openPositions)} />
              <Metric label="Total Trades" value={String(account.totalTrades)} />
              <Metric label="All-Time P&L" value={`${account.portfolioPnl >= 0 ? "+" : ""}${credits(account.portfolioPnl)}`} tone={account.portfolioPnl >= 0 ? "positive" : "negative"} />
            </div>
            <Link className="mt-5 inline-flex rounded bg-field px-4 py-2 text-sm font-black text-white hover:bg-ink" href={"/portfolio" as Route}>View portfolio</Link>
          </section>
        </div>
      ) : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/5 pb-2">
      <span className="text-ink/60">{label}</span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  const valueClass = tone === "positive" ? "text-field" : tone === "negative" ? "text-rush" : "text-ink";
  return (
    <div className="rounded border border-ink/10 bg-chalk p-4">
      <p className="text-xs font-black uppercase tracking-normal text-ink/55">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function StatePanel({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "error" }) {
  return <div className={`rounded border p-4 text-sm font-bold ${tone === "error" ? "border-rush/20 bg-rush/10 text-rush" : "border-ink/10 bg-white text-ink/70"}`}>{text}</div>;
}
