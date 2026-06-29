"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaShell() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsOnline(navigator.onLine);
    if ("Notification" in window) {
      setNotificationState(Notification.permission);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationState(result);
  }

  return (
    <>
      {!isOnline ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-amber/30 bg-amber/15 px-4 py-2 text-center font-mono text-[10px] font-black uppercase tracking-widest text-amber">
          Connection lost - showing cached FantasyX OS data
        </div>
      ) : null}

      {!isStandalone && deferredPrompt ? (
        <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 rounded-xl border border-neon/25 bg-panel/95 p-3 shadow-2xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:w-80">
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-neon">Install FantasyX OS</p>
          <p className="mt-1 text-xs font-semibold text-muted">Launch fullscreen, stay logged in, and keep Live Sunday open like a native app.</p>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded bg-neon px-3 py-2 text-xs font-black text-surface" type="button" onClick={installApp}>
              Install
            </button>
            <button className="rounded border border-rim px-3 py-2 text-xs font-black text-muted" type="button" onClick={() => setDeferredPrompt(null)}>
              Later
            </button>
          </div>
        </div>
      ) : null}

      {notificationState === "default" ? (
        <button
          type="button"
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] right-3 z-30 rounded-full border border-neon/30 bg-neon/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-wider text-neon shadow-xl sm:bottom-4 sm:right-4"
          onClick={enableNotifications}
        >
          Enable alerts
        </button>
      ) : null}
    </>
  );
}
