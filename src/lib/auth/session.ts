import "server-only";
import { auth, currentUser, type User as ClerkUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { User } from "@/lib/db/schema";
import { newNexconnId } from "@/lib/nexconn/ids";
import { issueAccessToken } from "@/lib/nexconn/server";
import { nameFromEmail } from "@/lib/names";

/**
 * Sessions are owned by Clerk (sign-up, sign-in, verification, password resets, Google).
 * Each Clerk user maps to one row in `users`, which holds the app profile and the person's
 * Nexconn identity. The row is created the first time a signed-in person reaches the app.
 */

export type SessionUser = Pick<User, "id" | "email" | "name" | "avatarUrl" | "nexconnId" | "nameConfirmed">;

const columns = {
  id: schema.users.id,
  email: schema.users.email,
  name: schema.users.name,
  avatarUrl: schema.users.avatarUrl,
  nexconnId: schema.users.nexconnId,
  nameConfirmed: schema.users.nameConfirmed,
};

/** The Clerk user id for this request, or null when signed out. */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Returns the signed-in user for the current request (creating their app profile on first visit), or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const clerkId = await getClerkUserId();
  if (!clerkId) return null;
  const [row] = await getDb().select(columns).from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
  return row ?? provisionUser(clerkId);
}

/** The name Clerk knows, or null when sign-up didn't collect one. */
function clerkName(user: ClerkUser): string | null {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return (full || user.username || "").slice(0, 60) || null;
}

async function provisionUser(clerkId: string): Promise<SessionUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkId) return null;
  const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ?? clerkUser.emailAddresses[0];
  if (!primary) return null;
  const email = primary.emailAddress.trim().toLowerCase();
  const db = getDb();

  // Clerk verified this address, so an existing profile with the same email (an account from
  // before Clerk, or a Clerk account that was deleted and recreated) belongs to this person.
  if (primary.verification?.status === "verified") {
    const [linked] = await db.update(schema.users).set({ clerkId }).where(eq(schema.users.email, email)).returning(columns);
    if (linked) return linked;
  }

  const known = clerkName(clerkUser);
  const name = known ?? nameFromEmail(email);
  const avatarUrl = clerkUser.hasImage ? clerkUser.imageUrl : null;
  const nexconnId = newNexconnId("u");
  const [created] = await db
    .insert(schema.users)
    .values({ clerkId, email, name, avatarUrl, nexconnId, nameConfirmed: Boolean(known) })
    .onConflictDoNothing()
    .returning(columns);
  if (!created) {
    // A concurrent request for the same person won the insert.
    const [row] = await db.select(columns).from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
    return row ?? null;
  }
  // Register the person on Nexconn now; /api/nexconn/token retries later if this fails.
  try {
    const token = await issueAccessToken(nexconnId, name, avatarUrl);
    await db.update(schema.users).set({ nexconnToken: token }).where(eq(schema.users.id, created.id));
  } catch (err) {
    console.warn("[auth] Nexconn registration deferred", err);
  }
  return created;
}
