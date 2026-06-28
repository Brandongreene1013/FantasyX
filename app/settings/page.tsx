"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { apiGet, apiPatch, type SessionResponse } from "@/lib/client-api";

export default function SettingsPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiGet<SessionResponse>("/api/session")
      .then((data) => {
        if (data.user) {
          setForm({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            displayName: data.user.displayName
          });
        }
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load settings"))
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
    </>
  );
}
