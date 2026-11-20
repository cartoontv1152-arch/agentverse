import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { leaveGroup } from "@/lib/nexconn/server";

type Ctx = { params: Promise<{ spaceId: string; agentId: string }> };

async function loadLink(spaceId: string, agentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) throw new ApiError(404, "not_found", "That agent is not in this space.");
  const [row] = await getDb()
    .select({ addedBy: schema.spaceAgents.addedBy, nexconnId: schema.agents.nexconnId })
    .from(schema.spaceAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
    .where(and(eq(schema.spaceAgents.spaceId, spaceId), eq(schema.spaceAgents.agentId, agentId)))
    .limit(1);
  if (!row) throw new ApiError(404, "not_found", "That agent is not in this space.");
  return row;
}

/** Owner or the member who added the agent can let it respond or pause it. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId, agentId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const link = await loadLink(spaceId, agentId);
  if (m.role !== "owner" && link.addedBy !== user.id) throw new ApiError(403, "forbidden", "Only the space owner can change this agent.");
  const { enabled } = await parseJson(req, z.object({ enabled: z.boolean() }));
  await getDb()
    .update(schema.spaceAgents)
    .set({ enabled })
    .where(and(eq(schema.spaceAgents.spaceId, spaceId), eq(schema.spaceAgents.agentId, agentId)));
  return ok({ ok: true });
});

/** Removes the agent from the space and from the Nexconn group. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId, agentId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const link = await loadLink(spaceId, agentId);
  if (m.role !== "owner" && link.addedBy !== user.id) throw new ApiError(403, "forbidden", "Only the space owner can remove this agent.");
  await leaveGroup(m.space.nexconnGroupId, [link.nexconnId]).catch((err) => console.warn("[spaces] agent leave failed", err));
  await getDb().delete(schema.spaceAgents).where(and(eq(schema.spaceAgents.spaceId, spaceId), eq(schema.spaceAgents.agentId, agentId)));
  return ok({ ok: true });
});
