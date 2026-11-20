import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function listMemory(spaceId: string) {
  return getDb()
    .select({
      id: schema.memoryItems.id,
      kind: schema.memoryItems.kind,
      text: schema.memoryItems.text,
      createdAt: schema.memoryItems.createdAt,
      updatedAt: schema.memoryItems.updatedAt,
      userName: schema.users.name,
      agentName: schema.agents.name,
    })
    .from(schema.memoryItems)
    .leftJoin(schema.users, eq(schema.users.id, schema.memoryItems.createdByUserId))
    .leftJoin(schema.agents, eq(schema.agents.id, schema.memoryItems.createdByAgentId))
    .where(eq(schema.memoryItems.spaceId, spaceId))
    .orderBy(asc(schema.memoryItems.createdAt));
}
