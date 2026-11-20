import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Space } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { ensureBuiltinAgents, toPublicAgent } from "@/lib/agents";
import { createGroup, joinGroup } from "@/lib/nexconn/server";
import { newNexconnId } from "@/lib/nexconn/ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Membership {
  space: Space;
  role: "owner" | "member";
  lastReadAt: Date;
}

/** Loads a space and the user's membership, or throws 404 (no existence leak to non-members). */
export async function requireMembership(spaceId: string, userId: string): Promise<Membership> {
  if (!UUID.test(spaceId)) throw new ApiError(404, "not_found", "This space does not exist or you are not a member.");
  const rows = await getDb()
    .select({ space: schema.spaces, role: schema.spaceMembers.role, lastReadAt: schema.spaceMembers.lastReadAt })
    .from(schema.spaceMembers)
    .innerJoin(schema.spaces, eq(schema.spaces.id, schema.spaceMembers.spaceId))
    .where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "not_found", "This space does not exist or you are not a member.");
  return row;
}

export function requireOwner(m: Membership) {
  if (m.role !== "owner") throw new ApiError(403, "forbidden", "Only the space owner can change this.");
}

export async function createSpace(input: {
  name: string;
  description: string;
  owner: { id: string; nexconnId: string };
}): Promise<Space> {
  const db = getDb();
  const builtins = await ensureBuiltinAgents();
  const groupId = newNexconnId("g");
  // Nexconn first: if the group cannot be created nothing is written locally.
  await createGroup(groupId, input.name, input.owner.nexconnId, builtins.map((a) => a.nexconnId));
  const [space] = await db
    .insert(schema.spaces)
    .values({ name: input.name, description: input.description, ownerId: input.owner.id, nexconnGroupId: groupId })
    .returning();
  await db.batch([
    db.insert(schema.spaceMembers).values({ spaceId: space.id, userId: input.owner.id, role: "owner" }),
    db.insert(schema.spaceAgents).values(
      builtins.map((a) => ({ spaceId: space.id, agentId: a.id, addedBy: input.owner.id })),
    ),
  ]);
  return space;
}

export async function addMember(space: Space, user: { id: string; nexconnId: string }) {
  await joinGroup(space.nexconnGroupId, [user.nexconnId]);
  await getDb()
    .insert(schema.spaceMembers)
    .values({ spaceId: space.id, userId: user.id, role: "member" })
    .onConflictDoNothing();
}

export async function listSpacesForUser(userId: string) {
  return getDb()
    .select({
      id: schema.spaces.id,
      name: schema.spaces.name,
      description: schema.spaces.description,
      nexconnGroupId: schema.spaces.nexconnGroupId,
      role: schema.spaceMembers.role,
      lastReadAt: schema.spaceMembers.lastReadAt,
    })
    .from(schema.spaceMembers)
    .innerJoin(schema.spaces, eq(schema.spaces.id, schema.spaceMembers.spaceId))
    .where(eq(schema.spaceMembers.userId, userId))
    .orderBy(asc(schema.spaces.createdAt));
}

export async function getSpaceRoster(spaceId: string, viewerId: string) {
  const db = getDb();
  const [members, agentRows] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
        nexconnId: schema.users.nexconnId,
        role: schema.spaceMembers.role,
        joinedAt: schema.spaceMembers.joinedAt,
      })
      .from(schema.spaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.spaceMembers.userId))
      .where(eq(schema.spaceMembers.spaceId, spaceId))
      .orderBy(asc(schema.spaceMembers.joinedAt)),
    db
      .select({ agent: schema.agents, enabled: schema.spaceAgents.enabled })
      .from(schema.spaceAgents)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
      .where(eq(schema.spaceAgents.spaceId, spaceId))
      .orderBy(asc(schema.spaceAgents.addedAt)),
  ]);
  return {
    members,
    agents: agentRows.map((r) => ({ ...toPublicAgent(r.agent, viewerId), enabled: r.enabled })),
  };
}

/** People the user shares at least one space with (candidates for DMs and assignees). */
export async function listContacts(userId: string) {
  const db = getDb();
  const mySpaces = await db
    .select({ spaceId: schema.spaceMembers.spaceId })
    .from(schema.spaceMembers)
    .where(eq(schema.spaceMembers.userId, userId));
  if (mySpaces.length === 0) return [];
  const rows = await db
    .selectDistinct({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
      nexconnId: schema.users.nexconnId,
    })
    .from(schema.spaceMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.spaceMembers.userId))
    .where(inArray(schema.spaceMembers.spaceId, mySpaces.map((s) => s.spaceId)));
  return rows.filter((r) => r.id !== userId).sort((a, b) => a.name.localeCompare(b.name));
}

export function groupChannelKey(groupId: string) {
  return `g:${groupId}`;
}

export function agentDmChannelKey(agentNexconnId: string, userNexconnId: string) {
  return `a:${agentNexconnId}:${userNexconnId}`;
}
