#!/usr/bin/env node
import process from "node:process";

const baseUrl = (process.env.LOAD_TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const requests = boundedInteger(process.env.LOAD_TEST_REQUESTS, 100, 1, 5000);
const concurrency = boundedInteger(process.env.LOAD_TEST_CONCURRENCY, 5, 1, 50);
const paths = ["/api/health", "/api/exchange-status", "/login"];
const timings = [];
const failures = [];
let nextRequest = 0;

async function worker() {
  while (true) {
    const index = nextRequest++;
    if (index >= requests) return;
    const path = paths[index % paths.length];
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "user-agent": "FantasyX controlled load test" },
        signal: AbortSignal.timeout(10_000)
      });
      timings.push(Date.now() - startedAt);
      if (!response.ok) failures.push(`${path}: HTTP ${response.status}`);
      await response.arrayBuffer();
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
timings.sort((a, b) => a - b);
const percentile = (value) => timings[Math.min(timings.length - 1, Math.floor(timings.length * value))] ?? 0;
const failureRate = failures.length / requests;

console.log(JSON.stringify({
  baseUrl,
  requests,
  concurrency,
  succeeded: requests - failures.length,
  failed: failures.length,
  failureRate,
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: timings.at(-1) ?? 0 },
  sampleFailures: failures.slice(0, 5)
}, null, 2));

if (failureRate > 0.01) process.exit(1);

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
