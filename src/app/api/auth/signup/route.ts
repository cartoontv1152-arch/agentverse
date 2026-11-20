import { eq } from "drizzle-orm";
import { ApiError, ok, parseJson, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signupSchema } from "@/lib/validation";
import { newNexconnId } from "@/lib/nexconn/ids";
import { issueAccessToken } from "@/lib/nexconn/server";

export const POST = route(async (req: Request) => {
  await rateLimit(`signup:${clientIp(req)}`, Number(process.env.SIGNUP_LIMIT_PER_HOUR ?? 20), 3600, "Too many sign-ups from this network. Try again in an hour.");
  const input = await parseJson(req, signupSchema);
  const db = getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  if (existing) {
    throw new ApiError(409, "email_taken", "An account with this email already exists. Log in instead.", { field: "email" });
  }
  const nexconnId = newNexconnId("u");
  // Registers the person as a Nexconn user and gets their first access token.
  const token = await issueAccessToken(nexconnId, input.name);
  const [user] = await db
    .insert(schema.users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      nexconnId,
      nexconnToken: token,
    })
    .onConflictDoNothing({ target: schema.users.email })
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
  if (!user) throw new ApiError(409, "email_taken", "An account with this email already exists. Log in instead.", { field: "email" });
  await createSession(user.id);
  return ok({ user }, 201);
});
