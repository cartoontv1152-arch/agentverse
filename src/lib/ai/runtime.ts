import "server-only";
import {
  FunctionCallingConfigMode,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type Part,
} from "@google/genai";
import { z } from "zod";
import type { Agent, MemoryItem, Space } from "@/lib/db/schema";
import type { ProposalPayload, Source } from "@/lib/message-types";
import { AiUnavailableError, isRetryable, modelChain, openStream, toAiError } from "@/lib/ai/gemini";
import { SourceRegistry, extractUrls, hackerNewsSearch, readUrl, wikipediaSearch } from "@/lib/ai/research";
import type { MirrorMessage } from "@/lib/mirror";
import type { AgentStateName } from "@/lib/message-types";

/* ---------------------------------------------------------------------------------------------
 * Sink: where an agent's output goes (a Nexconn channel, or the Studio test console)
 * ------------------------------------------------------------------------------------------- */

export interface AgentSink {
  status(state: AgentStateName, detail?: string): Promise<void>;
  /** Streamed answer text (called many times). */
  text(delta: string): void;
  /** Handles a proposal; returns a short note for the model describing what happened. */
  propose(proposal: ProposalPayload): Promise<string>;
  /** Finishes the reply and attaches the sources the answer cited. */
  complete(cited: { n: number; source: Source }[]): Promise<void>;
  fail(message: string): Promise<void>;
}

/* ---------------------------------------------------------------------------------------------
 * Context
 * ------------------------------------------------------------------------------------------- */

export type AgentTask =
  | { type: "reply"; text: string; requesterName: string }
  | { type: "catchup"; requesterName: string; unread: MirrorMessage[] }
  | { type: "translate"; requesterName: string; language: string; sourceSender: string; sourceText: string };

export interface AgentRunContext {
  agent: Agent;
  space: Space | null;
  memory: MemoryItem[];
  history: MirrorMessage[];
  peopleNames: string[];
  otherAgents: { name: string; handle: string; tagline: string }[];
  priorOutputs: { agentName: string; text: string }[];
  task: AgentTask;
  /** Built-in research agents always research before answering. */
  forceResearch: boolean;
}

export interface AgentRunResult {
  text: string;
  sources: Source[];
  proposals: number;
}

const MAX_STEPS = 5;
const MAX_RESEARCH_CALLS = 4;

