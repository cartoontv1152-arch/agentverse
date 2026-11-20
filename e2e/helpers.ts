import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const AI_TIMEOUT = 150_000;

/**
 * Clerk test-mode address: "+clerk_test" emails are verified with the fixed code 424242 and no
 * email is sent. The "e2e." prefix lets scripts/cleanup-e2e.mts find these accounts.
 */
export function uniqueEmail(prefix: string) {
  return `e2e.${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}+clerk_test@example.com`;
}

/** Long and random, so Clerk's breached-password check never rejects it. */
export const E2E_PASSWORD = `Agv-e2e-${Math.random().toString(36).slice(2, 10)}-Lisbon!`;

export interface Person {
  context: BrowserContext;
  page: Page;
  name: string;
  email: string;
}

/** Fills the Clerk sign-up form (already open) and enters the test verification code. */
export async function completeClerkSignUp(page: Page, email: string) {
  await page.getByLabel("Email address").fill(email, { timeout: 90_000 });
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Verification step: Clerk's code input auto-submits once six digits are typed.
  await page.getByText(/verify your email/i).first().waitFor({ timeout: 90_000 });
  await page.keyboard.type("424242", { delay: 60 });
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"), { timeout: 90_000 });
}

/** First visit to the app: confirm the display name in the welcome dialog. */
export async function confirmName(page: Page, name: string) {
  const field = page.getByRole("dialog", { name: "Welcome to AgentVerse" }).getByLabel("Your name");
  await field.waitFor({ timeout: 60_000 });
  await field.fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(field).toBeHidden({ timeout: 30_000 });
}

/** Signs up through the real UI (Clerk) and sets the display name. */
export async function signUp(browser: Browser, name: string, next?: string): Promise<Person> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(name.split(" ")[0].toLowerCase());
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  await completeClerkSignUp(page, email);
  if (!next || next.startsWith("/app")) await confirmName(page, name);
  return { context, page, name, email };
}

/** Waits until the Nexconn connection indicator reports connected. */
export async function waitForChat(page: Page) {
  await expect(page.locator('nav[aria-label="Main"] [title="Connected"]').first()).toBeVisible({ timeout: 60_000 });
}

export async function send(page: Page, text: string) {
  const box = page.getByRole("combobox", { name: "Message" });
  await box.click();
  await box.fill(text);
  // Close the mention list if it is open, then send.
  await box.press("Escape");
  await page.getByRole("button", { name: "Send message" }).click();
}

export function messages(page: Page) {
  return page.getByTestId("message");
}

export function agentMessages(page: Page) {
  return page.locator('[data-testid="message"][data-sender-kind="agent"]');
}
