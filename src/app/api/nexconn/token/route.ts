import { eq } from "drizzle-orm";
import { ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { issueAccessToken } from "@/lib/nexconn/server";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Returns the App Key (public) and the signed-in user's Nexconn access token.
 * `?refresh=1` issues a fresh token, used by the client when connect fails with an invalid token.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const db = getDb();
  const [row] = await db
    .select({ token: schema.users.nexconnToken, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  let token = row?.token ?? null;
  if (!token || refresh) {
    await rateLimit(`nxtoken:${user.id}`, 20, 3600, "Too many reconnect attempts. Reload the page in a few minutes.");
    token = await issueAccessToken(user.nexconnId, row?.name ?? user.name, row?.avatarUrl);
    await db.update(schema.users).set({ nexconnToken: token }).where(eq(schema.users.id, user.id));
  }
  return ok(
    { appKey: env.nexconnAppKey, userId: user.nexconnId, token },
    200,
  );
});