function formatTime(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function transcript(messages: MirrorMessage[]): string {
  if (messages.length === 0) return "(no earlier messages)";
  return messages
    .map((m) => {
      const who = m.senderAgentId ? `${m.senderName} (agent)` : m.senderName;
      return `[${formatTime(m.sentAt)}] ${who}: ${m.text.replace(/\s+\n/g, "\n").slice(0, 1200)}`;
    })
    .join("\n");
}

function buildSystemInstruction(ctx: AgentRunContext): string {
  const { agent, space } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const where = space
    ? `the group chat space "${space.name}"${space.description ? ` (${space.description})` : ""}`
    : "a private chat with one person";
  const lines = [
    `You are ${agent.name}, an AI agent and a member of ${where} in AgentVerse, a group chat where people and AI agents work together.`,
    "",
    "Your role and instructions:",
    agent.instructions || "Be a helpful, concise member of the conversation.",
    "",
    "Chat rules:",
    "- Write like a thoughtful colleague in a chat: short, clear, no filler. Use Markdown sparingly (short lists, bold for key facts).",
    "- Do not start with your own name or with a greeting. Refer to people by their names.",
    "- Only use the tools you are given. Never claim to have done something you did not do.",
    "- Research efficiently: one or two well-chosen tool calls are usually enough; then answer.",
    "- When you call a propose_* tool, the group sees an interactive card; do not repeat the card's full contents in text.",
    "- If another agent was asked to do a later step in the same message, leave that step to them.",
    `- Today's date is ${today} (UTC).`,
  ];
  if (ctx.peopleNames.length) lines.push(`- People in this chat: ${ctx.peopleNames.join(", ")}.`);
  if (ctx.otherAgents.length) {
    lines.push(`- Other agents here: ${ctx.otherAgents.map((a) => `@${a.handle} (${a.tagline})`).join("; ")}.`);
  }
  if (ctx.memory.length) {
    lines.push("", "Space memory (facts and decisions the group pinned; treat as reliable context):");
    for (const m of ctx.memory.slice(0, 40)) lines.push(`- [${m.kind}] ${m.text}`);
  }
  return lines.join("\n");
}

function buildUserTurn(ctx: AgentRunContext): string {
  const parts: string[] = [];
  const { task } = ctx;
  if (task.type === "catchup") {
    parts.push(`Messages ${task.requesterName} has not read yet (oldest first):`, transcript(task.unread), "");
    parts.push(
      `Task: ${task.requesterName} asked "what did I miss?". Summarise these unread messages for them: outcome first, then key points, decisions and open questions or anything that needs their attention.`,
    );
    if (task.unread.length === 0) parts.push("There are no unread messages; say so in one sentence.");
    return parts.join("\n");
  }
  parts.push("Recent conversation (oldest first):", transcript(ctx.history), "");
  if (ctx.priorOutputs.length) {
    parts.push("Replies other agents just posted for this same request:");
    for (const p of ctx.priorOutputs) parts.push(`${p.agentName}: ${p.text.slice(0, 3000)}`);
    parts.push("");
  }
  if (task.type === "translate") {
    parts.push(
      `Task: ${task.requesterName} asked you to translate this message from ${task.sourceSender} into ${task.language}:`,
      `"""${task.sourceText}"""`,
      "Reply with the translation only.",
    );
    return parts.join("\n");
  }
  parts.push(`Task: ${task.requesterName} wrote to you: """${task.text}"""`);
  const urls = extractUrls(task.text);
  if (urls.length && ctx.agent.tools.includes("search")) {
    parts.push(`Links in the request you can read with read_url: ${urls.join(", ")}`);
  }
  parts.push("Respond to this request now.");
  return parts.join("\n");
}

/* ---------------------------------------------------------------------------------------------
 * Tools
 * ------------------------------------------------------------------------------------------- */

function declarations(agent: Agent): FunctionDeclaration[] {
  const decls: FunctionDeclaration[] = [];
  if (agent.tools.includes("search")) {
    decls.push(
      {
        name: "wikipedia_search",
        description:
          "Search Wikipedia and return summaries of the best matching articles with numbered sources. Good for facts about places, people, organisations, concepts and history.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Search terms, e.g. 'Lisbon tram 28'." },
            language: { type: Type.STRING, description: "Wikipedia language code, default 'en'." },
          },
          required: ["query"],
        },
      },
      {
        name: "hn_search",
        description:
          "Search Hacker News stories (technology, startups, programming, AI news and discussions). Returns titles, links, points and dates with numbered sources.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Search terms." },
            recent: { type: Type.BOOLEAN, description: "true to sort by newest instead of relevance." },
          },
          required: ["query"],
        },
      },
      {
        name: "read_url",
        description:
          "Read a public web page and extract the facts relevant to a question. Use for links people share or links returned by other tools.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: "Full http(s) URL." },
            question: { type: Type.STRING, description: "What you want to learn from the page." },
          },
          required: ["url", "question"],
        },
      },
    );
  }
  if (agent.tools.includes("tasks")) {
    decls.push({
      name: "propose_checklist",
      description:
        "Propose a task checklist card for the group. People approve it, then anyone can tick items. Use when asked to plan, organise or list to-dos.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short checklist title." },
          items: {
            type: Type.ARRAY,
            description: "1 to 15 actionable items.",
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The task, starting with a verb." },
                assignee: { type: Type.STRING, description: "Exact display name of the owner, if clear." },
                due: { type: Type.STRING, description: "Due date as YYYY-MM-DD, if implied." },
              },
              required: ["text"],
            },
          },
        },
        required: ["title", "items"],
      },
    });
  }
  if (agent.tools.includes("polls")) {
    decls.push({
      name: "propose_poll",
      description: "Propose a poll card so the group can vote. Votes update live for everyone.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2 to 6 short options." },
          multi: { type: Type.BOOLEAN, description: "true if people may pick several options." },
        },
        required: ["question", "options"],
      },
    });
  }
  if (agent.tools.includes("summarize")) {
    decls.push({
      name: "propose_memory",
      description:
        "Offer to save durable facts or decisions to the space memory, which agents use as context later. Only for clear, lasting information.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          entries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: { type: Type.STRING, enum: ["fact", "decision"] },
                text: { type: Type.STRING, description: "One self-contained sentence." },
              },
              required: ["kind", "text"],
            },
          },
        },
        required: ["entries"],
      },
    });
  }
  return decls;
}

