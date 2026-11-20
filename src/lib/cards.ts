import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agent, Card, Space } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { randomAlnum } from "@/lib/nexconn/ids";
import { sendMessage, setMessageMetadata, updateMessage, type ChannelTarget } from "@/lib/nexconn/server";
import {
  ACTION_STATE_KEY,
  MSG,
  POLL_KEY_PREFIX,
  TASK_KEY_PREFIX,
  type ActionCardContent,
  type ActionState,
  type PollCardContent,
  type PollOptionState,
  type ProposalPayload,
  type TaskItemState,
  type TasksCardContent,
} from "@/lib/message-types";
import { recordMirror } from "@/lib/mirror";

export interface CardChannel {
  target: ChannelTarget;
  channelKey: string;
  space: Space | null;
}

const MAX_VOTERS_IN_METADATA = 100;

export function describeProposal(p: ProposalPayload): string {
  if (p.type === "tasks") return `Checklist "${p.title}" with ${p.items.length} item${p.items.length === 1 ? "" : "s"}`;
  if (p.type === "poll") return `Poll "${p.question}" with ${p.options.length} options`;
  return `Save ${p.entries.length} item${p.entries.length === 1 ? "" : "s"} to space memory`;
}

/* ---------------------------------------------------------------------------------------------
 * Action proposals
 * ------------------------------------------------------------------------------------------- */

export async function proposeAction(input: {
  agent: Agent;
  channel: CardChannel;
  proposal: ProposalPayload;
  requestedBy: { id: string; name: string } | null;
}): Promise<Card> {
  const db = getDb();
  const [card] = await db
    .insert(schema.cards)
    .values({
      kind: "action",
      channelKey: input.channel.channelKey,
      spaceId: input.channel.space?.id ?? null,
      agentId: input.agent.id,
      title: describeProposal(input.proposal),
      data: { proposal: input.proposal },
      status: "pending",
      requestedBy: input.requestedBy?.id ?? null,
    })
    .returning();
  const content: ActionCardContent = {
    cardId: card.id,
    agentId: input.agent.id,
    agentName: input.agent.name,
    requestedByName: input.requestedBy?.name ?? null,
    proposal: input.proposal,
  };
  const state: ActionState = { s: "pending", r: 1 };
  const messageId = await sendMessage({
    from: input.agent.nexconnId,
    to: input.channel.target,
    messageType: MSG.ACTION,
    content,
    metadata: { [ACTION_STATE_KEY]: JSON.stringify(state) },
    pushContent: `${input.agent.name} proposed: ${card.title}`,
  });
  await db.update(schema.cards).set({ nexconnMessageId: messageId }).where(eq(schema.cards.id, card.id));
  await recordMirror({
    channelKey: input.channel.channelKey,
    spaceId: input.channel.space?.id ?? null,
    nexconnMessageId: messageId,
    senderAgentId: input.agent.id,
    senderName: input.agent.name,
    kind: "card",
    text: `[Proposed action, awaiting approval] ${card.title}`,
  });
  return { ...card, nexconnMessageId: messageId };
}

function channelForCard(card: Card, space: Space | null, dmUserNexconnId: string | null): CardChannel {
  if (card.channelKey.startsWith("g:")) {
    if (!space) throw new ApiError(500, "server_error", "Card space missing");
    return { target: { type: "group", groupId: space.nexconnGroupId }, channelKey: card.channelKey, space };
  }
  if (!dmUserNexconnId) throw new ApiError(500, "server_error", "Card DM user missing");
  return { target: { type: "direct", userId: dmUserNexconnId }, channelKey: card.channelKey, space: null };
}

/**
 * Loads a card and checks the user may act on it: a member of the card's space, or the human in
 * the agent DM the card belongs to.
 */
