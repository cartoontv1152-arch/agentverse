import { and, eq } from "drizzle-orm";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { memoryUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ spaceId: string; itemId: string }> };

function assertId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Memory item not found.");
}

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId, itemId } = await params;
  await requireMembership(spaceId, user.id);
  assertId(itemId);
  const input = await parseJson(req, memoryUpdateSchema);
  const [item] = await getDb()
    .update(schema.memoryItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(schema.memoryItems.id, itemId), eq(schema.memoryItems.spaceId, spaceId)))
    .returning();
  if (!item) throw new ApiError(404, "not_found", "Memory item not found.");
  return ok({ item });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId, itemId } = await params;
  await requireMembership(spaceId, user.id);
  assertId(itemId);
  const [item] = await getDb()
    .delete(schema.memoryItems)
    .where(and(eq(schema.memoryItems.id, itemId), eq(schema.memoryItems.spaceId, spaceId)))
    .returning({ id: schema.memoryItems.id });
  if (!item) throw new ApiError(404, "not_found", "Memory item not found.");
  return ok({ ok: true });
});
