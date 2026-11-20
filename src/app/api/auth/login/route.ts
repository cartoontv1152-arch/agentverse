import { eq } from "drizzle-orm";
import { ApiError, ok, parseJson, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validation";

// Constant-cost dummy hash so unknown emails take as long as wrong passwords.
let dummyHash: Promise<string> | null = null;

export const POST = route(async (req: Request) => {
  const input = await parseJson(req, loginSchema);
  await rateLimit(`login:${clientIp(req)}`, 30, 900, "Too many login attempts. Wait 15 minutes and try again.");
  await rateLimit(`login:${input.email}`, 10, 900, "Too many login attempts for this account. Wait 15 minutes and try again.");
  const [user] = await getDb()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);
  dummyHash ??= hashPassword("agentverse-timing-equaliser");
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) throw new ApiError(401, "invalid_credentials", "That email and password don't match an account.");
  await createSession(user.id);
  return ok({ user: { id: user.id, name: user.name, email: user.email } });
});
