import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E for the war room. Aligns with CLAUDE.md Tier 4 lifecycle (next dev on port 3030).
 * Cursor "Playwright MCP" is optional; CI and local runs use: npx playwright test
 */
export default defineConfig({
  testDir: "e2e/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3030",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev -p 3030",
    url: "http://localhost:3030",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
