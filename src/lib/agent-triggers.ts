import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agent, Space } from "@/lib/db/schema";
import { groupChannelKey } from "@/lib/spaces";
import type { CardChannel } from "@/lib/cards";

/** Agents in a space with their enabled flag. */
export async function spaceAgentRows(spaceId: string): Promise<{ agent: Agent; enabled: boolean }[]> {
  return getDb()
    .select({ agent: schema.agents, enabled: schema.spaceAgents.enabled })
    .from(schema.spaceAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
    .where(eq(schema.spaceAgents.spaceId, spaceId));
}

export async function spaceAgentByBuiltin(spaceId: string, builtinKey: string) {
  const [row] = await getDb()
    .select({ agent: schema.agents, enabled: schema.spaceAgents.enabled })
    .from(schema.spaceAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
    .where(and(eq(schema.spaceAgents.spaceId, spaceId), eq(schema.agents.builtinKey, builtinKey)))
    .limit(1);
  return row ?? null;
}

export function spaceChannel(space: Space): CardChannel {
  return {
    target: { type: "group", groupId: space.nexconnGroupId },
    channelKey: groupChannelKey(space.nexconnGroupId),
    space,
  };
}

/** Clamp client-reported send times to a sane window around now. */
export function sentAtFrom(sentTime: number | undefined): Date {
  const now = Date.now();
  if (!sentTime || Math.abs(now - sentTime) > 10 * 60 * 1000) return new Date(now);
  return new Date(sentTime);
}