export async function loadCardForUser(cardId: string, user: { id: string; nexconnId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) throw new ApiError(404, "not_found", "Card not found.");
  const db = getDb();
  const [card] = await db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).limit(1);
  if (!card) throw new ApiError(404, "not_found", "Card not found.");
  let space: Space | null = null;
  if (card.spaceId) {
    const [row] = await db
      .select({ space: schema.spaces })
      .from(schema.spaceMembers)
      .innerJoin(schema.spaces, eq(schema.spaces.id, schema.spaceMembers.spaceId))
      .where(and(eq(schema.spaceMembers.spaceId, card.spaceId), eq(schema.spaceMembers.userId, user.id)))
      .limit(1);
    if (!row) throw new ApiError(404, "not_found", "Card not found.");
    space = row.space;
  } else {
    // Agent DM: channel key is a:<agentNexconnId>:<userNexconnId>
    const parts = card.channelKey.split(":");
    if (parts[0] !== "a" || parts[2] !== user.nexconnId) throw new ApiError(404, "not_found", "Card not found.");
  }
  const [agent] = card.agentId
    ? await db.select().from(schema.agents).where(eq(schema.agents.id, card.agentId)).limit(1)
    : [undefined];
  const channel = channelForCard(card, space, space ? null : user.nexconnId);
  return { card, space, agent: agent ?? null, channel };
}

export async function editAction(cardId: string, user: { id: string; nexconnId: string; name: string }, proposal: ProposalPayload) {
  const { card, agent, channel } = await loadCardForUser(cardId, user);
  if (card.kind !== "action") throw new ApiError(400, "invalid_card", "Only proposals can be edited.");
  if (card.status !== "pending") throw new ApiError(409, "already_resolved", "This proposal was already handled.");
  const existing = (card.data as { proposal: ProposalPayload }).proposal;
  if (existing.type !== proposal.type) throw new ApiError(400, "invalid_input", "The proposal type cannot change.");
  const db = getDb();
  const [updated] = await db
    .update(schema.cards)
    .set({ data: { proposal }, title: describeProposal(proposal), revision: sql`${schema.cards.revision} + 1` })
    .where(and(eq(schema.cards.id, card.id), eq(schema.cards.status, "pending")))
    .returning();
  if (!updated) throw new ApiError(409, "already_resolved", "This proposal was already handled.");
  if (card.nexconnMessageId && agent) {
    const content: ActionCardContent = {
      cardId: card.id,
      agentId: agent.id,
      agentName: agent.name,
      requestedByName: null,
      proposal,
      edited: true,
    };
    // Message update: everyone sees the edited proposal in place.
    await updateMessage(agent.nexconnId, channel.target, card.nexconnMessageId, content);
  }
  return updated;
}

/**
 * Metadata operator: in spaces the acting person; in agent DMs the agent (the message direction
 * the card was sent in), so the person receives the change as the other party.
 */
function operatorFor(channel: CardChannel, user: { nexconnId: string }, agent: Agent | null): string {
  return channel.target.type === "group" || !agent ? user.nexconnId : agent.nexconnId;
}

async function setActionState(card: Card, channel: CardChannel, operatorNexconnId: string, state: ActionState) {
  if (!card.nexconnMessageId) return;
  await setMessageMetadata(operatorNexconnId, channel.target, card.nexconnMessageId, {
    [ACTION_STATE_KEY]: JSON.stringify(state),
  });
}

