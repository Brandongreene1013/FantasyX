/**
 * Rate limiting adapter interface.
 *
 * The default in-memory implementation is per-process and resets on restart.
 * For production multi-instance deployments, replace with a durable adapter
 * backed by Redis or another shared store.
 *
 * Example swap:
 *   export const defaultRateLimiter: RateLimitAdapter = new RedisRateLimitAdapter(redisClient);
 */

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

export interface RateLimitAdapter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimitAdapter implements RateLimitAdapter {
  private readonly store = new Map<string, InMemoryEntry>();

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      this.store.set(key, entry);
      return { success: true, remaining: limit - 1, resetAt: entry.resetAt };
    }

    entry.count++;
    const success = entry.count <= limit;
    return { success, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Singleton — replace with a durable adapter in production
export const defaultRateLimiter: RateLimitAdapter = new InMemoryRateLimitAdapter();

// Convenience helper for API route usage
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  adapter = defaultRateLimiter
): Promise<RateLimitResult> {
  return adapter.check(key, limit, windowMs);
}
