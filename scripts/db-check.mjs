#!/usr/bin/env node
/**
 * Checks whether DATABASE_URL points at a reachable PostgreSQL server.
 * This is intentionally transport-level: it catches the common local/dev
 * failure before Prisma prints a long connection stack.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const timeoutMs = Number(process.env.DB_CHECK_TIMEOUT_MS ?? 5000);

export function loadDotEnvValue(key) {
  if (process.env[key]) return process.env[key];

  for (const filename of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(path.join(root, filename), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (match && match[1] === key) {
          return match[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Missing env files are fine; fall through to a clear failure.
    }
  }

  return undefined;
}

export function describeDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return {
      ok: false,
      detail: "DATABASE_URL is not set. Create .env.local or .env from .env.example and add a Postgres URL."
    };
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return { ok: false, detail: "DATABASE_URL is not a valid URL." };
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    return { ok: false, detail: `DATABASE_URL must use postgres:// or postgresql://, not ${parsed.protocol}` };
  }

  return {
    ok: true,
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, "") || "(default)",
    isLocalhost: ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
  };
}

export function checkPostgresReachable(databaseUrl = loadDotEnvValue("DATABASE_URL")) {
  const description = describeDatabaseUrl(databaseUrl);
  if (!description.ok) {
    return Promise.resolve(description);
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: description.host,
      port: description.port,
      timeout: timeoutMs
    });

    const finish = (ok, detail) => {
      socket.destroy();
      resolve({ ...description, ok, detail });
    };

    socket.once("connect", () => finish(true, `Connected to ${description.host}:${description.port}.`));
    socket.once("timeout", () => finish(false, `Connection to ${description.host}:${description.port} timed out after ${timeoutMs}ms.`));
    socket.once("error", (error) => finish(false, `${error.code ?? "ERROR"} connecting to ${description.host}:${description.port}.`));
  });
}

export function printDatabaseHelp(result) {
  console.error(`Postgres is not reachable: ${result.detail}`);
  console.error("");
  console.error("Use one of these verification database paths:");
  console.error("");
  console.error("Hosted dev Postgres (recommended when Docker Desktop is unreliable):");
  console.error("  1. Create a free Neon, Supabase, Vercel Postgres, or other Postgres database.");
  console.error("  2. Put its connection string in .env.local as DATABASE_URL.");
  console.error("  3. Run: npm run db:prepare");
  console.error("  4. Run: npm run verify");
  console.error("");
  console.error("Local Docker Postgres (optional):");
  console.error("  1. Start Docker Desktop and wait for Docker Engine running.");
  console.error("  2. Run: docker compose up -d");
  console.error("  3. Run: npm run db:prepare");
  console.error("  4. Run: npm run verify");
  console.error("");
  console.error("No database available:");
  console.error("  Run: npm run verify:fast");
  console.error("  This proves lint, typecheck, the rate-limit unit tests, and build without silently skipping DB-backed tests.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await checkPostgresReachable();
  if (result.ok) {
    console.log(`Postgres reachable at ${result.host}:${result.port} (${result.database}).`);
    process.exit(0);
  }

  printDatabaseHelp(result);
  process.exit(1);
}
