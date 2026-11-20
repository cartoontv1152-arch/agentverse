import { eq } from "drizzle-orm";
import { ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { getSpaceRoster, requireMembership, requireOwner } from "@/lib/spaces";
import { spaceUpdateSchema } from "@/lib/validation";
import { dismissGroup, updateGroupName } from "@/lib/nexconn/server";
import { aiUsage } from "@/lib/ai/limits";

type Ctx = { params: Promise<{ spaceId: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const [roster, usage] = await Promise.all([getSpaceRoster(spaceId, user.id), aiUsage(user.id, spaceId)]);
  return ok({
    space: {
      id: m.space.id,
      name: m.space.name,
      description: m.space.description,
      nexconnGroupId: m.space.nexconnGroupId,
      ownerId: m.space.ownerId,
      replyMode: m.space.replyMode,
      requireApproval: m.space.requireApproval,
      createdAt: m.space.createdAt,
    },
    role: m.role,
    lastReadAt: m.lastReadAt,
    ...roster,
    usage,
  });
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  requireOwner(m);
  const input = await parseJson(req, spaceUpdateSchema);
  const [space] = await getDb().update(schema.spaces).set(input).where(eq(schema.spaces.id, spaceId)).returning();
  if (input.name && input.name !== m.space.name) {
    await updateGroupName(space.nexconnGroupId, input.name).catch((err) => console.warn("[spaces] group rename failed", err));
  }
  return ok({ space });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  requireOwner(m);
  await dismissGroup(m.space.nexconnGroupId).catch((err) => console.warn("[spaces] dismiss failed", err));
  await getDb().delete(schema.spaces).where(eq(schema.spaces.id, spaceId));
  return ok({ ok: true });
});
