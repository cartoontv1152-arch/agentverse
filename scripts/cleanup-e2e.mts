/**
 * Removes accounts created by the e2e suite: Clerk test users ("e2e.*+clerk_test@example.com"),
 * their app profiles, their spaces (Nexconn groups are dismissed) and their custom agents.
 * Never touches other accounts. Legacy password-era test domains are cleaned up too.
 * Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-e2e.mts [--dry-run]
 */
import { inArray, like, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dismissGroup } from "@/lib/nexconn/server";

const dryRun = process.argv.includes("--dry-run");
const isE2eEmail = (email: string) => /^e2e\..+\+clerk_test@example\.com$/i.test(email);
const db = getDb();

const users = await db
  .select({ id: schema.users.id, email: schema.users.email, clerkId: schema.users.clerkId })
  .from(schema.users)
  .where(
    or(
      like(schema.users.email, "e2e.%+clerk_test@example.com"),
      like(schema.users.email, "%@e2e.agentverse.test"),
      like(schema.users.email, "%@agv-test.dev"),
    ),
  );
console.log(`e2e app profiles: ${users.length}`);

// Clerk accounts, including ones that never reached the app (a test that failed mid-sign-up).
const clerkKey = process.env.CLERK_SECRET_KEY;
const clerkIds = new Set(users.map((u) => u.clerkId).filter((id): id is string => Boolean(id)));
if (clerkKey) {
  for (let offset = 0; ; offset += 100) {
    const res = await fetch(`https://api.clerk.com/v1/users?query=e2e.&limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${clerkKey}` } });
    const page = (await res.json()) as { id: string; email_addresses: { email_address: string }[] }[];
    if (!Array.isArray(page) || page.length === 0) break;
    for (const u of page) if (u.email_addresses.some((e) => isE2eEmail(e.email_address))) clerkIds.add(u.id);
    if (page.length < 100) break;
  }
}
console.log(`e2e Clerk accounts: ${clerkIds.size}`);
if (!dryRun && users.length) {
  const ids = users.map((u) => u.id);
  const spaces = await db
    .select({ id: schema.spaces.id, groupId: schema.spaces.nexconnGroupId })
    .from(schema.spaces)
    .where(inArray(schema.spaces.ownerId, ids));
  for (const s of spaces) {
    await dismissGroup(s.groupId).catch((err) => console.warn("dismiss failed", s.groupId, String(err)));
  }
  if (spaces.length) await db.delete(schema.spaces).where(inArray(schema.spaces.id, spaces.map((s) => s.id)));
  await db.delete(schema.users).where(inArray(schema.users.id, ids));
  console.log(`removed ${users.length} profiles and ${spaces.length} spaces`);
}

if (!dryRun && clerkKey) {
  let removed = 0;
  for (const id of clerkIds) {
    const res = await fetch(`https://api.clerk.com/v1/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${clerkKey}` } });
    if (res.ok) removed++;
    else console.warn("Clerk delete failed", id, res.status);
  }
  console.log(`removed ${removed} Clerk accounts`);
}
