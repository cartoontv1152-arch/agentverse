import { eq } from "drizzle-orm";
import { ok, parseJson, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { profileSchema } from "@/lib/validation";
import { updateUser } from "@/lib/nexconn/server";
import { aiUsage } from "@/lib/ai/limits";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ user, usage: await aiUsage(user.id) });
});

export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseJson(req, profileSchema);
  const [updated] = await getDb()
    .update(schema.users)
    .set({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}) })
    .where(eq(schema.users.id, user.id))
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email, avatarUrl: schema.users.avatarUrl, nexconnId: schema.users.nexconnId });
  // Keep the Nexconn user profile (used in push notifications) in sync.
  await updateUser(updated.nexconnId, updated.name, updated.avatarUrl).catch((err) => console.warn("[me] nexconn profile sync failed", err));
  return ok({ user: updated });
});
