import { count, eq } from "drizzle-orm";
import { listMemory } from "@/lib/memory";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { memoryCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ spaceId: string }> };
const MAX_ITEMS = 60;

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  await requireMembership(spaceId, user.id);
  return ok({ items: await listMemory(spaceId) });
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  await requireMembership(spaceId, user.id);
  const input = await parseJson(req, memoryCreateSchema);
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.memoryItems).where(eq(schema.memoryItems.spaceId, spaceId));
  if (Number(n) >= MAX_ITEMS) throw new ApiError(400, "memory_full", `Space memory holds up to ${MAX_ITEMS} items. Remove some first.`);
  const [item] = await db
    .insert(schema.memoryItems)
    .values({ spaceId, kind: input.kind, text: input.text, createdByUserId: user.id, sourceMessageId: input.sourceMessageId ?? null })
    .returning();
  return ok({ item }, 201);
});