const checklistArgs = z.object({
  title: z.string().trim().min(1).max(120),
  items: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(200),
        assignee: z.string().trim().max(80).optional().nullable(),
        due: z.string().trim().max(20).optional().nullable(),
      }),
    )
    .min(1)
    .max(15),
});
const pollArgs = z.object({
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
  multi: z.boolean().optional().default(false),
});
const memoryArgs = z.object({
  entries: z
    .array(z.object({ kind: z.enum(["fact", "decision"]), text: z.string().trim().min(1).max(400) }))
    .min(1)
    .max(10),
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the page";
  }
}

async function executeCall(
  call: FunctionCall,
  sink: AgentSink,
  registry: SourceRegistry,
  counters: { research: number; proposals: number },
): Promise<Record<string, unknown>> {
  const args = (call.args ?? {}) as Record<string, unknown>;
  try {
    switch (call.name) {
      case "wikipedia_search":
      case "hn_search":
      case "read_url": {
        if (++counters.research > MAX_RESEARCH_CALLS) return { error: "Research budget used up. Answer now with what you found, and say what you could not verify." };
        if (call.name === "wikipedia_search") {
          const query = String(args.query ?? "").slice(0, 200);
          await sink.status("searching", `Searching Wikipedia for "${query}"`);
          return await wikipediaSearch(query, registry, typeof args.language === "string" ? args.language : "en");
        }
        if (call.name === "hn_search") {
          const query = String(args.query ?? "").slice(0, 200);
          await sink.status("searching", `Searching Hacker News for "${query}"`);
          return await hackerNewsSearch(query, registry, args.recent === true);
        }
        const url = String(args.url ?? "");
        await sink.status("searching", `Reading ${hostOf(url)}`);
        return await readUrl(url, String(args.question ?? "Summarise the page."), registry);
      }
      case "propose_checklist": {
        const parsed = checklistArgs.parse(args);
        counters.proposals++;
        await sink.status("proposing", "Drafting a checklist");
        const note = await sink.propose({
          type: "tasks",
          title: parsed.title,
          items: parsed.items.map((i) => ({ text: i.text, assigneeName: i.assignee || null, due: i.due || null })),
        });
        return { result: note };
      }
      case "propose_poll": {
        const parsed = pollArgs.parse(args);
        counters.proposals++;
        await sink.status("proposing", "Setting up a poll");
        const note = await sink.propose({ type: "poll", question: parsed.question, options: parsed.options, multi: parsed.multi });
        return { result: note };
      }
      case "propose_memory": {
        const parsed = memoryArgs.parse(args);
        counters.proposals++;
        await sink.status("proposing", "Preparing memory entries");
        const note = await sink.propose({ type: "memory", entries: parsed.entries });
        return { result: note };
      }
      default:
        return { error: `Unknown tool ${call.name}` };
    }
  } catch (err) {
    if (err instanceof z.ZodError) return { error: `Invalid arguments: ${err.issues[0]?.message ?? "check the schema"}` };
    console.error(`[agent] tool ${call.name} failed`, err);
    return { error: "The tool failed. Continue without it and say what could not be checked." };
  }
}

/* ---------------------------------------------------------------------------------------------
 * Run loop
 * ------------------------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs one agent turn: builds context, streams Gemini output into the sink, executes tool calls
 * (research and proposals) and finishes with cited sources. Throws AiUnavailableError on failure
 * after notifying the sink.
 */
