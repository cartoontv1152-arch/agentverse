/**
 * Removes accounts created by the e2e suite (emails ending in @e2e.agentverse.test), their spaces
 * (Nexconn groups are dismissed) and their custom agents. Never touches other accounts.
 * Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-e2e.mts [--dry-run]
 */
import { inArray, like, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dismissGroup } from "@/lib/nexconn/server";

const dryRun = process.argv.includes("--dry-run");
const db = getDb();
const users = await db
  .select({ id: schema.users.id, email: schema.users.email })
  .from(schema.users)
  .where(or(like(schema.users.email, "%@e2e.agentverse.test"), like(schema.users.email, "%@agv-test.dev")));
console.log(`e2e users: ${users.length}`);
if (users.length && !dryRun) {
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
  console.log(`removed ${users.length} users and ${spaces.length} spaces`);
}
