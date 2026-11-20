import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agent, Space } from "@/lib/db/schema";
import { MSG, formatSourcesFooter, type AgentStateContent, type AgentStateName, type ProposalPayload, type Source } from "@/lib/message-types";
import { sendMessage, sendStreamChunk, type ChannelTarget } from "@/lib/nexconn/server";
import { executeProposal, proposeAction, describeProposal, type CardChannel } from "@/lib/cards";
import { recentMessages, recordMirror } from "@/lib/mirror";
import { runAgent, type AgentRunResult, type AgentSink, type AgentTask } from "@/lib/ai/runtime";
import { generate, responseText } from "@/lib/ai/gemini";
import { Type } from "@google/genai";
export { looksLikeOpenQuestion, resolveMentionedAgents } from "@/lib/mentions";

/* ---------------------------------------------------------------------------------------------
 * Streaming writer: RC:StreamMsg chunks through the Platform Chat API
 * ------------------------------------------------------------------------------------------- */

class StreamWriter {
  private seq = 0;
  private messageId: string | undefined;
  private buffer = "";
  private full = "";
  private chain: Promise<void> = Promise.resolve();
  private lastFlush = 0;
  private broken = false;

  constructor(
    private from: string,
    private to: ChannelTarget,
    private toUserIds: string[] | undefined,
    private extra: Record<string, string> | undefined,
    private onStarted?: (messageId: string) => void,
  ) {}

  get text() {
    return this.full;
  }

  get id() {
    return this.messageId;
  }

  push(delta: string) {
    this.buffer += delta;
    this.full += delta;
    // Pace chunks (~4/s) to stay well within API limits while still feeling live.
    if (Date.now() - this.lastFlush > 250 || this.buffer.length > 160) {
      this.chain = this.chain.then(() => this.flush(false));
    }
  }

  private async flush(complete: boolean) {
    if (this.broken) return;
    if (!this.buffer && !complete) return;
    if (!this.buffer && complete && this.seq === 0) return;
    const content = this.buffer;
    this.buffer = "";
    this.lastFlush = Date.now();
    const seq = ++this.seq;
    try {
      const id = await sendStreamChunk(
        this.from,
        this.to,
        { content, seq, complete, messageId: this.messageId, type: "markdown", extra: this.messageId ? undefined : this.extra },
        this.toUserIds,
      );
      if (!this.messageId && id) {
        this.messageId = id;
        this.onStarted?.(id);
      }
    } catch (err) {
      console.error("[stream] chunk failed", err);
      this.broken = true;
    }
  }

  /** Completes the stream. Returns false if streaming failed (caller falls back to a text message). */
  async finish(tail: string): Promise<boolean> {
    this.buffer += tail;
    this.full += tail;
    this.chain = this.chain.then(() => this.flush(true));
    await this.chain;
    return !this.broken;
  }
}

/* ---------------------------------------------------------------------------------------------
 * Nexconn sink
 * ------------------------------------------------------------------------------------------- */

interface Requester {
  id: string;
  name: string;
  nexconnId: string;
}

class NexconnSink implements AgentSink {
  private writer: StreamWriter;
  private lastState: string | null = null;
  result: { messageId: string | null; text: string; sources: Source[] } = { messageId: null, text: "", sources: [] };

  constructor(
    private agent: Agent,
    private channel: CardChannel,
    private requester: Requester,
    private requireApproval: boolean,
    private privateTo: string[] | undefined,
  ) {
    this.writer = new StreamWriter(
      agent.nexconnId,
      channel.target,
      privateTo,
      privateTo ? { private: "1" } : undefined,
      // Clients don't get stream chunks pushed in realtime; announcing the id lets them pull it.
      (messageId) => void this.status("writing", "Writing a reply", messageId),
    );
  }

  async status(state: AgentStateName, detail?: string, streamMessageId?: string) {
    const key = `${state}:${detail ?? ""}:${streamMessageId ?? ""}`;
    if (key === this.lastState) return;
    this.lastState = key;
    const content: AgentStateContent = {
      agentId: this.agent.id,
      state,
      detail,
      ...(this.privateTo ? { privateTo: this.privateTo } : {}),
      ...(streamMessageId ? { streamMessageId } : {}),
    };
    try {
      await sendMessage({
        from: this.agent.nexconnId,
        to: this.channel.target,
        messageType: MSG.AGENT_STATE,
        content,
        persist: false,
        toUserIds: this.privateTo,
      });
    } catch (err) {
      // Status is best effort; the reply itself still goes through.
      console.warn("[agent] status send failed", err);
    }
  }

