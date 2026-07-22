"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPatch, type SessionResponse } from "@/lib/client-api";
import { AuthRequiredState } from "@/components/auth-required-state";
import { SecuritySettings } from "@/components/auth/security-settings";
import { WalletConnectionPanel } from "@/components/solana/wallet-connection-panel";

const ALERT_PREFS = [
  { key: "marketAlerts", label: "Market Alerts", description: "Price alerts, locking soon, and board movement." },
  { key: "portfolioAlerts", label: "Portfolio Alerts", description: "Position changes, filled trades, and P&L swings." },
  { key: "leaderboardAlerts", label: "Leaderboard Alerts", description: "Rank movement and weekly competition updates." },
  { key: "sundayLiveAlerts", label: "Sunday Live Alerts", description: "Live game, player tracker, and command center signals." },
  { key: "futurePushNotifications", label: "Future Push Notifications", description: "Reserve permission for future push delivery." }
] as const;

type AlertPrefKey = typeof ALERT_PREFS[number]["key"];
type AlertPrefs = Record<AlertPrefKey, boolean>;
const defaultAlertPrefs: AlertPrefs = {
  marketAlerts: true,
  portfolioAlerts: true,
  leaderboardAlerts: true,
  sundayLiveAlerts: true,
  futurePushNotifications: false
};

export default function SettingsPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "" });
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(defaultAlertPrefs);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const storedPrefs = window.localStorage.getItem("fantasyx:alert-preferences");
    if (storedPrefs) {
      try {
        setAlertPrefs({ ...defaultAlertPrefs, ...(JSON.parse(storedPrefs) as Partial<AlertPrefs>) });
      } catch { /* ignore malformed local preference cache */ }
    }
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    apiGet<SessionResponse>("/api/session")
      .then((data) => {
        if (data.user) {
          setForm({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            displayName: data.user.displayName
          });
        } else {
          setIsGuest(true);
        }
      })
      .catch(() => setIsGuest(true))
      .finally(() => setIsLoading(false));
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await apiPatch("/api/settings", form);
      setMessage("Settings saved.");
      window.dispatchEvent(new Event("fantasyx:data-changed"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save settings");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAlertPref(key: AlertPrefKey) {
    setAlertPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem("fantasyx:alert-preferences", JSON.stringify(next));
      return next;
    });
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }

  if (!isLoading && isGuest) {
    return <AuthRequiredState title="Settings require an account" description="Log in to manage your profile and personalized alert preferences." next="/settings" />;
  }

  return (
    <>
      <PageHeading title="Settings" kicker="Profile">
        <span>Update the identity shown on your FantasyX portfolio and leaderboard.</span>
      </PageHeading>

      <section className="mx-auto max-w-2xl rounded border border-ink/10 bg-white p-5 shadow-soft" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-lg font-black">Profile</h2>
        {isLoading ? <p className="mt-4 text-sm font-bold text-ink/70">Loading settings...</p> : null}
        <form className="mt-4 grid gap-4" onSubmit={saveSettings}>
          <div>
            <label className="text-sm font-black" htmlFor="firstName">First Name</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="firstName" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="lastName">Last Name</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="lastName" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-black" htmlFor="displayName">Display Name</label>
            <input className="mt-1 w-full rounded border border-ink/15 px-3 py-2 font-semibold" id="displayName" value={form.displayName} onChange={(event) => updateField("displayName", event.target.value)} required />
          </div>
          {error ? <p className="rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{error}</p> : null}
          {message ? <p className="rounded bg-field/10 px-3 py-2 text-sm font-bold text-field" role="status">{message}</p> : null}
          <button className="rounded bg-field px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving || isLoading} type="submit">
            {isSaving ? "Saving..." : "Save settings"}
          </button>
        </form>
      </section>

      {!isLoading ? <SecuritySettings /> : null}
      {!isLoading ? <WalletConnectionPanel /> : null}

      <section className="mx-auto mt-5 max-w-2xl rounded border border-rim bg-panel p-5" aria-labelledby="notification-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="notification-heading" className="text-lg font-black text-frost">Notification Preferences</h2>
            <p className="mt-1 text-sm font-semibold text-muted">Control the alerts used by Live Sunday mode and the installable app shell.</p>
          </div>
          <button
            className="rounded border border-neon/30 bg-neon/10 px-3 py-2 text-xs font-black text-neon disabled:opacity-50"
            type="button"
            disabled={notificationPermission !== "default"}
            onClick={requestNotificationPermission}
          >
            {notificationPermission === "granted" ? "Notifications On" : notificationPermission === "denied" ? "Blocked" : notificationPermission === "unsupported" ? "Unsupported" : "Enable Browser Alerts"}
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {ALERT_PREFS.map((pref) => (
            <label key={pref.key} className="flex items-center justify-between gap-4 rounded border border-rim bg-panel2 p-3">
              <span>
                <span className="block text-sm font-black text-frost">{pref.label}</span>
                <span className="block text-xs font-semibold text-muted">{pref.description}</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-neon"
                checked={alertPrefs[pref.key]}
                onChange={() => toggleAlertPref(pref.key)}
              />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
