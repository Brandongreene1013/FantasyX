"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";

const loggedInLinks: Array<{ href: Route; label: string }> = [
  { href: "/markets" as Route, label: "Markets" },
  { href: "/portfolio" as Route, label: "Portfolio" },
  { href: "/leaderboard" as Route, label: "Leaderboard" },
  { href: "/account" as Route, label: "Account" },
  { href: "/settings" as Route, label: "Settings" }
];

const loggedOutLinks: Array<{ href: Route; label: string }> = [
  { href: "/login" as Route, label: "Login" },
  { href: "/signup" as Route, label: "Sign Up" }
];

export function SiteNav() {
  const [session, setSession] = useState<SessionResponse["user"] | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    function loadSession() {
      apiGet<SessionResponse>("/api/session")
        .then((data) => {
          if (active) {
            setSession(data.user);
            setHasLoaded(true);
          }
        })
        .catch(() => {
          if (active) {
            setSession(null);
            setHasLoaded(true);
          }
        });
    }

    loadSession();
    window.addEventListener("fantasyx:data-changed", loadSession);
    return () => {
      active = false;
      window.removeEventListener("fantasyx:data-changed", loadSession);
    };
  }, []);

  async function logout() {
    await apiPost("/api/auth/logout", {});
    window.dispatchEvent(new Event("fantasyx:data-changed"));
    window.location.href = "/login";
  }

  const links = hasLoaded && session ? loggedInLinks : loggedOutLinks;
  const visibleLinks = session?.isAdmin ? [...links, { href: "/admin" as Route, label: "Admin" }] : links;

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm font-semibold text-ink/70 sm:flex" aria-label="Primary navigation">
        {visibleLinks.map((link) => (
          <Link className="inline-flex min-h-11 items-center rounded px-3 py-2 hover:bg-ink/5" href={link.href} key={link.href}>{link.label}</Link>
        ))}
        {session ? (
          <button className="inline-flex min-h-11 items-center rounded px-3 py-2 font-semibold text-ink/70 hover:bg-ink/5" onClick={logout} type="button">Logout</button>
        ) : null}
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-ink/10 bg-chalk/95 text-center text-xs font-bold text-ink/70 backdrop-blur sm:hidden" aria-label="Mobile navigation">
        {(session ? visibleLinks.slice(0, 4) : loggedOutLinks).map((link) => (
          <Link className="inline-flex min-h-11 items-center justify-center py-3" href={link.href} key={link.href}>{link.label}</Link>
        ))}
      </nav>
    </>
  );
}
