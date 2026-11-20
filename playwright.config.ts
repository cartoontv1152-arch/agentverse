import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Clerk keys for sign-up testing tokens (see e2e/helpers.ts).
config({ path: ".env.local", quiet: true });

/**
 * End-to-end tests against the real stack (Neon, Nexconn, Gemini). No mocks.
 * - E2E_BASE_URL: target (default local dev on :3102; set to the production URL to test prod)
 * - PW_CHROMIUM_PATH: optional Chromium executable (useful when the bundled one isn't downloaded)
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3102";
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 6 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
