import { InMemoryRateLimitAdapter, RateLimitError, type RateLimitAdapter } from "@/lib/rate-limit";
import { UpstashRateLimitAdapter } from "@/lib/rate-limit-upstash";

/**
 * Rate limiter selection, mirroring the provider factory pattern in
 * `lib/nfl-data/provider-config.ts`.
 *
 * When either the Upstash or Vercel KV REST credentials are set, limits are
 * enforced durably across all serverless instances. Otherwise we fall back to
 * the per-process in-memory adapter (fine for local dev, near-zero enforcement
 * on Vercel) and warn once.
 */

export type RateLimiterMode = "durable" | "memory";

export interface RateLimiterStatus {
  name: string;
  mode: RateLimiterMode;
  isConfigured: boolean;
  warning?: string;
}

export interface RouteRateLimit {
  name: string;
  limit: number;
  windowMs: number;
}

// Route-level limits. Coarse global limiting stays in middleware.ts.
export const RATE_LIMITS = {
  trade: { name: "trade", limit: 30, windowMs: 60_000 },
  auth: { name: "auth", limit: 10, windowMs: 60_000 },
  betaEvents: { name: "beta-events", limit: 60, windowMs: 60_000 }
} as const satisfies Record<string, RouteRateLimit>;

let cachedAdapter: RateLimitAdapter | null = null;
let warnedFallback = false;

function getRedisCredentials(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();

  return url && token ? { url, token } : null;
}

export function getRateLimiterStatus(): RateLimiterStatus {
  if (getRedisCredentials()) {
    return { name: "Upstash Redis", mode: "durable", isConfigured: true };
  }

  return {
    name: "In-memory",
    mode: "memory",
    isConfigured: false,
    warning:
      "Upstash REST credentials are not set. Rate limits are per-process only; configure Upstash before production."
  };
}

export function getConfiguredRateLimiter(): RateLimitAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const status = getRateLimiterStatus();

  if (status.mode === "durable") {
    const credentials = getRedisCredentials()!;
    cachedAdapter = new UpstashRateLimitAdapter(credentials.url, credentials.token);
    return cachedAdapter;
  }

  if (!warnedFallback && status.warning) {
    console.warn("[FantasyX Rate Limit]", status.warning);
    warnedFallback = true;
  }

  cachedAdapter = new InMemoryRateLimitAdapter();
  return cachedAdapter;
}

/**
 * Enforce a route-level rate limit. Throws RateLimitError (mapped by apiError
 * to a 429 with x-ratelimit-* headers) when the limit is exceeded.
 */
export async function enforceRateLimit(route: RouteRateLimit, key: string): Promise<void> {
  const adapter = getConfiguredRateLimiter();
  const result = await adapter.check(`${route.name}:${key}`, route.limit, route.windowMs);

  if (!result.success) {
    throw new RateLimitError(route.limit, result.remaining, result.resetAt);
  }
}

/** Best-effort client IP for per-IP limits behind the Vercel proxy. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

/** Test hook: clears the cached adapter and fallback warning state. */
export function resetRateLimiterForTests(): void {
  cachedAdapter = null;
  warnedFallback = false;
}
