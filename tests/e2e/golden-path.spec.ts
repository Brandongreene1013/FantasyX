import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Golden-path smoke test (ROADMAP P2):
 *   1. Sign up a fresh user, complete onboarding.
 *   2. Buy YES on an open market — balance decreases, position shows in portfolio.
 *   3. Log in as the seeded admin and settle that market YES — the payout lands
 *      in the trader's balance and ledger.
 *
 * Rerunnable: each run creates a fresh user and consumes the first currently
 * OPEN seeded market (the seed universe provides hundreds).
 */

const prisma = new PrismaClient();

const TRADE_SPEND = 100;

function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && match[1] === key) return match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env — fall through
  }
  return undefined;
}

async function sessionSnapshot(page: Page) {
  const response = await page.request.get("/api/session");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    user: { id: string; mockBalance: number } | null;
    csrfToken?: string | null;
  };
  expect(body.user).not.toBeNull();
  return { user: body.user!, csrfToken: body.csrfToken ?? null };
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("golden path: signup → onboarding → first trade → admin settlement pays out", async ({ page, browser }) => {
  const market = await prisma.market.findFirst({
    where: { status: "OPEN" },
    include: { player: true },
    orderBy: { id: "asc" }
  });
  expect(market, "seeded database must contain at least one OPEN market").not.toBeNull();

  // --- 1. Signup ---
  const email = `e2e.${Date.now()}@fantasyx.test`;
  await page.goto("/signup");
  await page.getByLabel("First Name").fill("E2E");
  await page.getByLabel("Last Name").fill("Trader");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-1");
  await page.getByLabel("Confirm").fill("e2e-password-1");
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.waitForURL("**/onboarding");

  // --- Onboarding click-through ---
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: /Skip — pick later/ }).click();
  await page.getByRole("button", { name: /Go to Markets/ }).click();
  await page.waitForURL("**/markets**");

  const afterSignup = await sessionSnapshot(page);
  const traderId = afterSignup.user.id;
  const startingBalance = afterSignup.user.mockBalance;
  expect(startingBalance).toBe(10000);

  // --- 2. Buy YES on the open market ---
  await page.goto(`/markets/${market!.id}`);
  const tradePanel = page.getByRole("region", { name: "Trade panel" });
  await expect(tradePanel).toBeVisible();
  await tradePanel.getByRole("button", { name: "YES", exact: true }).click();
  await tradePanel.getByLabel("Amount in mock credits").fill(String(TRADE_SPEND));

  const tradeResponse = page.waitForResponse(
    (response) => response.url().includes("/api/trades") && response.request().method() === "POST"
  );
  await tradePanel.getByRole("button", { name: /^Buy YES/ }).click();
  expect((await tradeResponse).status()).toBe(200);

  const afterTrade = await sessionSnapshot(page);
  expect(afterTrade.user.mockBalance).toBeCloseTo(startingBalance - TRADE_SPEND, 2);

  // Position appears in portfolio.
  await page.goto("/portfolio");
  await expect(page.getByRole("main").getByText(market!.player.name).first()).toBeVisible();

  // --- 3. Admin settles the market YES ---
  const adminEmail = envValue("ADMIN_EMAIL");
  const adminPassword = envValue("ADMIN_PASSWORD");
  expect(adminEmail, "ADMIN_EMAIL must be configured").toBeTruthy();
  expect(adminPassword, "ADMIN_PASSWORD must be configured").toBeTruthy();

  const adminContext = await browser.newContext({ baseURL: "http://127.0.0.1:3211" });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("Email").fill(adminEmail!);
  await adminPage.getByLabel("Password").fill(adminPassword!);
  await adminPage.getByRole("button", { name: /Log in/i }).click();
  await adminPage.waitForURL((url) => !url.pathname.startsWith("/login"));

  const adminSession = await sessionSnapshot(adminPage);
  expect(adminSession.csrfToken).toBeTruthy();

  const settleResponse = await adminPage.request.post("/api/settlements", {
    headers: { "x-csrf-token": adminSession.csrfToken! },
    data: {
      action: "SETTLE_MARKET",
      marketId: market!.id,
      result: "YES",
      reason: "E2E golden-path settlement"
    }
  });
  expect(settleResponse.status(), await settleResponse.text()).toBe(200);
  await adminContext.close();

  // Payout landed: balance above post-trade level and a ledger row exists.
  const afterSettlement = await sessionSnapshot(page);
  expect(afterSettlement.user.mockBalance).toBeGreaterThan(afterTrade.user.mockBalance);

  const payoutEntry = await prisma.accountLedgerEntry.findFirst({
    where: { userId: traderId, type: "SETTLEMENT_PAYOUT" }
  });
  expect(payoutEntry).not.toBeNull();
  expect(Number(payoutEntry!.amount)).toBeGreaterThan(0);
});
