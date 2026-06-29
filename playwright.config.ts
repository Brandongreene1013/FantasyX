import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/a11y",
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "powershell -NoProfile -Command \"if (Test-Path .next) { Remove-Item -LiteralPath .next -Recurse -Force }; npm run dev -- -p 3210\"",
    url: "http://127.0.0.1:3210",
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
