import { and, eq } from "drizzle-orm";
import { ApiError, ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { leaveGroup } from "@/lib/nexconn/server";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  if (m.role === "owner") throw new ApiError(400, "owner_cannot_leave", "Owners can't leave their space. Delete it from settings instead.");
  await leaveGroup(m.space.nexconnGroupId, [user.nexconnId]);
  await getDb().delete(schema.spaceMembers).where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, user.id)));
  return ok({ ok: true });
});
