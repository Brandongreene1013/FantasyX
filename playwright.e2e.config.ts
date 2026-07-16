import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke test config. Separate from playwright.config.ts (a11y suite) so
 * `npm run test:a11y` and `npm run test:e2e` stay independently runnable.
 * Requires local Postgres with the seeded database (docker compose up -d,
 * prisma migrate deploy, npm run prisma:seed).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: {
    timeout: 15000
  },
  // The golden-path spec is a single sequential journey.
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3211",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "powershell -NoProfile -Command \"if (Test-Path .next) { Remove-Item -LiteralPath .next -Recurse -Force }; npm run dev -- -p 3211\"",
    url: "http://127.0.0.1:3211",
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
