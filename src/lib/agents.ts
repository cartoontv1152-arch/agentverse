import "server-only";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agent } from "@/lib/db/schema";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";
import { issueAccessToken, updateUser } from "@/lib/nexconn/server";
import { newNexconnId } from "@/lib/nexconn/ids";

let builtinsReady: Promise<Agent[]> | null = null;

/**
 * Makes sure every built-in agent exists in the database and is registered as a Nexconn user.
 * Safe to call on every request: work happens once per server instance.
 */
export function ensureBuiltinAgents(): Promise<Agent[]> {
  builtinsReady ??= syncBuiltins().catch((err) => {
    builtinsReady = null;
    throw err;
  });
  return builtinsReady;
}

async function syncBuiltins(): Promise<Agent[]> {
  const db = getDb();
  const existing = await db.select().from(schema.agents).where(isNotNull(schema.agents.builtinKey));
  const byKey = new Map(existing.map((a) => [a.builtinKey, a]));
  const result: Agent[] = [];
  for (const spec of BUILTIN_AGENTS) {
    const found = byKey.get(spec.key);
    if (found) {
      const changed =
        found.name !== spec.name ||
        found.tagline !== spec.tagline ||
        found.instructions !== spec.instructions ||
        JSON.stringify(found.tools) !== JSON.stringify(spec.tools);
      if (changed) {
        const [updated] = await db
          .update(schema.agents)
          .set({ name: spec.name, handle: spec.handle, tagline: spec.tagline, instructions: spec.instructions, tools: spec.tools, updatedAt: new Date() })
          .where(eq(schema.agents.id, found.id))
          .returning();
        result.push(updated);
      } else {
        result.push(found);
      }
      continue;
    }
    const nexconnId = newNexconnId("a");
    await issueAccessToken(nexconnId, spec.name);
    const [created] = await db
      .insert(schema.agents)
      .values({
        builtinKey: spec.key,
        name: spec.name,
        handle: spec.handle,
        tagline: spec.tagline,
        instructions: spec.instructions,
        tools: spec.tools,
        nexconnId,
      })
      .onConflictDoNothing({ target: schema.agents.builtinKey })
      .returning();
    if (created) {
      result.push(created);
    } else {
      // Another instance won the race; use its row.
      const [row] = await db.select().from(schema.agents).where(eq(schema.agents.builtinKey, spec.key));
      result.push(row);
    }
  }
  return result;
}

/** Agents the user may see in the gallery: built-ins plus their own custom agents. */
export async function listGalleryAgents(userId: string): Promise<Agent[]> {
  await ensureBuiltinAgents();
  return getDb()
    .select()
    .from(schema.agents)
    .where(or(isNotNull(schema.agents.builtinKey), eq(schema.agents.ownerId, userId)))
    .orderBy(sql`${schema.agents.builtinKey} is null`, schema.agents.createdAt);
}

/**
 * Whether the user may talk to this agent: built-ins, their own agents, and agents that are
 * members of a space they belong to.
 */
export async function canUseAgent(userId: string, agent: Agent): Promise<boolean> {
  if (agent.builtinKey || agent.ownerId === userId) return true;
  const rows = await getDb()
    .select({ spaceId: schema.spaceAgents.spaceId })
    .from(schema.spaceAgents)
    .innerJoin(
      schema.spaceMembers,
      and(eq(schema.spaceMembers.spaceId, schema.spaceAgents.spaceId), eq(schema.spaceMembers.userId, userId)),
    )
    .where(eq(schema.spaceAgents.agentId, agent.id))
    .limit(1);
  return rows.length > 0;
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) return null;
  const [row] = await getDb().select().from(schema.agents).where(eq(schema.agents.id, agentId)).limit(1);
  return row ?? null;
}

export async function getAgentsByNexconnIds(ids: string[]): Promise<Agent[]> {
  if (ids.length === 0) return [];
  return getDb().select().from(schema.agents).where(inArray(schema.agents.nexconnId, ids));
}

export async function registerCustomAgentUser(name: string, avatarUrl: string | null): Promise<string> {
  const nexconnId = newNexconnId("a");
  await issueAccessToken(nexconnId, name, avatarUrl);
  return nexconnId;
}

export async function syncAgentProfile(agent: Pick<Agent, "nexconnId" | "name" | "avatarUrl">) {
  await updateUser(agent.nexconnId, agent.name, agent.avatarUrl);
}

/** Public shape sent to clients. */
export function toPublicAgent(agent: Agent, viewerId?: string) {
  const canSeeInstructions = Boolean(agent.builtinKey) || agent.ownerId === viewerId;
  return {
    id: agent.id,
    kind: agent.builtinKey ? ("builtin" as const) : ("custom" as const),
    builtinKey: agent.builtinKey,
    ownerId: agent.ownerId,
    name: agent.name,
    handle: agent.handle,
    tagline: agent.tagline,
    instructions: canSeeInstructions ? agent.instructions : "",
    tools: agent.tools,
    avatarUrl: agent.avatarUrl,
    nexconnId: agent.nexconnId,
  };
}
export type PublicAgent = ReturnType<typeof toPublicAgent>;
