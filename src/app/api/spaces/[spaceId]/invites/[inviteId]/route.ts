import { and, eq } from "drizzle-orm";
import { ApiError, ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";

/** Revokes an invite link (owner or its creator). */
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ spaceId: string; inviteId: string }> }) => {
  const user = await requireUser();
  const { spaceId, inviteId } = await params;
  const m = await requireMembership(spaceId, user.id);
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) throw new ApiError(404, "not_found", "Invite not found.");
  const db = getDb();
  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.id, inviteId), eq(schema.invites.spaceId, spaceId)))
    .limit(1);
  if (!invite) throw new ApiError(404, "not_found", "Invite not found.");
  if (m.role !== "owner" && invite.createdBy !== user.id) {
    throw new ApiError(403, "forbidden", "Only the owner or the link's creator can revoke it.");
  }
  await db.update(schema.invites).set({ revokedAt: new Date() }).where(eq(schema.invites.id, inviteId));
  return ok({ ok: true });
});
