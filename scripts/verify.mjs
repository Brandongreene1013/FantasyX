#!/usr/bin/env node
/**
 * FantasyX verification runner.
 *
 * Modes:
 *   fast - lint, typecheck, focused no-DB rate-limit tests, build
 *   full - lint, typecheck, DB preflight, full vitest suite, build, E2E smoke
 *
 * Full verification intentionally fails when DATABASE_URL is missing or
 * unreachable. DB-backed tests are never silently skipped.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { checkPostgresReachable, printDatabaseHelp } from "./db-check.mjs";

const root = process.cwd();
const modeArg = process.argv.find((arg) => arg === "--fast" || arg === "--full");
const mode = modeArg === "--fast" ? "fast" : "full";

const fastSteps = [
  { name: "lint", command: "npm run lint" },
  { name: "typecheck", command: "npm run typecheck" },
  { name: "rate-limit tests", command: "npx vitest run tests/rate-limit.test.ts" },
  { name: "build", command: "npm run build" }
];

const fullSteps = [
  { name: "lint", command: "npm run lint" },
  { name: "typecheck", command: "npm run typecheck" },
  { name: "database", database: true },
  { name: "test", command: "npm run test" },
  { name: "build", command: "npm run build" },
  { name: "e2e", command: "npm run test:e2e" }
];

function runStep(step) {
  console.log(`\n=== verify:${mode}: ${step.name} ===`);
  const result = spawnSync(step.command, {
    cwd: root,
    stdio: "inherit",
    shell: true
  });
  return result.status === 0;
}

async function runDatabaseStep() {
  console.log(`\n=== verify:${mode}: database ===`);
  const result = await checkPostgresReachable();
  if (result.ok) {
    console.log(`Postgres reachable at ${result.host}:${result.port} (${result.database}).`);
    return true;
  }

  printDatabaseHelp(result);
  return false;
}

const startedAt = Date.now();
const steps = mode === "fast" ? fastSteps : fullSteps;

for (const step of steps) {
  if (step.database) {
    if (!(await runDatabaseStep())) {
      console.error(`\nverify:${mode} blocked at step: database`);
      process.exit(1);
    }
    continue;
  }

  if (!runStep(step)) {
    console.error(`\nverify:${mode} failed at step: ${step.name}`);
    process.exit(1);
  }
}

console.log(`\nverify:${mode} passed in ${Math.round((Date.now() - startedAt) / 1000)}s`);