export async function resolveAction(
  cardId: string,
  user: { id: string; nexconnId: string; name: string },
  decision: "approve" | "dismiss",
) {
  const { card, agent, channel } = await loadCardForUser(cardId, user);
  if (card.kind !== "action") throw new ApiError(400, "invalid_card", "Only proposals can be approved.");
  const db = getDb();
  // Claim the card atomically so two people approving at once cannot execute it twice.
  const [claimed] = await db
    .update(schema.cards)
    .set({
      status: decision === "approve" ? "approved" : "dismissed",
      resolvedBy: user.id,
      resolvedAt: new Date(),
      revision: sql`${schema.cards.revision} + 1`,
    })
    .where(and(eq(schema.cards.id, card.id), eq(schema.cards.status, "pending")))
    .returning();
  if (!claimed) throw new ApiError(409, "already_resolved", "Someone already handled this proposal.");

  if (decision === "dismiss") {
    await setActionState(claimed, channel, operatorFor(channel, user, agent), { s: "dismissed", by: user.name, at: Date.now(), r: claimed.revision });
    return { card: claimed, result: null };
  }
  if (!agent) throw new ApiError(410, "agent_removed", "The agent that proposed this no longer exists.");
  const proposal = (claimed.data as { proposal: ProposalPayload }).proposal;
  try {
    const result = await executeProposal({ agent, channel, proposal, actor: user, sourceCard: claimed });
    await db.update(schema.cards).set({ resultCardId: result?.id ?? null }).where(eq(schema.cards.id, claimed.id));
    await setActionState(claimed, channel, operatorFor(channel, user, agent), {
      s: "approved",
      by: user.name,
      at: Date.now(),
      rc: result?.id ?? null,
      r: claimed.revision,
    });
    return { card: claimed, result };
  } catch (err) {
    console.error("[cards] proposal execution failed", err);
    await db.update(schema.cards).set({ status: "failed" }).where(eq(schema.cards.id, claimed.id));
    await setActionState(claimed, channel, operatorFor(channel, user, agent), {
      s: "failed",
      by: user.name,
      at: Date.now(),
      error: "Could not create the result. Ask the agent again.",
      r: claimed.revision + 1,
    }).catch(() => undefined);
    throw new ApiError(502, "action_failed", "The action could not be completed. Ask the agent to try again.");
  }
}

/** Executes an approved proposal (or a direct one when approval is off). Returns the created card, if any. */
export async function executeProposal(input: {
  agent: Agent;
  channel: CardChannel;
  proposal: ProposalPayload;
  actor: { id: string; name: string } | null;
  sourceCard?: Card;
}): Promise<Card | null> {
  const { agent, channel, proposal } = input;
  if (proposal.type === "tasks") return createTasksCard(agent, channel, proposal);
  if (proposal.type === "poll") return createPollCard(agent, channel, proposal);
  if (!channel.space) throw new ApiError(400, "invalid_input", "Memory is only available in spaces.");
  const db = getDb();
  await db.insert(schema.memoryItems).values(
    proposal.entries.map((e) => ({
      spaceId: channel.space!.id,
      kind: e.kind,
      text: e.text,
      createdByAgentId: agent.id,
      createdByUserId: input.actor?.id ?? null,
    })),
  );
  const text = `Saved ${proposal.entries.length} item${proposal.entries.length === 1 ? "" : "s"} to space memory.`;
  const messageId = await sendMessage({
    from: agent.nexconnId,
    to: channel.target,
    messageType: MSG.NOTICE,
    content: { level: "info", agentId: agent.id, text },
  });
  await recordMirror({
    channelKey: channel.channelKey,
    spaceId: channel.space.id,
    nexconnMessageId: messageId,
    senderAgentId: agent.id,
    senderName: agent.name,
    kind: "notice",
    text,
  });
  return null;
}

async function resolveAssignees(space: Space | null, names: (string | null | undefined)[]) {
  const map = new Map<string, { id: string; name: string }>();
  if (!space) return map;
  const members = await getDb()
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.spaceMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.spaceMembers.userId))
    .where(eq(schema.spaceMembers.spaceId, space.id));
  for (const raw of names) {
    if (!raw) continue;
    const needle = raw.trim().toLowerCase().replace(/^@/, "");
    const match =
      members.find((m) => m.name.toLowerCase() === needle) ??
      members.find((m) => m.name.toLowerCase().split(/\s+/)[0] === needle.split(/\s+/)[0]);
    if (match) map.set(raw, match);
  }
  return map;
}

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

