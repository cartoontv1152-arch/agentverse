import { eq } from "drizzle-orm";
import { ApiError, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import type { Agent } from "@/lib/db/schema";
import { canUseAgent, getAgent } from "@/lib/agents";
import { testConsoleSchema } from "@/lib/validation";
import { checkAiLimits } from "@/lib/ai/limits";
import { runAgent, type AgentSink } from "@/lib/ai/runtime";
import { describeProposal } from "@/lib/cards";
import type { MirrorMessage } from "@/lib/mirror";

export const maxDuration = 120;

/**
 * Agent Studio test console: runs the real agent (real Gemini, real tools) and streams events as
 * NDJSON to the browser. Nothing is posted to any chat; proposals are previewed only.
 * Owners may pass `draft` to test unsaved changes.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ agentId: string }> }) => {
  const user = await requireUser();
  const { agentId } = await params;
  const stored = await getAgent(agentId);
  if (!stored || !(await canUseAgent(user.id, stored))) throw new ApiError(404, "not_found", "Agent not found.");
  const input = await parseJson(req, testConsoleSchema);
  await checkAiLimits(user.id, null, 1);

  const draft = stored.ownerId === user.id ? input.draft : undefined;
  const agent: Agent = {
    ...stored,
    name: draft?.name ?? stored.name,
    instructions: draft?.instructions ?? stored.instructions,
    tools: draft?.tools ?? stored.tools,
    tagline: draft?.tagline ?? stored.tagline,
  };

  const now = Date.now();
  const history: MirrorMessage[] = input.history.map((h, i) => ({
    id: `h${i}`,
    channelKey: "test",
    spaceId: null,
    nexconnMessageId: `h${i}`,
    senderUserId: h.role === "user" ? user.id : null,
    senderAgentId: h.role === "agent" ? agent.id : null,
    senderName: h.role === "user" ? user.name : agent.name,
    kind: "text",
    text: h.text,
    meta: null,
    sentAt: new Date(now - (input.history.length - i) * 1000),
    createdAt: new Date(now),
  }));

  const db = getDb();
  const [run] = await db.insert(schema.aiRuns).values({ userId: user.id, agentId: stored.id }).returning({ id: schema.aiRuns.id });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const sink: AgentSink = {
        async status(state, detail) {
          send({ type: "status", state, detail: detail ?? null });
        },
        text(delta) {
          send({ type: "text", delta });
        },
        async propose(proposal) {
          send({ type: "proposal", proposal, summary: describeProposal(proposal) });
          return "Preview only (test console): in a chat this would post an action card for approval.";
        },
        async complete(cited) {
          send({ type: "sources", sources: cited.map((c) => ({ n: c.n, ...c.source })) });
        },
        async fail(message) {
          send({ type: "error", message });
        },
      };
      const started = Date.now();
      try {
        await runAgent(
          {
            agent,
            space: null,
            memory: [],
            history,
            peopleNames: [user.name],
            otherAgents: [],
            priorOutputs: [],
            task: { type: "reply", text: input.message, requesterName: user.name },
            forceResearch: stored.builtinKey === "researcher",
          },
          sink,
        );
        await db.update(schema.aiRuns).set({ status: "ok", latencyMs: Date.now() - started }).where(eq(schema.aiRuns.id, run.id));
        send({ type: "done" });
      } catch (err) {
        await db
          .update(schema.aiRuns)
          .set({ status: "error", error: err instanceof Error ? err.message.slice(0, 300) : "error", latencyMs: Date.now() - started })
          .where(eq(schema.aiRuns.id, run.id));
        send({ type: "done", failed: true });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});
