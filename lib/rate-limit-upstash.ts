import type { RateLimitAdapter, RateLimitResult } from "@/lib/rate-limit";

/**
 * Upstash-Redis-backed rate limit adapter (fixed window).
 *
 * Talks to the Upstash REST API directly with `fetch`, so it works in both the
 * Node.js runtime and the edge runtime without extra dependencies.
 *
 * Window algorithm: INCR the key, set its expiry to the window length only if
 * it has no expiry yet (PEXPIRE ... NX), then read the remaining TTL. All three
 * commands run in one pipeline round trip.
 *
 * Failure policy: fail open. If Redis is unreachable or misconfigured the
 * request is allowed and the error is logged (without the token) — a broken
 * limiter must not take down trading for a free-play product.
 */

interface UpstashPipelineEntry {
  result?: unknown;
  error?: string;
}

const KEY_PREFIX = "fx:rl:";

export class UpstashRateLimitAdapter implements RateLimitAdapter {
  private readonly restUrl: string;
  private readonly restToken: string;

  constructor(restUrl: string, restToken: string) {
    this.restUrl = restUrl.replace(/\/+$/, "");
    this.restToken = restToken;
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `${KEY_PREFIX}${key}`;
    const now = Date.now();

    try {
      const entries = await this.pipeline([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs), "NX"],
        ["PTTL", redisKey]
      ]);

      const count = readNumber(entries[0]);
      const ttlMs = readNumber(entries[2]);

      if (count === null) {
        return failOpen(limit, windowMs, now, entries[0]?.error);
      }

      const resetAt = now + (ttlMs !== null && ttlMs > 0 ? ttlMs : windowMs);
      return {
        success: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt
      };
    } catch (error) {
      return failOpen(limit, windowMs, now, error instanceof Error ? error.message : "request failed");
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.pipeline([["DEL", `${KEY_PREFIX}${key}`]]);
    } catch (error) {
      logUpstashError(error instanceof Error ? error.message : "reset failed");
    }
  }

  private async pipeline(commands: Array<Array<string>>): Promise<UpstashPipelineEntry[]> {
    const response = await fetch(`${this.restUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commands),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Upstash pipeline responded ${response.status}`);
    }

    return (await response.json()) as UpstashPipelineEntry[];
  }
}

function readNumber(entry: UpstashPipelineEntry | undefined): number | null {
  if (!entry || entry.error !== undefined || typeof entry.result !== "number") {
    return null;
  }
  return entry.result;
}

function failOpen(limit: number, windowMs: number, now: number, detail?: string): RateLimitResult {
  logUpstashError(detail ?? "unexpected pipeline response");
  return { success: true, remaining: limit, resetAt: now + windowMs };
}

function logUpstashError(detail: string) {
  // Never include the REST token or URL credentials in logs.
  console.error(`[FantasyX Rate Limit] Upstash request failed (failing open): ${detail}`);
}
