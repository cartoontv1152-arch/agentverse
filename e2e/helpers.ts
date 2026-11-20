import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const AI_TIMEOUT = 150_000;

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.agentverse.test`;
}

export interface Person {
  context: BrowserContext;
  page: Page;
  name: string;
  email: string;
}

/** Signs up through the real UI. */
export async function signUp(browser: Browser, name: string, next?: string): Promise<Person> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(name.split(" ")[0].toLowerCase());
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-42");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"), { timeout: 90_000 });
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
