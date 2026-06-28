"use client";

import { Suspense, useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPost } from "@/lib/client-api";
import { credits } from "@/lib/format";

type DemoUser = {
  id: string;
  name: string;
  isAdmin: boolean;
  mockBalance: number;
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <>
      <PageHeading title="Select Demo Account" kicker="Mock auth">
        <span>Choose a free-play account. No passwords, wallets, or real funds.</span>
      </PageHeading>
      <section className="rounded border border-ink/10 bg-white p-4 shadow-soft" aria-labelledby="demo-account-loading-heading">
        <h2 id="demo-account-loading-heading" className="text-lg font-black">Demo accounts</h2>
        <p className="mt-4 text-sm font-bold text-ink/70">Loading accounts...</p>
      </section>
    </>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/markets";
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<{ users: DemoUser[] }>("/api/auth/demo-users")
      .then((data) => {
        if (active) {
          setUsers(data.users);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load demo accounts");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function selectAccount(userId: string) {
    setError(null);
    try {
      await apiPost("/api/auth/login", { userId });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      router.push(next as Route);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    }
  }

  return (
    <>
      <PageHeading title="Select Demo Account" kicker="Mock auth">
        <span>Choose a free-play account. No passwords, wallets, or real funds.</span>
      </PageHeading>

      <section className="rounded border border-ink/10 bg-white p-4 shadow-soft" aria-labelledby="demo-account-heading">
        <h2 id="demo-account-heading" className="text-lg font-black">Demo accounts</h2>
        <p className="mt-1 text-sm font-semibold text-ink/70">Your selection is stored in an httpOnly session cookie.</p>

        {isLoading ? <p className="mt-4 text-sm font-bold text-ink/70">Loading accounts...</p> : null}
        {error ? <p className="mt-4 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{error}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <button
              className="rounded border border-ink/10 bg-chalk p-4 text-left transition hover:border-field hover:bg-white"
              key={user.id}
              onClick={() => selectAccount(user.id)}
              type="button"
            >
              <span className="block text-lg font-black">{user.name}</span>
              <span className="mt-1 block text-sm font-semibold text-ink/70">{credits(user.mockBalance)} mock balance</span>
              {user.isAdmin ? <span className="mt-3 inline-block rounded bg-gold/20 px-2 py-1 text-xs font-black text-ink">Admin</span> : null}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
