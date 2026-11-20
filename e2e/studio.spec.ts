import { expect, test } from "@playwright/test";
import { AI_TIMEOUT, agentMessages, send, signUp, waitForChat, type Person } from "./helpers";

// 1x1 PNG used as an uploaded avatar (exercises the real Vercel Blob upload).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGeoBwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.describe.serial("Agent Studio", () => {
  let maya: Person;
  let spaceId = "";
  let agentPath = "";

  test.afterAll(async () => {
    await maya?.context.close();
  });

  test("build a custom agent with an avatar and try it in the test console", async ({ browser }) => {
    maya = await signUp(browser, "Maya Chen");
    const page = maya.page;
    const res = await page.request.post("/api/spaces", { data: { name: "Weekend crew" } });
    expect(res.ok()).toBeTruthy();
    spaceId = (await res.json()).space.id;

    await page.goto("/app/studio/new");
    await page.getByLabel("Name").fill("Trip Concierge");
    await expect(page.getByLabel("Handle")).toHaveValue("TripConcierge");
    await page.getByLabel("Short description").fill("Suggests day plans for the group.");
    await page
      .getByLabel("Persona and instructions")
      .fill("You are the group's travel concierge. Suggest concrete, practical plans in two or three sentences.");
    await page.getByLabel(/Checklists/).check();
    await page.getByLabel("Upload avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Remove image" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Create agent" }).click();
    await page.waitForURL(/\/app\/studio\/[0-9a-f-]+$/, { timeout: 60_000 });
    agentPath = new URL(page.url()).pathname;

    await page.getByLabel("Test message").fill("Suggest one thing to do in Lisbon on a rainy afternoon.");
    await page.getByRole("button", { name: "Run" }).click();
    const consoleBox = page.getByTestId("test-console");
    await expect(consoleBox.locator("li").nth(1).locator(".prose-chat")).toContainText(/\w{3,}/, { timeout: AI_TIMEOUT });
    await expect(page.getByLabel("Test message")).toBeEnabled({ timeout: AI_TIMEOUT });
  });

  test("add the custom agent to a space and mention it", async () => {
    const page = maya.page;
    await page.goto("/app/agents");
    const card = page.getByTestId("agent-card").filter({ hasText: "Trip Concierge" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Add to space" }).click();
    await page.getByRole("menuitem", { name: "Weekend crew" }).click();
    await expect(card.getByText("In 1 of your spaces")).toBeVisible({ timeout: 30_000 });

    await page.goto(`/app/s/${spaceId}`);
    await waitForChat(page);
    await send(page, "@TripConcierge suggest a day trip from Lisbon in two sentences.");
    const reply = agentMessages(page).filter({ hasText: "Trip Concierge" }).last();
    await expect(reply).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(reply.locator(".prose-chat")).toContainText(/\w{3,}/, { timeout: AI_TIMEOUT });
    expect(agentPath).toMatch(/\/app\/studio\//);
  });
});
