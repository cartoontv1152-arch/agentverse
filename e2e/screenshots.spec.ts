import { expect, test } from "@playwright/test";
import { AI_TIMEOUT, agentMessages, send, signUp, waitForChat } from "./helpers";

/** Captures real product screenshots for docs/. Run with SCREENSHOTS=1. */
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture docs screenshots");

const out = (name: string) => `docs/screenshots/${name}.png`;

test("capture product screenshots", async ({ browser }) => {
  const landing = await browser.newPage();
  await landing.goto("/");
  // Let the hero demo reach the moment the plan is approved and ticked.
  await landing.waitForTimeout(13_800);
  await landing.screenshot({ path: out("landing") });
  await landing.setViewportSize({ width: 390, height: 844 });
  await landing.waitForTimeout(800);
  await landing.screenshot({ path: out("landing-mobile"), clip: { x: 0, y: 0, width: 390, height: 590 } });
  await landing.goto("/login");
  await landing.setViewportSize({ width: 1440, height: 900 });
  await landing.getByLabel("Email address").waitFor({ timeout: 90_000 });
  await landing.screenshot({ path: out("login") });
  await landing.close();

  const asha = await signUp(browser, "Asha Rao");
  const ben = await signUp(browser, "Ben Okafor");
  const a = asha.page;
  const res = await a.request.post("/api/spaces", { data: { name: "Lisbon trip", description: "Long weekend in Lisbon, May 2 to 5" } });
  const spaceId = (await res.json()).space.id;
  const invite = await (await a.request.post(`/api/spaces/${spaceId}/invites`)).json();
  await ben.page.goto(`/join/${invite.invite.code}`);
  await ben.page.getByRole("button", { name: "Join space" }).click();
  await ben.page.waitForURL(new RegExp(`/app/s/${spaceId}$`), { timeout: 90_000 });

  await a.goto(`/app/s/${spaceId}`);
  await waitForChat(a);
  await waitForChat(ben.page);
  await send(ben.page, "Flights are booked for Friday morning. What should we see first?");
  await expect(a.getByText("Flights are booked")).toBeVisible();
  await send(a, "@Researcher what is the story behind tram 28, and is it worth riding?");
  await expect(agentMessages(a).filter({ has: a.getByLabel("Sources") }).last()).toBeVisible({ timeout: AI_TIMEOUT });
  await send(a, "@Planner make a checklist for the first day: ride tram 28, visit the castle, dinner in Alfama. Ben Okafor books dinner.");
  const proposal = ben.page.getByTestId("action-card").last();
  await expect(proposal).toHaveAttribute("data-status", "pending", { timeout: AI_TIMEOUT });
  await proposal.getByRole("button", { name: "Approve" }).click();
  await expect(a.getByTestId("tasks-card").last()).toBeVisible({ timeout: 60_000 });
  await a.getByTestId("tasks-card").last().getByRole("checkbox").first().click();
  await send(ben.page, "@Pollster poll: Sintra on Saturday or Sunday?");
  const pollProposal = a.getByTestId("action-card").last();
  await expect(pollProposal).toHaveAttribute("data-status", "pending", { timeout: AI_TIMEOUT });
  await pollProposal.getByRole("button", { name: "Approve" }).click();
  const poll = ben.page.getByTestId("poll-card").last();
  await expect(poll).toBeVisible({ timeout: 60_000 });
  await poll.getByRole("button").first().click();
  await a.waitForTimeout(2500);
  await a.screenshot({ path: out("space") });

  await a.goto("/app/agents");
  await expect(a.getByTestId("agent-card").first()).toBeVisible();
  await a.screenshot({ path: out("agents") });
  await a.goto("/app/studio/new");
  await a.getByLabel("Name").fill("Trip Concierge");
  await a.getByLabel("Short description").fill("Suggests day plans within the group budget.");
  await a.getByLabel("Persona and instructions").fill("You are the group's travel concierge. Suggest concrete plans in two or three sentences, within the budget in space memory.");
  await a.screenshot({ path: out("studio") });
  await a.goto("/app");
  await expect(a.getByRole("heading", { name: /Asha/ })).toBeVisible();
  await a.screenshot({ path: out("home") });
  await a.goto("/app/settings");
  await expect(a.getByLabel("Display name")).toBeVisible();
  await a.screenshot({ path: out("settings") });

  const mobile = await asha.context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`/app/s/${spaceId}`);
  await waitForChat(mobile).catch(() => undefined);
  await mobile.waitForTimeout(3000);
  await mobile.screenshot({ path: out("mobile-space") });

  await asha.context.close();
  await ben.context.close();
});
