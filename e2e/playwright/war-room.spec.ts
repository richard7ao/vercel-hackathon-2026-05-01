import { test, expect } from "@playwright/test";

test.describe("War room (CLAUDE.md: demo auto-run, palette)", () => {
  test("home loads with BRIDGE shell and dark background", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brand")).toContainText("BRIDGE");
    await expect(page.locator(".shell")).toBeVisible();
    const bodyBg = await page.evaluate(() => {
      const s = getComputedStyle(document.body).backgroundColor;
      return s;
    });
    expect(bodyBg).toMatch(/rgb\(5,\s*5,\s*5\)|rgba\(5,\s*5,\s*5/);
  });

  test("demo auto-starts after 3s calm hold (no RUN DEMO click)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".status-block[data-state='all_clear']")).toBeVisible();
    await expect(page.getByRole("button", { name: /RUN DEMO/i })).toBeVisible();
    await expect(page.locator(".status-block[data-state='monitoring']")).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole("button", { name: /RUN DEMO/i })).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("live mode via ?live=1 shows LIVE mode toggle", async ({ page }) => {
    await page.goto("/?live=1");
    await expect(page.locator("button.mode-toggle")).toContainText(/LIVE/i, {
      timeout: 20_000,
    });
  });
});
