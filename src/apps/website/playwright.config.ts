import { defineConfig, devices } from "@playwright/test";

/**
 * Responsive regression tests.
 *
 * These run against the production build, because the layout faults they catch
 * (fluid type, container queries, sticky offsets) only behave correctly once
 * the CSS has been compiled. They drive the Chrome already installed on the
 * machine rather than downloading a browser, so `pnpm test` works without a
 * `playwright install` step; set PLAYWRIGHT_CHANNEL to use a different one.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4320);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 40_000,
  expect: { timeout: 8_000 },
  globalTimeout: 20 * 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
  },
});
