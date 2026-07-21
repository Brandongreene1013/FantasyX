"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, type SlateResponse, type LeaderboardResponse } from "@/lib/client-api";
import type { FeedEvent, ExchangeStatus, LiveExchangeState } from "@/lib/live-types";

const POLL_INTERVAL_MS = 12000;

function empty(): LiveExchangeState {
  return { markets: [], players: [], games: [], liveScores: [], feed: [], leaderboard: [], status: null, isConnected: false };
}

export function useLiveExchange(weekId: string): LiveExchangeState {
  const [state, setState] = useState<LiveExchangeState>(empty);
  const esRef    = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted  = useRef(true);

  const mergeSlate = useCallback((data: SlateResponse) => {
    setState((prev) => ({ ...prev, markets: data.markets, players: data.players, games: data.games, liveScores: data.liveScores ?? [], isConnected: true }));
  }, []);

  const mergeFeed = useCallback((data: { events: FeedEvent[] }) => {
    setState((prev) => ({ ...prev, feed: data.events }));
  }, []);

  const mergeLeaderboard = useCallback((data: LeaderboardResponse) => {
    setState((prev) => ({ ...prev, leaderboard: data.entries }));
  }, []);

  const mergeStatus = useCallback((data: ExchangeStatus) => {
    setState((prev) => ({ ...prev, status: data }));
  }, []);

  // Polling fallback
  const poll = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const [slate, lb, status] = await Promise.all([
        apiGet<SlateResponse>(`/api/slate?weekId=${weekId}`),
        apiGet<LeaderboardResponse>(`/api/leaderboard?weekId=${weekId}`).catch(() => ({ weekId, entries: [] })),
        apiGet<ExchangeStatus>(`/api/exchange-status?weekId=${weekId}`).catch(() => null)
      ]);
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        markets: slate.markets,
        players: slate.players,
        games: slate.games,
        liveScores: slate.liveScores ?? [],
        leaderboard: lb.entries,
        status: status ?? prev.status,
        isConnected: true
      }));
    } catch { /* ignore */ }
  }, [weekId]);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    void poll();
    timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }, [poll]);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clean up previous connection
    esRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);

    const es = new EventSource(`/api/sse?weekId=${weekId}`);
    esRef.current = es;

    es.addEventListener("slate", (e) => {
      try { mergeSlate(JSON.parse(e.data) as SlateResponse); } catch { /* ignore */ }
    });
    es.addEventListener("feed", (e) => {
      try { mergeFeed(JSON.parse(e.data) as { events: FeedEvent[] }); } catch { /* ignore */ }
    });
    es.addEventListener("leaderboard", (e) => {
      try { mergeLeaderboard(JSON.parse(e.data) as LeaderboardResponse); } catch { /* ignore */ }
    });
    es.addEventListener("status", (e) => {
      try { mergeStatus(JSON.parse(e.data) as ExchangeStatus); } catch { /* ignore */ }
    });

    // On error: fall back to polling
    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (!mounted.current) return;
      setState((prev) => ({ ...prev, isConnected: false }));
      startPolling();
    };
  }, [weekId, mergeSlate, mergeFeed, mergeLeaderboard, mergeStatus, startPolling]);

  useEffect(() => {
    mounted.current = true;

    // Hydrate immediately from the normal JSON endpoint. SSE can stay open yet
    // fail to deliver an initial event, which must not leave discovery empty.
    void poll();

    // Layer live events on top; browsers without EventSource continue polling.
    if (typeof EventSource !== "undefined") {
      connect();
    } else {
      startPolling();
    }

    const refresh = () => void poll();
    window.addEventListener("fantasyx:data-changed", refresh);

    return () => {
      mounted.current = false;
      esRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("fantasyx:data-changed", refresh);
    };
  }, [connect, poll, startPolling]);

  return state;
}