  private privateText = "";

  text(delta: string) {
    // Private replies (catch-up, translate) go out as one targeted message when complete;
    // public replies stream through RC:StreamMsg.
    if (this.privateTo) this.privateText += delta;
    else this.writer.push(delta);
  }

  async propose(proposal: ProposalPayload): Promise<string> {
    if (this.requireApproval) {
      await proposeAction({ agent: this.agent, channel: this.channel, proposal, requestedBy: this.requester });
      return `Posted an action card (${describeProposal(proposal)}). It runs only after someone approves it.`;
    }
    await executeProposal({ agent: this.agent, channel: this.channel, proposal, actor: this.requester });
    return `Created: ${describeProposal(proposal)}. Approval is not required in this space.`;
  }

  async complete(cited: { n: number; source: Source }[]) {
    const footer = formatSourcesFooter(cited);
    if (this.privateTo) {
      if (this.privateText.trim()) {
        const messageId = await sendMessage({
          from: this.agent.nexconnId,
          to: this.channel.target,
          messageType: MSG.TEXT,
          content: { content: this.privateText.trim() + footer, extra: JSON.stringify({ private: "1" }) },
          toUserIds: this.privateTo,
        });
        this.result = { messageId, text: this.privateText.trim(), sources: cited.map((c) => c.source) };
      }
      await this.status("done");
      return;
    }
    const body = this.writer.text;
    if (body.trim()) {
      const streamed = await this.writer.finish(footer);
      let messageId = this.writer.id ?? null;
      if (!streamed || !messageId) {
        // Fallback: deliver the whole reply as one text message.
        messageId = await sendMessage({
          from: this.agent.nexconnId,
          to: this.channel.target,
          messageType: MSG.TEXT,
          content: { content: body + footer },
          toUserIds: this.privateTo,
        });
      }
      this.result = { messageId, text: body, sources: cited.map((c) => c.source) };
      if (!this.privateTo) {
        await recordMirror({
          channelKey: this.channel.channelKey,
          spaceId: this.channel.space?.id ?? null,
          nexconnMessageId: messageId,
          senderAgentId: this.agent.id,
          senderName: this.agent.name,
          kind: "text",
          text: body,
          meta: cited.length ? { sources: cited.map((c) => ({ n: c.n, ...c.source })) } : null,
        });
      }
    }
    await this.status("done");
  }

