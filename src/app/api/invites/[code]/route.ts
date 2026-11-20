import { and, count, eq, sql } from "drizzle-orm";
import { ApiError, ok, requireUser, route } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { lookupInvite } from "@/lib/invites";
import { addMember } from "@/lib/spaces";
import { rateLimit } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ code: string }> };
const MAX_MEMBERS = 250;

/** Public invite preview (space name, inviter, member count). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  const invite = await lookupInvite(code);
  if (invite.status !== "valid") return ok({ status: invite.status });
  return ok({ status: "valid", space: { name: invite.space.name, description: invite.space.description }, inviterName: invite.inviterName, memberCount: invite.memberCount });
});

/** Accepts an invite: joins the space and its Nexconn group. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { code } = await params;
  await rateLimit(`join:${user.id}`, 30, 3600, "Too many join attempts. Try again later.");
  const invite = await lookupInvite(code);
  if (invite.status === "expired") throw new ApiError(410, "invite_expired", "This invite link has expired. Ask for a new one.");
  if (invite.status === "revoked") throw new ApiError(410, "invite_revoked", "This invite link was turned off. Ask for a new one.");
  if (invite.status !== "valid") throw new ApiError(404, "not_found", "This invite link doesn't exist.");
  const db = getDb();
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, invite.space.id)).limit(1);
  const [existing] = await db
    .select({ userId: schema.spaceMembers.userId })
    .from(schema.spaceMembers)
    .where(and(eq(schema.spaceMembers.spaceId, space.id), eq(schema.spaceMembers.userId, user.id)))
    .limit(1);
  if (existing) return ok({ spaceId: space.id, alreadyMember: true });
  const [{ n }] = await db.select({ n: count() }).from(schema.spaceMembers).where(eq(schema.spaceMembers.spaceId, space.id));
  if (Number(n) >= MAX_MEMBERS) throw new ApiError(400, "space_full", "This space is full.");
  await addMember(space, user);
  await db.update(schema.invites).set({ uses: sql`${schema.invites.uses} + 1` }).where(eq(schema.invites.id, invite.inviteId));
  return ok({ spaceId: space.id, alreadyMember: false }, 201);
});
