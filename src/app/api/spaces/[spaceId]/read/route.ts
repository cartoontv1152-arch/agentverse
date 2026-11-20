import { and, eq } from "drizzle-orm";
import { ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";

/** Marks the space as read now; returns the previous read time (for "what did I miss"). */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  await getDb()
    .update(schema.spaceMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, user.id)));
  return ok({ previousReadAt: m.lastReadAt });
});
