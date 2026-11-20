import { inArray } from "drizzle-orm";
import { ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { listContacts } from "@/lib/spaces";
import { canUseAgent, getAgentsByNexconnIds } from "@/lib/agents";

/**
 * Resolves Nexconn user ids (from channel lists and messages) to display profiles. Only returns
 * people the viewer shares a space with, themselves, and agents they can use.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9]{1,64}$/.test(s))
    .slice(0, 100);
  if (ids.length === 0) return ok({ profiles: [] });
  const contacts = await listContacts(user.id);
  const visible = new Set([user.nexconnId, ...contacts.map((c) => c.nexconnId)]);
  const people = await getDb()
    .select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl, nexconnId: schema.users.nexconnId })
    .from(schema.users)
    .where(inArray(schema.users.nexconnId, ids.filter((id) => visible.has(id))));
  const agents = await getAgentsByNexconnIds(ids);
  const allowedAgents = [];
  for (const agent of agents) if (await canUseAgent(user.id, agent)) allowedAgents.push(agent);
  return ok({
    profiles: [
      ...people.map((p) => ({ kind: "user" as const, id: p.id, nexconnId: p.nexconnId, name: p.name, avatarUrl: p.avatarUrl, handle: null })),
      ...allowedAgents.map((a) => ({ kind: "agent" as const, id: a.id, nexconnId: a.nexconnId, name: a.name, avatarUrl: a.avatarUrl, handle: a.handle })),
    ],
  });
});
