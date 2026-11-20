/**
 * Registers everything in the database on the Nexconn app configured in the environment:
 * agents and people (fresh access tokens), and one group channel per space with its members and
 * agents. Safe to run repeatedly. Run it after switching NEXCONN_APP_KEY to a new app.
 *
 * node --conditions=react-server --env-file=.env.local --import tsx scripts/provision-nexconn.mts [--dry-run]
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createGroup, issueAccessToken, joinGroup, NexconnError } from "@/lib/nexconn/server";

const dryRun = process.argv.includes("--dry-run");
const db = getDb();

const agents = await db.select().from(schema.agents);
const users = await db.select().from(schema.users);
const spaces = await db.select().from(schema.spaces);
console.log(`agents ${agents.length}, people ${users.length}, spaces ${spaces.length}${dryRun ? " (dry run)" : ""}`);
if (dryRun) process.exit(0);

for (const agent of agents) {
  await issueAccessToken(agent.nexconnId, agent.name, agent.avatarUrl);
  console.log(`agent  @${agent.handle}`);
}

for (const user of users) {
  const token = await issueAccessToken(user.nexconnId, user.name, user.avatarUrl);
  await db.update(schema.users).set({ nexconnToken: token }).where(eq(schema.users.id, user.id));
  console.log(`person ${user.email}`);
}

const userNexconn = new Map(users.map((u) => [u.id, u.nexconnId]));
for (const space of spaces) {
  const members = await db.select({ userId: schema.spaceMembers.userId }).from(schema.spaceMembers).where(eq(schema.spaceMembers.spaceId, space.id));
  const spaceAgents = await db
    .select({ nexconnId: schema.agents.nexconnId })
    .from(schema.spaceAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.spaceAgents.agentId))
    .where(eq(schema.spaceAgents.spaceId, space.id));
  const owner = userNexconn.get(space.ownerId);
  if (!owner) {
    console.warn(`space  ${space.name}: owner missing, skipped`);
    continue;
  }
  try {
    await createGroup(space.nexconnGroupId, space.name, owner);
  } catch (err) {
    // Already exists on this app: membership is synced below.
    if (!(err instanceof NexconnError) || err.code === -1) throw err;
  }
  const ids = [...members.map((m) => userNexconn.get(m.userId)), ...spaceAgents.map((a) => a.nexconnId)].filter(
    (id): id is string => Boolean(id) && id !== owner,
  );
  for (let i = 0; i < ids.length; i += 100) await joinGroup(space.nexconnGroupId, ids.slice(i, i + 100));
  console.log(`space  ${space.name} (${ids.length + 1} members)`);
}
console.log("done");
