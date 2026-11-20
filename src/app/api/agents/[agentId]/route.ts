import { and, eq, ne } from "drizzle-orm";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { canUseAgent, getAgent, syncAgentProfile, toPublicAgent } from "@/lib/agents";
import { agentUpdateSchema } from "@/lib/validation";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";
import { leaveGroup } from "@/lib/nexconn/server";

type Ctx = { params: Promise<{ agentId: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent || !(await canUseAgent(user.id, agent))) throw new ApiError(404, "not_found", "Agent not found.");
  return ok({ agent: toPublicAgent(agent, user.id) });
});

async function requireOwnedAgent(agentId: string, userId: string) {
  const agent = await getAgent(agentId);
  if (!agent || agent.ownerId !== userId) throw new ApiError(404, "not_found", "Agent not found.");
  return agent;
}

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { agentId } = await params;
  const agent = await requireOwnedAgent(agentId, user.id);
  const input = await parseJson(req, agentUpdateSchema);
  const db = getDb();
  if (input.handle && input.handle !== agent.handle) {
    if (BUILTIN_AGENTS.some((b) => b.handle.toLowerCase() === input.handle!.toLowerCase())) {
      throw new ApiError(409, "handle_taken", `@${input.handle} is a built-in agent. Choose another handle.`, { field: "handle" });
    }
    const [clash] = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(and(eq(schema.agents.ownerId, user.id), eq(schema.agents.handle, input.handle), ne(schema.agents.id, agent.id)))
      .limit(1);
    if (clash) throw new ApiError(409, "handle_taken", `You already have an agent called @${input.handle}.`, { field: "handle" });
  }
  const [updated] = await db
    .update(schema.agents)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.agents.id, agent.id))
    .returning();
  if (input.name !== undefined || input.avatarUrl !== undefined) {
    await syncAgentProfile(updated).catch((err) => console.warn("[agents] profile sync failed", err));
  }
  return ok({ agent: toPublicAgent(updated, user.id) });
});

/** Deletes a custom agent and removes it from every space (Nexconn groups included). */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { agentId } = await params;
  const agent = await requireOwnedAgent(agentId, user.id);
  const db = getDb();
  const groups = await db
    .select({ groupId: schema.spaces.nexconnGroupId })
    .from(schema.spaceAgents)
    .innerJoin(schema.spaces, eq(schema.spaces.id, schema.spaceAgents.spaceId))
    .where(eq(schema.spaceAgents.agentId, agent.id));
  await Promise.all(groups.map((g) => leaveGroup(g.groupId, [agent.nexconnId]).catch(() => undefined)));
  await db.delete(schema.agents).where(eq(schema.agents.id, agent.id));
  return ok({ ok: true });
});
