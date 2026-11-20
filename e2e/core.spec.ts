import { expect, test } from "@playwright/test";
import { AI_TIMEOUT, agentMessages, send, signUp, waitForChat, type Person } from "./helpers";

/**
 * The core journey with two real people in two browser contexts, over real Nexconn realtime:
 * sign up, create a space, invite a new person, chat live, then work with agents
 * (Researcher with sources, Planner checklist with approval and live ticks, Pollster votes).
 */
test.describe.serial("two people and their agents in one space", () => {
  let asha: Person;
  let ben: Person;
  let spacePath = "";

  test.afterAll(async () => {
    await asha?.context.close();
    await ben?.context.close();
  });

  test("Asha signs up, creates a space and invites Ben, who joins through the link", async ({ browser }) => {
    asha = await signUp(browser, "Asha Rao");
    const a = asha.page;
    await expect(a).toHaveURL(/\/app$/);
    await expect(a.getByRole("heading", { name: "Start with a space" })).toBeVisible();

    await a.getByRole("button", { name: "Create a space" }).first().click();
    await a.getByLabel("Name").fill("Lisbon trip");
    await a.getByLabel("Description").fill("Planning our long weekend in Lisbon");
    await a.getByRole("button", { name: "Create space" }).click();
    await a.waitForURL(/\/app\/s\/[0-9a-f-]+$/, { timeout: 90_000 });
    spacePath = new URL(a.url()).pathname;
    await expect(a.getByTestId("space-title")).toHaveText("Lisbon trip");

    await a.getByRole("button", { name: "Invite", exact: true }).click();
    const link = a.getByTestId("invite-link");
    await expect(link).toHaveValue(/\/join\/[A-Za-z0-9]+$/, { timeout: 30_000 });
    const inviteUrl = new URL(await link.inputValue());
    await a.keyboard.press("Escape");

    // Ben has no account: invite page -> sign up -> back to the invite -> join.
    const context = await browser.newContext();
    const b = await context.newPage();
    await b.goto(inviteUrl.pathname);
    await expect(b.getByRole("heading", { name: "Lisbon trip" })).toBeVisible();
    await expect(b.getByText("Asha Rao invited you to a space")).toBeVisible();
    await b.getByRole("link", { name: "Create account and join" }).click();
    await b.getByLabel("Your name").fill("Ben Okafor");
    const benEmail = `ben.${Date.now().toString(36)}@e2e.agentverse.test`;
    await b.getByLabel("Email").fill(benEmail);
    await b.getByLabel("Password").fill("correct-horse-42");
    await b.getByRole("button", { name: "Create account" }).click();
    await b.waitForURL(new RegExp(inviteUrl.pathname), { timeout: 90_000 });
    await b.getByRole("button", { name: "Join space" }).click();
    await b.waitForURL(new RegExp(`${spacePath}$`), { timeout: 90_000 });
    ben = { context, page: b, name: "Ben Okafor", email: benEmail };
    await expect(b.getByTestId("space-title")).toHaveText("Lisbon trip");
  });

  test("messages arrive in real time for both people", async () => {
    await asha.page.goto(spacePath);
    await waitForChat(asha.page);
    await waitForChat(ben.page);
    const hello = `Hi Ben, let's plan Lisbon here ${Date.now().toString(36)}`;
    await send(asha.page, hello);
    await expect(ben.page.getByText(hello)).toBeVisible({ timeout: 30_000 });
    const reply = `Sounds good, I'm in ${Date.now().toString(36)}`;
    await send(ben.page, reply);
    await expect(asha.page.getByText(reply)).toBeVisible({ timeout: 30_000 });
  });

  test("the Researcher answers with cited sources, visible to everyone", async () => {
    await send(asha.page, "@Researcher when did Lisbon's tram network start operating, and who runs it today?");
    const answer = agentMessages(ben.page).filter({ has: ben.page.getByLabel("Sources") }).last();
    await expect(answer).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(answer.getByRole("link").first()).toHaveAttribute("href", /^https?:\/\//);
    await expect(agentMessages(asha.page).filter({ has: asha.page.getByLabel("Sources") }).last()).toBeVisible({ timeout: 30_000 });
  });

  test("the Planner proposes a checklist; after approval both see ticks live", async () => {
    await send(
      asha.page,
      "@Planner make a checklist for the trip: book flights, reserve a hotel in Alfama, buy a Viva Viagem card. Ben Okafor books the flights.",
    );
    const proposal = ben.page.getByTestId("action-card").last();
    await expect(proposal).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(proposal).toHaveAttribute("data-status", "pending");
    await proposal.getByRole("button", { name: "Approve" }).click();
    await expect(asha.page.getByTestId("action-card").last()).toHaveAttribute("data-status", "approved", { timeout: 30_000 });

    const ashaList = asha.page.getByTestId("tasks-card").last();
    const benList = ben.page.getByTestId("tasks-card").last();
    await expect(ashaList).toBeVisible({ timeout: 60_000 });
    await expect(benList).toBeVisible({ timeout: 30_000 });
    const firstBox = ashaList.getByRole("checkbox").first();
    await expect(firstBox).toBeEnabled({ timeout: 30_000 });
    await firstBox.click();
    await expect(benList.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await expect(benList.getByText(/^1 of \d+ done$/)).toBeVisible();
  });

  test("the Pollster runs a poll and votes update live", async () => {
    await send(ben.page, "@Pollster make a poll: which day should we visit Sintra? Options: Saturday, Sunday");
    const proposal = asha.page.getByTestId("action-card").last();
    await expect(proposal).toHaveAttribute("data-status", "pending", { timeout: AI_TIMEOUT });
    await proposal.getByRole("button", { name: "Approve" }).click();
    const benPoll = ben.page.getByTestId("poll-card").last();
    await expect(benPoll).toBeVisible({ timeout: 60_000 });
    const option = benPoll.getByRole("button", { name: /Saturday/ });
    await expect(option).toBeEnabled({ timeout: 30_000 });
    await option.click();
    await expect(asha.page.getByTestId("poll-card").last().getByText(/^1 person voted/)).toBeVisible({ timeout: 30_000 });
  });
});