async function createTasksCard(
  agent: Agent,
  channel: CardChannel,
  proposal: Extract<ProposalPayload, { type: "tasks" }>,
): Promise<Card> {
  const db = getDb();
  const assignees = await resolveAssignees(channel.space, proposal.items.map((i) => i.assigneeName));
  const [card] = await db
    .insert(schema.cards)
    .values({
      kind: "tasks",
      channelKey: channel.channelKey,
      spaceId: channel.space?.id ?? null,
      agentId: agent.id,
      title: proposal.title,
      status: "open",
    })
    .returning();
  const items = proposal.items.slice(0, 20).map((item, position) => {
    const assignee = item.assigneeName ? assignees.get(item.assigneeName) : undefined;
    return {
      cardId: card.id,
      key: randomAlnum(6),
      position,
      text: item.text.slice(0, 200),
      assigneeUserId: assignee?.id ?? null,
      due: validDate(item.due),
      assigneeName: assignee?.name ?? null,
    };
  });
  await db.insert(schema.taskItems).values(items.map(({ assigneeName: _unused, ...row }) => row));
  const content: TasksCardContent = {
    cardId: card.id,
    agentId: agent.id,
    title: proposal.title,
    items: items.map((i) => ({ key: i.key, text: i.text, assigneeId: i.assigneeUserId, assigneeName: i.assigneeName, due: i.due })),
  };
  const metadata: Record<string, string> = {};
  for (const item of items) {
    const state: TaskItemState = { d: 0, a: item.assigneeUserId, an: item.assigneeName, due: item.due, r: 1 };
    metadata[TASK_KEY_PREFIX + item.key] = JSON.stringify(state);
  }
  const messageId = await sendMessage({
    from: agent.nexconnId,
    to: channel.target,
    messageType: MSG.TASKS,
    content,
    metadata,
    pushContent: `${agent.name} created a checklist: ${proposal.title}`,
  });
  await db.update(schema.cards).set({ nexconnMessageId: messageId }).where(eq(schema.cards.id, card.id));
  await recordMirror({
    channelKey: channel.channelKey,
    spaceId: channel.space?.id ?? null,
    nexconnMessageId: messageId,
    senderAgentId: agent.id,
    senderName: agent.name,
    kind: "card",
    text: `[Checklist] ${proposal.title}: ${items.map((i) => i.text + (i.assigneeName ? ` (${i.assigneeName})` : "")).join("; ")}`,
  });
  return { ...card, nexconnMessageId: messageId };
}

async function createPollCard(
  agent: Agent,
  channel: CardChannel,
  proposal: Extract<ProposalPayload, { type: "poll" }>,
): Promise<Card> {
  const db = getDb();
  const [card] = await db
    .insert(schema.cards)
    .values({
      kind: "poll",
      channelKey: channel.channelKey,
      spaceId: channel.space?.id ?? null,
      agentId: agent.id,
      title: proposal.question,
      data: { multi: proposal.multi },
      status: "open",
    })
    .returning();
  const options = proposal.options.slice(0, 8).map((text, position) => ({
    cardId: card.id,
    key: randomAlnum(6),
    position,
    text: text.slice(0, 120),
  }));
  await db.insert(schema.pollOptions).values(options);
  const content: PollCardContent = {
    cardId: card.id,
    agentId: agent.id,
    question: proposal.question,
    multi: proposal.multi,
    options: options.map((o) => ({ key: o.key, text: o.text })),
  };
  const metadata: Record<string, string> = {};
  for (const option of options) {
    const state: PollOptionState = { n: 0, v: [], r: 1 };
    metadata[POLL_KEY_PREFIX + option.key] = JSON.stringify(state);
  }
  const messageId = await sendMessage({
    from: agent.nexconnId,
    to: channel.target,
    messageType: MSG.POLL,
    content,
    metadata,
    pushContent: `${agent.name} started a poll: ${proposal.question}`,
  });
  await db.update(schema.cards).set({ nexconnMessageId: messageId }).where(eq(schema.cards.id, card.id));
  await recordMirror({
    channelKey: channel.channelKey,
    spaceId: channel.space?.id ?? null,
    nexconnMessageId: messageId,
    senderAgentId: agent.id,
    senderName: agent.name,
    kind: "card",
    text: `[Poll] ${proposal.question} Options: ${options.map((o) => o.text).join(" / ")}`,
  });
  return { ...card, nexconnMessageId: messageId };
}

/* ---------------------------------------------------------------------------------------------
 * Live updates: tasks and votes
 * ------------------------------------------------------------------------------------------- */

