import { and, eq } from "drizzle-orm";
import { ApiError, ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership, requireOwner } from "@/lib/spaces";
import { leaveGroup } from "@/lib/nexconn/server";

/** Owner removes a member from the space (and the Nexconn group). */
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ spaceId: string; userId: string }> }) => {
  const user = await requireUser();
  const { spaceId, userId } = await params;
  const m = await requireMembership(spaceId, user.id);
  requireOwner(m);
  if (userId === user.id) throw new ApiError(400, "invalid_input", "You can't remove yourself.");
  const db = getDb();
  const [member] = await db
    .select({ nexconnId: schema.users.nexconnId })
    .from(schema.spaceMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.spaceMembers.userId))
    .where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, userId)))
    .limit(1);
  if (!member) throw new ApiError(404, "not_found", "That person is not a member.");
  await leaveGroup(m.space.nexconnGroupId, [member.nexconnId]);
  await db.delete(schema.spaceMembers).where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, userId)));
  return ok({ ok: true });
});
