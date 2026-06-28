import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/a11y",
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "powershell -NoProfile -Command \"if (Test-Path .next) { Remove-Item -LiteralPath .next -Recurse -Force }; npm run dev\"",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
