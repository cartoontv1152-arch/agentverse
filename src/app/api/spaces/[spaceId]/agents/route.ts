import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { canUseAgent, getAgent } from "@/lib/agents";
import { joinGroup } from "@/lib/nexconn/server";

/** Adds an agent to the space: it becomes a member of the Nexconn group. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const { agentId } = await parseJson(req, z.object({ agentId: z.string().uuid() }));
  const agent = await getAgent(agentId);
  if (!agent || !(await canUseAgent(user.id, agent))) throw new ApiError(404, "not_found", "Agent not found.");
  const db = getDb();
  const roster = await db
    .select({ agentId: schema.spaceAgents.agentId, handle: schema.agents.handle })
    .from(schema.spaceAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
    .where(eq(schema.spaceAgents.spaceId, spaceId));
  if (roster.some((r) => r.agentId === agentId)) return ok({ ok: true, alreadyMember: true });
  if (roster.some((r) => r.handle.toLowerCase() === agent.handle.toLowerCase())) {
    throw new ApiError(409, "handle_taken", `This space already has an agent called @${agent.handle}. Rename one of them first.`);
  }
  if (roster.length >= 12) throw new ApiError(400, "too_many_agents", "A space can have up to 12 agents.");
  await joinGroup(m.space.nexconnGroupId, [agent.nexconnId]);
  await db.insert(schema.spaceAgents).values({ spaceId, agentId, addedBy: user.id }).onConflictDoNothing();
  return ok({ ok: true }, 201);
});
