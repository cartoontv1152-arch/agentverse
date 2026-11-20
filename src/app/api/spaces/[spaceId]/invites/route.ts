import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { requireMembership } from "@/lib/spaces";
import { randomAlnum } from "@/lib/nexconn/ids";
import { rateLimit } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ spaceId: string }> };
const INVITE_DAYS = 7;

const columns = {
  id: schema.invites.id,
  code: schema.invites.code,
  expiresAt: schema.invites.expiresAt,
  uses: schema.invites.uses,
};

/** The current active invite link for the space (any member can share it). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  await requireMembership(spaceId, user.id);
  const [invite] = await getDb()
    .select(columns)
    .from(schema.invites)
    .where(and(eq(schema.invites.spaceId, spaceId), isNull(schema.invites.revokedAt), gt(schema.invites.expiresAt, new Date())))
    .orderBy(desc(schema.invites.createdAt))
    .limit(1);
  return ok({ invite: invite ?? null });
});

/** Creates a new invite link valid for 7 days. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { spaceId } = await params;
  await requireMembership(spaceId, user.id);
  await rateLimit(`invite:${user.id}`, 30, 3600, "Too many invite links created. Try again later.");
  const [invite] = await getDb()
    .insert(schema.invites)
    .values({ spaceId, code: randomAlnum(14), createdBy: user.id, expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000) })
    .returning(columns);
  return ok({ invite }, 201);
});