export async function updateTaskItem(
  cardId: string,
  itemId: string,
  user: { id: string; nexconnId: string; name: string },
  patch: { done?: boolean; assigneeUserId?: string | null; due?: string | null },
) {
  const { card, channel, agent } = await loadCardForUser(cardId, user);
  if (card.kind !== "tasks") throw new ApiError(400, "invalid_card", "This card is not a checklist.");
  const db = getDb();
  if (patch.assigneeUserId && channel.space) {
    const [member] = await db
      .select({ userId: schema.spaceMembers.userId })
      .from(schema.spaceMembers)
      .where(and(eq(schema.spaceMembers.spaceId, channel.space.id), eq(schema.spaceMembers.userId, patch.assigneeUserId)))
      .limit(1);
    if (!member) throw new ApiError(400, "invalid_assignee", "Assignees must be members of this space.");
  } else if (patch.assigneeUserId && patch.assigneeUserId !== user.id) {
    throw new ApiError(400, "invalid_assignee", "In a private chat you can only assign yourself.");
  }
  const set: Partial<typeof schema.taskItems.$inferInsert> = {};
  if (patch.done !== undefined) {
    set.done = patch.done;
    set.doneBy = patch.done ? user.id : null;
    set.doneAt = patch.done ? new Date() : null;
  }
  if (patch.assigneeUserId !== undefined) set.assigneeUserId = patch.assigneeUserId;
  if (patch.due !== undefined) set.due = validDate(patch.due);
  const [item] = await db
    .update(schema.taskItems)
    .set(set)
    .where(and(eq(schema.taskItems.id, itemId), eq(schema.taskItems.cardId, card.id)))
    .returning();
  if (!item) throw new ApiError(404, "not_found", "Checklist item not found.");
  const [{ revision }] = await db
    .update(schema.cards)
    .set({ revision: sql`${schema.cards.revision} + 1` })
    .where(eq(schema.cards.id, card.id))
    .returning({ revision: schema.cards.revision });
  const people = await namesFor([item.assigneeUserId, item.doneBy]);
  const state: TaskItemState = {
    d: item.done ? 1 : 0,
    by: item.doneBy ? people.get(item.doneBy) ?? null : null,
    a: item.assigneeUserId,
    an: item.assigneeUserId ? people.get(item.assigneeUserId) ?? null : null,
    due: item.due,
    r: revision,
  };
  if (card.nexconnMessageId) {
    await setMessageMetadata(operatorFor(channel, user, agent), channel.target, card.nexconnMessageId, {
      [TASK_KEY_PREFIX + item.key]: JSON.stringify(state),
    });
  }
  return { item, state };
}

