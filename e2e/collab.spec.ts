import { expect, test } from "@playwright/test";
import { AI_TIMEOUT, agentMessages, send, signUp, waitForChat, type Person } from "./helpers";

/** Agents working together, space memory, and a private DM with an agent. */
test.describe.serial("collaboration, memory and agent DMs", () => {
  let lee: Person;
  let spaceId = "";

  test.afterAll(async () => {
    await lee?.context.close();
  });

  test("two agents collaborate on one request: research, then a plan proposal", async ({ browser }) => {
    lee = await signUp(browser, "Lee Park");
    const page = lee.page;
    const res = await page.request.post("/api/spaces", { data: { name: "Porto weekend", description: "Two days in Porto in spring" } });
    spaceId = (await res.json()).space.id;
    await page.goto(`/app/s/${spaceId}`);
    await waitForChat(page);
    await send(page, "@Researcher find three well-known sights in Porto, then @Planner make a short plan to visit them");
    await expect(agentMessages(page).filter({ hasText: "Researcher" }).filter({ has: page.getByLabel("Sources") }).last()).toBeVisible({
      timeout: AI_TIMEOUT,
    });
    await expect(page.getByTestId("action-card").last()).toHaveAttribute("data-status", "pending", { timeout: AI_TIMEOUT });
    // Dismiss: nothing is created.
    await page.getByTestId("action-card").last().getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByTestId("action-card").last()).toHaveAttribute("data-status", "dismissed", { timeout: 30_000 });
    await expect(page.getByTestId("tasks-card")).toHaveCount(0);
  });

  test("space memory: add a decision in the panel", async () => {
    const page = lee.page;
    await page.getByRole("button", { name: /Show details|Hide details/ }).click();
    const memoryTab = page.getByRole("tab", { name: "Memory" });
    if (!(await memoryTab.isVisible())) await page.getByRole("button", { name: /Show details/ }).click();
    await page.getByRole("tab", { name: "Memory" }).click();
    await page.getByRole("radio", { name: "Decision" }).click();
    await page.getByLabel("Memory text").fill("We take the 9:00 train from Lisbon on Saturday.");
    await page.getByRole("button", { name: "Pin to memory" }).click();
    await expect(page.getByTestId("memory-list")).toContainText("9:00 train", { timeout: 30_000 });
  });

  test("translate a message privately from the message menu", async () => {
    const page = lee.page;
    await page.goto(`/app/s/${spaceId}`);
    await waitForChat(page);
    const text = `Nos vemos en la estación a las nueve ${Date.now().toString(36)}`;
    await send(page, text);
    const row = page.getByTestId("message").filter({ hasText: text }).last();
    await row.hover();
    await row.getByRole("button", { name: "Translate message" }).click();
    await page.getByRole("button", { name: "English", exact: true }).click();
    const reply = agentMessages(page).filter({ hasText: "Only visible to you" }).last();
    await expect(reply).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(reply.locator(".prose-chat")).toContainText(/station|nine/i);
  });

  test("private DM with an agent", async () => {
    const page = lee.page;
    const agents = await (await page.request.get("/api/agents")).json();
    const translator = agents.agents.find((a: { builtinKey: string | null }) => a.builtinKey === "translator");
    await page.goto(`/app/agent/${translator.id}`);
    await waitForChat(page);
    await expect(page.getByText(/Private chat/)).toBeVisible();
    await send(page, "Translate into Portuguese: See you at the station at nine.");
    const reply = agentMessages(page).last();
    await expect(reply.locator(".prose-chat")).toContainText(/estação|nove|Vejo/i, { timeout: AI_TIMEOUT });
  });
});
