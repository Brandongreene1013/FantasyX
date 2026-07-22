"use client";

import { useEffect, useState } from "react";
import { Apple, Chrome, Grid2X2 } from "lucide-react";
import { apiGet } from "@/lib/client-api";

type Provider = "google" | "apple" | "microsoft";
const providerMeta = {
  google: { label: "Continue with Google", Icon: Chrome },
  apple: { label: "Continue with Apple", Icon: Apple },
  microsoft: { label: "Continue with Microsoft", Icon: Grid2X2 }
} satisfies Record<Provider, { label: string; Icon: typeof Chrome }>;

export function SocialAuthButtons({ next = "/", referralCode }: { next?: string; referralCode?: string }) {
  const [providers, setProviders] = useState<Record<Provider, boolean> | null>(null);
  useEffect(() => {
    apiGet<{ providers: Record<Provider, boolean> }>("/api/auth/providers").then((data) => setProviders(data.providers)).catch(() => setProviders(null));
  }, []);
  const enabled = providers ? (Object.keys(providerMeta) as Provider[]).filter((provider) => providers[provider]) : [];
  if (!enabled.length) return null;

  function signIn(provider: Provider) {
    const params = new URLSearchParams({ next });
    if (referralCode) params.set("ref", referralCode);
    if (/Electron/i.test(navigator.userAgent)) params.set("desktop", "1");
    window.location.assign(`/api/auth/oauth/${provider}?${params}`);
  }

  return (
    <div className="space-y-2.5">
      {enabled.map((provider) => {
        const { label, Icon } = providerMeta[provider];
        return (
          <button key={provider} type="button" onClick={() => signIn(provider)}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-rim bg-panel2 text-sm font-bold text-frost transition-colors hover:border-slate-500 hover:bg-slate-800">
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        );
      })}
      <div className="flex items-center gap-3 py-1" aria-hidden>
        <span className="h-px flex-1 bg-rim" /><span className="text-[11px] font-semibold uppercase text-slate-500">or use email</span><span className="h-px flex-1 bg-rim" />
      </div>
    </div>
  );
}