export async function runAgent(ctx: AgentRunContext, sink: AgentSink): Promise<AgentRunResult> {
  const registry = new SourceRegistry();
  const counters = { research: 0, proposals: 0 };
  const decls = ctx.task.type === "translate" ? [] : declarations(ctx.agent);
  const researchNames = ["wikipedia_search", "hn_search", "read_url"];
  const contents: Content[] = [{ role: "user", parts: [{ text: buildUserTurn(ctx) }] }];
  const systemInstruction = buildSystemInstruction(ctx);
  let answer = "";

  await sink.status("thinking", "Reading the conversation");

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const lastStep = step === MAX_STEPS - 1;
      const force = step === 0 && ctx.forceResearch && decls.some((d) => researchNames.includes(d.name ?? ""));
      // Over-budget research calls get an error result telling the model to answer (see executeCall).
      const mode = force
        ? FunctionCallingConfigMode.ANY
        : lastStep
          ? FunctionCallingConfigMode.NONE
          : FunctionCallingConfigMode.AUTO;
      const config: GenerateContentConfig = {
        systemInstruction,
        temperature: 0.5,
        maxOutputTokens: 1200,
        ...(decls.length ? { tools: [{ functionDeclarations: decls }] } : {}),
        ...(decls.length
          ? {
              toolConfig: {
                functionCallingConfig: force ? { mode, allowedFunctionNames: researchNames } : { mode },
              },
            }
          : {}),
      };

      const { parts, calls, text } = await streamStep(contents, config, sink, answer.length === 0 && step === 0);
      answer += text;
      contents.push({ role: "model", parts });
      if (calls.length === 0) break;

      const responses = await Promise.all(calls.map((c) => executeCall(c, sink, registry, counters)));
      contents.push({
        role: "user",
        parts: calls.map((c, i) => ({ functionResponse: { id: c.id, name: c.name, response: responses[i] } })),
      });
    }

    if (!answer.trim() && counters.proposals === 0) {
      throw new AiUnavailableError("The agent returned an empty reply.", "failed");
    }
    const cited = registry.cited(answer);
    await sink.complete(cited);
    return { text: answer.trim(), sources: cited.map((c) => c.source), proposals: counters.proposals };
  } catch (err) {
    const aiErr = toAiError(err);
    await sink.fail(aiErr.message);
    throw aiErr;
  }
}

/**
 * Streams one model step. Retries (with backoff and model fallback) only while nothing has been
 * shown to users yet, so a retry never duplicates visible text.
 */
async function streamStep(contents: Content[], config: GenerateContentConfig, sink: AgentSink, firstOutput: boolean) {
  let lastError: unknown;
  const models = modelChain();
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const parts: Part[] = [];
      const calls: FunctionCall[] = [];
      let text = "";
      let emitted = false;
      try {
        const stream = await openStream(contents, config, model);
        for await (const chunk of stream) {
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            parts.push(part);
            if (part.functionCall) calls.push(part.functionCall);
            else if (typeof part.text === "string" && part.text && !part.thought) {
              if (!emitted && firstOutput) await sink.status("writing", "Writing a reply");
              emitted = true;
              text += part.text;
              sink.text(part.text);
            }
          }
        }
        return { parts: mergeTextParts(parts), calls, text };
      } catch (err) {
        lastError = err;
        if (emitted || !isRetryable(err)) throw err;
        await sleep(800 * 2 ** attempt + Math.random() * 300);
      }
    }
  }
  throw lastError;
}

/** Joins consecutive plain text parts from a stream so the model turn stays compact. */
function mergeTextParts(parts: Part[]): Part[] {
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    const plain = (p: Part) => typeof p.text === "string" && !p.thought && !p.thoughtSignature && Object.keys(p).length === 1;
    if (prev && plain(prev) && plain(part)) prev.text = (prev.text ?? "") + (part.text ?? "");
    else merged.push({ ...part });
  }
  return merged;
}