export async function castVote(cardId: string, optionId: string, user: { id: string; nexconnId: string; name: string }) {
  const { card, channel, agent } = await loadCardForUser(cardId, user);
  if (card.kind !== "poll") throw new ApiError(400, "invalid_card", "This card is not a poll.");
  if (card.status === "closed") throw new ApiError(409, "poll_closed", "This poll is closed.");
  const db = getDb();
  const options = await db.select().from(schema.pollOptions).where(eq(schema.pollOptions.cardId, card.id));
  const option = options.find((o) => o.id === optionId);
  if (!option) throw new ApiError(404, "not_found", "Poll option not found.");
  const multi = Boolean((card.data as { multi?: boolean }).multi);
  const mine = await db
    .select({ optionId: schema.pollVotes.optionId })
    .from(schema.pollVotes)
    .where(and(eq(schema.pollVotes.cardId, card.id), eq(schema.pollVotes.userId, user.id)));
  const already = mine.some((v) => v.optionId === optionId);
  const touched = new Set<string>([optionId]);
  if (already) {
    await db.delete(schema.pollVotes).where(and(eq(schema.pollVotes.optionId, optionId), eq(schema.pollVotes.userId, user.id)));
  } else {
    if (!multi && mine.length > 0) {
      mine.forEach((v) => touched.add(v.optionId));
      await db.delete(schema.pollVotes).where(and(eq(schema.pollVotes.cardId, card.id), eq(schema.pollVotes.userId, user.id)));
    }
    await db.insert(schema.pollVotes).values({ cardId: card.id, optionId, userId: user.id }).onConflictDoNothing();
  }
  const [{ revision }] = await db
    .update(schema.cards)
    .set({ revision: sql`${schema.cards.revision} + 1` })
    .where(eq(schema.cards.id, card.id))
    .returning({ revision: schema.cards.revision });
  const voteRows = await db
    .select({ optionId: schema.pollVotes.optionId, nexconnId: schema.users.nexconnId })
    .from(schema.pollVotes)
    .innerJoin(schema.users, eq(schema.users.id, schema.pollVotes.userId))
    .where(inArray(schema.pollVotes.optionId, [...touched]));
  const metadata: Record<string, string> = {};
  for (const id of touched) {
    const opt = options.find((o) => o.id === id);
    if (!opt) continue;
    const voters = voteRows.filter((v) => v.optionId === id).map((v) => v.nexconnId);
    const state: PollOptionState = { n: voters.length, v: voters.slice(0, MAX_VOTERS_IN_METADATA), r: revision };
    metadata[POLL_KEY_PREFIX + opt.key] = JSON.stringify(state);
  }
  if (card.nexconnMessageId) {
    await setMessageMetadata(operatorFor(channel, user, agent), channel.target, card.nexconnMessageId, metadata);
  }
  return { metadata };
}

async function namesFor(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const rows = await getDb()
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.id, unique));
  rows.forEach((r) => map.set(r.id, r.name));
  return map;
}

/** Full, authoritative card state for rendering (used on first render and after reconnects). */
export async function getCardState(cardId: string, user: { id: string; nexconnId: string }) {
  const { card } = await loadCardForUser(cardId, user);
  const db = getDb();
  if (card.kind === "tasks") {
    const items = await db.select().from(schema.taskItems).where(eq(schema.taskItems.cardId, card.id)).orderBy(asc(schema.taskItems.position));
    const people = await namesFor(items.flatMap((i) => [i.assigneeUserId, i.doneBy]));
    return {
      kind: "tasks" as const,
      id: card.id,
      title: card.title,
      revision: card.revision,
      items: items.map((i) => ({
        id: i.id,
        key: i.key,
        text: i.text,
        done: i.done,
        doneByName: i.doneBy ? people.get(i.doneBy) ?? null : null,
        assigneeId: i.assigneeUserId,
        assigneeName: i.assigneeUserId ? people.get(i.assigneeUserId) ?? null : null,
        due: i.due,
      })),
    };
  }
  if (card.kind === "poll") {
    const options = await db.select().from(schema.pollOptions).where(eq(schema.pollOptions.cardId, card.id)).orderBy(asc(schema.pollOptions.position));
    const votes = await db
      .select({ optionId: schema.pollVotes.optionId, nexconnId: schema.users.nexconnId, name: schema.users.name })
      .from(schema.pollVotes)
      .innerJoin(schema.users, eq(schema.users.id, schema.pollVotes.userId))
      .where(eq(schema.pollVotes.cardId, card.id));
    return {
      kind: "poll" as const,
      id: card.id,
      question: card.title,
      multi: Boolean((card.data as { multi?: boolean }).multi),
      revision: card.revision,
      options: options.map((o) => {
        const voters = votes.filter((v) => v.optionId === o.id);
        return { id: o.id, key: o.key, text: o.text, count: voters.length, voters: voters.map((v) => ({ nexconnId: v.nexconnId, name: v.name })) };
      }),
    };
  }
  const resolver = card.resolvedBy ? (await namesFor([card.resolvedBy])).get(card.resolvedBy) ?? null : null;
  return {
    kind: "action" as const,
    id: card.id,
    status: card.status as ActionState["s"],
    resolvedByName: resolver,
    resultCardId: card.resultCardId,
    revision: card.revision,
    proposal: (card.data as { proposal: ProposalPayload }).proposal,
  };
}
export type CardState = Awaited<ReturnType<typeof getCardState>>;
