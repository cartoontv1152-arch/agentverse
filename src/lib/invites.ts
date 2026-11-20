import "server-only";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type InviteLookup =
  | { status: "valid"; inviteId: string; space: { id: string; name: string; description: string }; inviterName: string; memberCount: number }
  | { status: "expired" | "revoked" | "not_found" };

export async function lookupInvite(code: string): Promise<InviteLookup> {
  if (!/^[A-Za-z0-9]{6,40}$/.test(code)) return { status: "not_found" };
  const db = getDb();
  const [row] = await db
    .select({ invite: schema.invites, space: schema.spaces, inviterName: schema.users.name })
    .from(schema.invites)
    .innerJoin(schema.spaces, eq(schema.spaces.id, schema.invites.spaceId))
    .innerJoin(schema.users, eq(schema.users.id, schema.invites.createdBy))
    .where(eq(schema.invites.code, code))
    .limit(1);
  if (!row) return { status: "not_found" };
  if (row.invite.revokedAt) return { status: "revoked" };
  if (row.invite.expiresAt.getTime() < Date.now()) return { status: "expired" };
  const [{ n }] = await db.select({ n: count() }).from(schema.spaceMembers).where(eq(schema.spaceMembers.spaceId, row.space.id));
  return {
    status: "valid",
    inviteId: row.invite.id,
    space: { id: row.space.id, name: row.space.name, description: row.space.description },
    inviterName: row.inviterName,
    memberCount: Number(n),
  };
}