  async fail(message: string) {
    if (this.writer.text.trim()) {
      await this.writer.finish("\n\n_Reply interrupted._").catch(() => undefined);
    }
    await this.status("error", message);
    try {
      const text = `${this.agent.name} couldn't finish: ${message}`;
      const messageId = await sendMessage({
        from: this.agent.nexconnId,
        to: this.channel.target,
        messageType: MSG.NOTICE,
        content: { level: "error", agentId: this.agent.id, text },
        toUserIds: this.privateTo,
      });
      if (!this.privateTo) {
        await recordMirror({
          channelKey: this.channel.channelKey,
          spaceId: this.channel.space?.id ?? null,
          nexconnMessageId: messageId,
          senderAgentId: this.agent.id,
          senderName: this.agent.name,
          kind: "notice",
          text,
        });
      }
    } catch (err) {
      console.error("[agent] failed to post error notice", err);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * Orchestration
 * ------------------------------------------------------------------------------------------- */

export interface TurnInput {
  agent: Agent;
  space: Space | null;
  channel: CardChannel;
  requester: Requester;
  task: AgentTask;
  priorOutputs?: { agentName: string; text: string }[];
  privateTo?: string[];
}

async function loadContext(input: TurnInput) {
  const db = getDb();
  const { space } = input;
  if (!space) {
    const history = await recentMessages(input.channel.channelKey, 40);
    return { memory: [], history, peopleNames: [input.requester.name], otherAgents: [], requireApproval: false };
  }
  const [memory, history, people, agentRows] = await Promise.all([
    db.select().from(schema.memoryItems).where(eq(schema.memoryItems.spaceId, space.id)).orderBy(asc(schema.memoryItems.createdAt)),
    recentMessages(input.channel.channelKey, 40),
    db
      .select({ name: schema.users.name })
      .from(schema.spaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.spaceMembers.userId))
      .where(eq(schema.spaceMembers.spaceId, space.id)),
    db
      .select({ name: schema.agents.name, handle: schema.agents.handle, tagline: schema.agents.tagline, id: schema.agents.id })
      .from(schema.spaceAgents)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
      .where(and(eq(schema.spaceAgents.spaceId, space.id), eq(schema.spaceAgents.enabled, true))),
  ]);
  return {
    memory,
    history,
    peopleNames: people.map((p) => p.name),
    otherAgents: agentRows.filter((a) => a.id !== input.agent.id),
    requireApproval: space.requireApproval,
  };
}

/** Runs one agent turn end to end, recording usage. Never throws (errors are posted to the chat). */
export async function runAgentTurn(input: TurnInput): Promise<AgentRunResult | null> {
  const db = getDb();
  const started = Date.now();
  const [run] = await db
    .insert(schema.aiRuns)
    .values({ userId: input.requester.id, spaceId: input.space?.id ?? null, agentId: input.agent.id })
    .returning({ id: schema.aiRuns.id });
  const ctx = await loadContext(input);
  const sink = new NexconnSink(input.agent, input.channel, input.requester, ctx.requireApproval, input.privateTo);
  try {
    const result = await runAgent(
      {
        agent: input.agent,
        space: input.space,
        memory: ctx.memory,
        history: ctx.history,
        peopleNames: ctx.peopleNames,
        otherAgents: ctx.otherAgents,
        priorOutputs: input.priorOutputs ?? [],
        task: input.task,
        forceResearch: input.agent.builtinKey === "researcher" && input.task.type === "reply",
      },
      sink,
    );
    await db.update(schema.aiRuns).set({ status: "ok", latencyMs: Date.now() - started }).where(eq(schema.aiRuns.id, run.id));
    return result;
  } catch (err) {
    await db
      .update(schema.aiRuns)
      .set({ status: "error", error: err instanceof Error ? err.message.slice(0, 300) : "error", latencyMs: Date.now() - started })
      .where(eq(schema.aiRuns.id, run.id));
    return null;
  }
}

/** Runs mentioned agents in order; each later agent sees the earlier agents' replies. */
export async function runMentionChain(input: Omit<TurnInput, "agent" | "priorOutputs"> & { agents: Agent[] }) {
  const prior: { agentName: string; text: string }[] = [];
  for (const agent of input.agents) {
    const result = await runAgentTurn({ ...input, agent, priorOutputs: prior });
    if (result?.text) prior.push({ agentName: agent.name, text: result.text });
  }
}

/* ---------------------------------------------------------------------------------------------
 * Mention resolution and auto replies
 * ------------------------------------------------------------------------------------------- */

/** In "auto" spaces: asks Gemini which agent (if any) should answer an unaddressed question. */
export async function routeOpenQuestion(text: string, agents: Agent[]): Promise<Agent | null> {
  if (agents.length === 0) return null;
  const response = await generate(
    [
      {
        role: "user",
        parts: [
          {
            text: `A person asked in a group chat: """${text.slice(0, 800)}"""\nAgents available:\n${agents
              .map((a) => `- ${a.handle}: ${a.tagline}`)
              .join("\n")}\nShould one agent answer? Only pick an agent if the question clearly needs its capability and is not just social chat between people. Reply with the handle or "none".`,
          },
        ],
      },
    ],
    {
      temperature: 0,
      maxOutputTokens: 60,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { agent: { type: Type.STRING, enum: [...agents.map((a) => a.handle), "none"] } },
        required: ["agent"],
      },
    },
    12000,
  );
  try {
    const parsed = JSON.parse(responseText(response)) as { agent?: string };
    return agents.find((a) => a.handle === parsed.agent) ?? null;
  } catch {
    return null;
  }
}
