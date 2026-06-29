import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { sessionCookieName } from "@/lib/session";
import { createSession } from "@/lib/session-store";

const prisma = new PrismaClient();
const a11yUserId = "a11y_admin_user";

test.beforeEach(async ({ context }) => {
  await prisma.user.upsert({
    where: { id: a11yUserId },
    update: {},
    create: {
      id: a11yUserId,
      name: "A11y Admin",
      firstName: "A11y",
      lastName: "Admin",
      displayName: "A11y Admin",
      email: "a11y.admin@fantasyx.test",
      passwordHash: "test-hash",
      mockBalance: 10000,
      startingBalance: 10000,
      role: "ADMIN",
      isAdmin: true
    }
  });

  const token = await createSession(a11yUserId);
  await context.addCookies([
    {
      name: sessionCookieName,
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
});

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId: a11yUserId } });
  await prisma.$disconnect();
});

const pages = [
  { name: "home page", path: "/" },
  { name: "markets page", path: "/markets" },
  { name: "portfolio page", path: "/portfolio" },
  { name: "leaderboard page", path: "/leaderboard" },
  { name: "admin page", path: "/admin" }
];

const marketDetailPages = [
  { name: "market detail page", path: "/markets/m_p_josh_allen_top_3" },
  { name: "player detail page", path: "/players/p_josh_allen" }
];

for (const pageConfig of pages) {
  test(`${pageConfig.name} has no detectable axe violations`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.getByRole("main").waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

for (const pageConfig of marketDetailPages) {
  test(`${pageConfig.name} has no detectable axe violations`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.getByRole("main").waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test("trade modal has no detectable axe violations", async ({ page }) => {
  await page.goto("/markets");
  const buyButton = page.getByRole("button", { name: /buy yes/i }).first();
  await expect(buyButton).toBeVisible();
  await buyButton.click();

  const dialog = page.getByRole("dialog", { name: /buy yes/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Amount")).toBeFocused();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
