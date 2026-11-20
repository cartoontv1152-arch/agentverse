import { and, count, eq, inArray } from "drizzle-orm";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { listGalleryAgents, registerCustomAgentUser, toPublicAgent } from "@/lib/agents";
import { listSpacesForUser } from "@/lib/spaces";
import { agentCreateSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";

const MAX_CUSTOM_AGENTS = 20;

/** Gallery: built-in agents, the user's custom agents, and which of the user's spaces each is in. */
export const GET = route(async () => {
  const user = await requireUser();
  const [agents, spaces] = await Promise.all([listGalleryAgents(user.id), listSpacesForUser(user.id)]);
  const links = spaces.length
    ? await getDb()
        .select({ spaceId: schema.spaceAgents.spaceId, agentId: schema.spaceAgents.agentId })
        .from(schema.spaceAgents)
        .where(inArray(schema.spaceAgents.spaceId, spaces.map((s) => s.id)))
    : [];
  return ok({
    agents: agents.map((a) => ({
      ...toPublicAgent(a, user.id),
      spaceIds: links.filter((l) => l.agentId === a.id).map((l) => l.spaceId),
    })),
    spaces: spaces.map((s) => ({ id: s.id, name: s.name, role: s.role })),
  });
});

/** Creates a custom agent (a new Nexconn user) owned by the signed-in person. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`agent-create:${user.id}`, 20, 3600, "You've created a lot of agents this hour. Try again later.");
  const input = await parseJson(req, agentCreateSchema);
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.agents).where(eq(schema.agents.ownerId, user.id));
  if (Number(n) >= MAX_CUSTOM_AGENTS) throw new ApiError(400, "too_many_agents", `You can have up to ${MAX_CUSTOM_AGENTS} custom agents.`);
  const lower = input.handle.toLowerCase();
  if (BUILTIN_AGENTS.some((b) => b.handle.toLowerCase() === lower)) {
    throw new ApiError(409, "handle_taken", `@${input.handle} is a built-in agent. Choose another handle.`, { field: "handle" });
  }
  const [clash] = await db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(and(eq(schema.agents.ownerId, user.id), eq(schema.agents.handle, input.handle)))
    .limit(1);
  if (clash) throw new ApiError(409, "handle_taken", `You already have an agent called @${input.handle}.`, { field: "handle" });
  const nexconnId = await registerCustomAgentUser(input.name, input.avatarUrl ?? null);
  const [agent] = await db
    .insert(schema.agents)
    .values({
      ownerId: user.id,
      name: input.name,
      handle: input.handle,
      tagline: input.tagline,
      instructions: input.instructions,
      tools: input.tools,
      avatarUrl: input.avatarUrl ?? null,
      nexconnId,
    })
    .returning();
  return ok({ agent: toPublicAgent(agent, user.id) }, 201);
});
